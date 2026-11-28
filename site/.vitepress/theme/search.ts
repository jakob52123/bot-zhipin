// 命令面板的搜索：纯函数，不碰 DOM，服务端和单测都能直接跑。

type Texts = readonly (string | null | undefined)[] | null

export interface SearchableBot {
  slug: string
  name: string
  /** 中文叫法（可选）。和原名一样算「名字」，两个都能搜到。 */
  nameZh?: string | null
  tagline?: string | null
  category?: string | null
  author?: { name?: string | null } | null
  /** 平台。只有 OpenBot 当一个别名（搜「openbot」能找到，搜「bot」不会因为它冒出来）；Grok Bot 是货架默认，不算，免得搜 grok 冒出整个货架。 */
  platform?: string | null
  /** 额外的可搜文字，分量和介绍一样（小队用它放成员的名字和队内岗位） */
  keywords?: Texts
  /**
   * 条目上不显示的别名（收录条目的英文原名、slug）：分量和分类、作者一样。
   * 纯 ASCII 的词要从别名里某个词的开头命中（按非字母数字和驼峰切词），免得「ai」命中 email、explain。
   */
  aliases?: Texts
  /** 分量最低的长句（收录条目的适用场景）：只命中这里的排在最后。 */
  extra?: Texts
}

/** 统一成可比较的写法：全角转半角、不分大小写、连续空白并成一个空格。 */
function fold(value: unknown): string {
  return typeof value === 'string'
    ? value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
    : ''
}

/**
 * 把查询拆成词：先统一写法，再在汉字和至少两个字符的英文、数字段的交界处断开，
 * 所以「做PPT」「写SQL」「AI腔」「写C#」和「做 PPT」「写 SQL」「AI 腔」「写 C#」一样（+ 和 # 算英文段里的字）。
 * 只有一个字母或数字的不断开：「B站」「K线」「X简报」整个当一个词，免得单个字母到处命中；
 * 这种混写的词在匹配时也拿去掉空格的字段比一次，所以仍能命中「B 站」「X 简报员」（见 matchWord）。
 * 库页的本库搜索也用它。
 */
export function queryWords(query: string): string[] {
  return fold(query)
    .replace(/(\p{Script=Han})(?=[a-z0-9+#]{2})/gu, '$1 ')
    .replace(/([a-z0-9+#]{2})(?=\p{Script=Han})/gu, '$1 ')
    .split(' ')
    .filter(Boolean)
}

const HAN = /\p{Script=Han}/u
const LATIN = /[a-z0-9]/
/**
 * 一个查询词是否出现在一段（已统一写法的）文字里：按子串找；
 * 汉字和英文混在一起的词（「b站」「x简报」）再拿去掉空白的文字比一次，「B 站」「X 简报员」也算。库页的本库搜索也用它。
 */
export function matchWord(field: string, word: string): boolean {
  return field.includes(word) || (HAN.test(word) && LATIN.test(word) && field.replace(/\s+/g, '').includes(word))
}

const ASCII = /^[\x20-\x7e]+$/
// 别名切词时 + 和 # 算词里的字：「C++」「C#」是一个词，搜 c++ 不会变成搜 c 开头。
const NOT_WORD = /[^a-z0-9+#]+/g
const compact = (value: string) => value.replace(/ /g, '')
const tokens = (value: string) => value.toLowerCase().replace(NOT_WORD, ' ').trim()

/**
 * 别名的几种写法：整串（非 ASCII 的词按子串找）；切成词、两头补空格的（ASCII 的词按「某个词的开头」找）。
 * 切词放两套：只按符号切的整词（PDFs、ChatGPT、iOS、B2B、3D 原样），和再按驼峰切开的（chat gpt、git hub）；
 * 两套用「|」隔开，一个查询词不会跨着两套命中。驼峰只在小写后接大写处切，数字后面不切；
 * 连写的大写缩写后面跟一个至少两个小写字母的词时也切开（PDFToolkit → pdf toolkit，PDFs 不切）。
 */
function alias(value: unknown) {
  if (typeof value !== 'string') return { whole: '', words: '' }
  const text = value.normalize('NFKC')
  const plain = tokens(text)
  const camel = tokens(text.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z]{2,})/g, '$1 $2'))
  const sets = [...new Set([plain, camel].filter(Boolean))]
  return { whole: fold(value), words: sets.length ? ` ${sets.join(' | ')} ` : '' }
}

function inAlias(aliases: readonly { whole: string; words: string }[], word: string) {
  if (!ASCII.test(word)) return aliases.some(({ whole }) => matchWord(whole, word))
  const head = tokens(word)
  return head !== '' && aliases.some(({ words }) => words.includes(` ${head}`))
}

/**
 * 按查询筛选并排序 Bot，返回新数组，不修改传入的数据。
 *
 * 匹配：查询拆成多个词（queryWords），每个词都要出现在 name、nameZh、tagline、category、author.name、slug、keywords、
 * extra 之一里（matchWord），或命中 aliases（规则见字段说明）；可以落在不同字段上。
 *
 * 「名字」有两个：原名（name）和中文叫法（nameZh），分量一样，搜哪个都算命中名字。
 * 排序分五档：
 * 0 某个名字以整句查询开头（两边都不算空格）；1 每个词都在名字里；2 有词命中分类、作者或别名；
 * 3 有词命中介绍、slug 或 keywords；4 只命中 extra。
 * 多个词时，只有一部分词在名字里的也算第 2 档（名字不比分类、作者弱）。
 * 同一档里，只在 extra 里找到的词少的排前面（「做PPT」时打了 PPT 标签的，排在只在场景里提到 PPT 的前面），
 * 再相同就保持传入顺序。Bot 和小队没有 extra，顺序和以前一样。
 *
 * 空查询按传入顺序返回前 limit 个。
 */
export function searchBots<T extends SearchableBot>(bots: readonly T[], query: string, limit = 8): T[] {
  const max = Math.max(0, Math.floor(limit))
  const words = queryWords(query)
  if (!words.length) return bots.slice(0, max)

  const phrase = compact(words.join(' '))
  const inAny = (fields: readonly string[], word: string) => fields.some((field) => matchWord(field, word))
  const hits: { bot: T; tier: number; extraOnly: number }[] = []
  for (const bot of bots) {
    const names = [fold(bot.nameZh), fold(bot.name)].filter(Boolean)
    const titles = [...names, fold(bot.category), fold(bot.author?.name)]
    const aliases = [...(bot.aliases ?? []), bot.platform === 'OpenBot' ? 'openbot' : null].map(alias).filter(({ whole }) => whole)
    const middle = [fold(bot.tagline), fold(bot.slug), ...(bot.keywords ?? []).map(fold)]
    const extra = (bot.extra ?? []).map(fold)
    const high = (word: string) => inAny(titles, word) || inAlias(aliases, word)
    const above = (word: string) => high(word) || inAny(middle, word)
    if (!words.every((word) => above(word) || inAny(extra, word))) continue
    const tier = names.some((name) => compact(name).startsWith(phrase)) ? 0
      : words.every((word) => inAny(names, word)) ? 1
      : words.some(high) ? 2
      : words.some((word) => inAny(middle, word)) ? 3
      : 4
    hits.push({ bot, tier, extraOnly: words.filter((word) => !above(word)).length })
  }
  // Array.prototype.sort 是稳定排序，档位和 extraOnly 都相同的自然保持传入顺序。
  return hits.sort((a, b) => a.tier - b.tier || a.extraOnly - b.extraOnly).slice(0, max).map(({ bot }) => bot)
}

export interface SearchableSquad {
  slug: string
  name: string
  tagline?: string | null
  formation?: string | null
  author?: { name?: string | null } | null
  members?: readonly { name?: string | null; nameZh?: string | null; title?: string | null }[] | null
}

/**
 * 按查询筛选并排序小队，规则和 searchBots 一样：名字最重，其次是「小队」这两个字、队形和作者，
 * 最后是介绍、slug、成员的名字（原名和中文叫法都算）和队内岗位。空查询按传入顺序返回前 limit 支。
 */
export function searchSquads<T extends SearchableSquad>(squads: readonly T[], query: string, limit = 3): T[] {
  const rows = squads.map((squad) => ({
    slug: squad.slug, name: squad.name, tagline: squad.tagline, author: squad.author,
    category: `小队 ${squad.formation ?? ''}`,
    keywords: (squad.members ?? []).flatMap((member) => [member.name, member.nameZh, member.title]),
    squad,
  }))
  return searchBots(rows, query, limit).map((row) => row.squad)
}

export interface SearchableEntry {
  slug: string
  title: string
  /** Prompt 的原标题（可选） */
  titleOriginal?: string | null
  /** Skill 的原名（可选） */
  name?: string | null
  purpose?: string | null
  category?: string | null
  author?: { name?: string | null } | null
  scenarios?: Texts
  tags?: Texts
  /** Skill 能用在哪些工具 */
  agents?: Texts
}

/**
 * 按查询筛选并排序收录条目（Prompt、Skill），用 searchBots 的分档：
 * 0、1 档只看条目上显示的标题；2 档是分类、作者和不显示的别名（原标题或 Skill 原名、slug，ASCII 词要从词头命中）；
 * 3 档是一句话用途、标签和能用在哪些工具（Skill）；4 档是适用场景（长句，只顺带提到的排最后）。不搜正文。
 *
 * 空查询返回空数组：面板没输入时只列 Bot 和小队，不列收录条目。
 */
export function searchLibrary<T extends SearchableEntry>(items: readonly T[], query: string, limit = 4): T[] {
  if (!queryWords(query).length) return []
  const rows = items.map((item) => ({
    // slug 放进别名（按词头匹配），不按子串搜：英文 slug 里的 ai、ui 到处都是。
    slug: '', name: item.title,
    aliases: [item.titleOriginal, item.name, item.slug],
    tagline: item.purpose, category: item.category, author: item.author,
    keywords: [...(item.tags ?? []), ...(item.agents ?? [])],
    extra: item.scenarios,
    item,
  }))
  return searchBots(rows, query, limit).map((row) => row.item)
}
