import { authorPagePath } from './authors.mjs'
import { SITE } from '../../site/.vitepress/meta.mjs'

const OFFICIAL_MARKETPLACE_PREFIX = 'https://x.ai/bot/marketplace/bots/'
// 卡片上的两个提示用到的权限。取值来自 schema 的权限枚举，单测保证它们还在枚举里。
export const ACCOUNT_PERMISSIONS = ['外部账号', '浏览器 Cookie']
export const SELF_RUNNING_PERMISSION = '定时自动运行'
export const SEND_PERMISSION = '代我发消息'

// 投稿预览里的数据可能还没通过校验，所以下面只认类型对的值，其余当作没写。
const text = (value) => typeof value === 'string' && value ? value : null
const texts = (value) => Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item) : []
const rows = (value) => Array.isArray(value) ? value.filter((item) => item !== null && typeof item === 'object' && !Array.isArray(item)) : []

/** 台词归一成数组：一句话、多句列表都接受。 */
export function pitchLines(pitch) {
  return typeof pitch === 'string' ? texts([pitch]) : texts(pitch)
}

/** about 没写（或什么都没写进去）是 null；写了就把缺的数组补成 []、缺的字符串补成 null。 */
function summarizeAbout(about) {
  if (about === null || typeof about !== 'object' || Array.isArray(about)) return null
  const summary = {
    intro: text(about.intro),
    does: texts(about.does),
    trial: text(about.trial),
    starters: texts(about.starters),
    skills: rows(about.skills).map((skill) => ({ name: text(skill.name), does: text(skill.does) })),
    routines: rows(about.routines).map((routine) => ({
      what: text(routine.what), when: text(routine.when), default: text(routine.default), quiet: text(routine.quiet),
    })),
    fit: text(about.fit),
    notFit: text(about.notFit),
    cnFit: text(about.cnFit),
    cnNote: text(about.cnNote),
  }
  return Object.values(summary).some((value) => Array.isArray(value) ? value.length : value !== null) ? summary : null
}

/**
 * names / namesZh：slug → 原名 / 中文叫法，只用来给「改编自」那一行找原 Bot 怎么称呼。
 * 摘要里 name 始终是原名，nameZh 是中文叫法（没写是 null）；界面上怎么称呼由 scripts/lib/bot-name.mjs 定。
 */
export function summarizeBot(bot, { asset, names = new Map(), namesZh = new Map() } = {}) {
  const data = bot.data || {}
  const source = `${SITE.repo}/blob/${SITE.branch}/bots/${bot.slug}`
  asset ||= (file) => `/bot-assets/${bot.slug}/${encodeURIComponent(file)}`
  const author = data.author || {}
  const pitches = pitchLines(data.pitch)
  const permissions = data.permissions || []
  const has = (permission) => Array.isArray(permissions) && permissions.includes(permission)
  return {
    slug: bot.slug,
    name: data.name,
    nameZh: text(data.nameZh),
    tagline: data.tagline,
    category: data.category,
    author: {
      name: author.name,
      page: authorPagePath(author.github),
      github: author.github || null,
      url: author.url || null,
      link: author.github ? `https://github.com/${author.github}` : author.url || data.templateUrl,
    },
    templateUrl: data.templateUrl,
    addedAt: data.addedAt,
    prerequisites: Array.isArray(data.prerequisites) ? data.prerequisites : [data.prerequisites || '无'],
    quotaCost: data.quotaCost,
    permissions,
    needsAccount: ACCOUNT_PERMISSIONS.some(has),
    selfRunning: has(SELF_RUNNING_PERMISSION),
    pitch: pitches[0] ?? null,
    pitches,
    about: summarizeAbout(data.about),
    forkedFrom: data.forkedFrom || null,
    forkedFromName: names.get(data.forkedFrom) || data.forkedFrom || null,
    forkedFromNameZh: text(namesZh.get(data.forkedFrom)),
    external: data.external === true,
    official: data.external === true && typeof author.url === 'string' && author.url.startsWith(OFFICIAL_MARKETPLACE_PREFIX),
    avatar: bot.avatar ? asset('avatar.png') : null,
    screenshots: bot.screenshots.filter((shot) => shot.isImage).map((shot) => asset(shot.file)),
    skills: bot.skills.filter((skill) => skill.exists).map((skill) => ({
      name: skill.frontmatter?.name || skill.name,
      description: skill.frontmatter?.description || '',
      sourceUrl: `${source}/skills/${encodeURIComponent(skill.name)}/SKILL.md`,
    })),
    hasRoutines: bot.routines !== null,
    routinesUrl: bot.routines !== null ? `${source}/routines.md` : null,
    detailUrl: `/bots/${bot.slug}`,
  }
}

/**
 * 货架装饰：在摘要上补策展和小队信息。curation 是 resolveCuration 的结果，squads 是小队摘要。
 * 两样都不传时得到默认值（投稿预览用），字段形状和货架上的一致。
 */
export function decorateSummary(summary, { curation = null, squads = [] } = {}) {
  const notes = curation?.editorNotes
  const pick = Array.isArray(curation?.picks) ? curation.picks.indexOf(summary.slug) : -1
  return {
    ...summary,
    editorNote: notes && Object.hasOwn(notes, summary.slug) ? notes[summary.slug] : null,
    pick: pick >= 0 ? pick : null,
    squads: squads.flatMap((squad) => {
      // 新写岗位的代号可能和某个货架 Bot 同名，不算这个 Bot 进了队。
      const member = squad.members.find((item) => item.bot === summary.slug && !item.custom)
      return member ? [{ slug: squad.slug, name: squad.name, title: member.title, lead: member.lead, detailUrl: squad.detailUrl }] : []
    }),
  }
}

// 枚举只来自 schema；这里是产品文案，不是另一套枚举定义。
export const permissionCopy = {
  云电脑文件: '会读写你 Grok Bot 云电脑里的文件',
  '浏览器 Cookie': '会用云电脑浏览器里已登录网站的登录状态',
  外部账号: '需要你连接或登录第三方账号',
  联网: '会访问互联网上的网站或接口',
  定时自动运行: '会按计划自己运行，不用你每次叫它',
  代我发消息: '会以你的名义发送消息或发布内容',
}
export const quotaCopy = {
  低: '偶尔用一下，几乎不占额度',
  中: '每次运行会消耗一些额度',
  高: '运行频繁或任务较重，留意额度',
}
