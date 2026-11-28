// 给 AI 用的数据（决策 70）：/data/index.json 是全部 Prompt、Skill、Bot 的轻量索引（不带正文），
// /data/<kind>s/<slug>.json 是每条的完整数据。bot-zhipin skill（integrations/bot-zhipin/）先搜索引、再按 dataUrl 取详情。
// 纯函数：输入是网站已经整理好的数据（promptData、skillData、buildCatalog 的 bots），不读盘。
import { SITE } from '../../site/.vitepress/meta.mjs'
import { absoluteUrl } from './share.mjs'

/** 构建时 skill 目录拷到产物的这个位置。 */
export const SKILL_DIR = '/skill/bot-zhipin/'
export const INDEX_PATH = '/data/index.json'
export const dataPath = (kind, slug) => `/data/${kind}s/${slug}.json`
const SKILL_MEDIA = '/media/skills/'

// Prompt 的效果图（出图、视频类）和 Skill 作者示例里的图：给绝对地址，AI 能直接把链接交给用户。
// 这些字段由网站的数据层按需带上（entry-summary.mjs），没有就是空数组。
const promptImages = (images) => (images ?? []).filter((image) => image?.src)
  .map(({ src, alt, credit, width, height }) => ({ url: absoluteUrl(src), alt, credit, width, height }))
const skillExamples = (examples) => (examples ?? []).map(({ images, ...example }) => ({
  ...example,
  images: (images ?? []).filter((image) => image?.file)
    .map(({ file, alt, width, height }) => ({ url: absoluteUrl(SKILL_MEDIA + file), alt, width, height })),
}))

/** 现成的一行署名：AI 把条目交给用户时原样附上。有原版权行就带上；给的是本站译文时注明。 */
export function creditLine({ author, sourceUrl, license, copyright, translated, detailUrl }) {
  return [
    author && `作者：${author}`,
    sourceUrl && `来源：${sourceUrl}`,
    license && `许可：${license}`,
    copyright && `版权：${copyright}`,
    translated && `中文由 ${SITE.name}翻译`,
    `经 ${SITE.name}收录：${detailUrl}`,
  ].filter(Boolean).join(' · ')
}

function promptDetail(p) {
  const detailUrl = absoluteUrl(p.detailUrl)
  const credit = { author: p.author.name, sourceUrl: p.source.url, license: p.license, copyright: p.copyright, detailUrl }
  return {
    kind: 'prompt', slug: p.slug, title: p.title, titleOriginal: p.titleOriginal, category: p.category,
    purpose: p.purpose, scenarios: p.scenarios, tags: p.tags, lang: p.lang, models: p.models ?? [],
    images: promptImages(p.images),
    text: p.bodyZh ?? p.body, body: p.body, bodyZh: p.bodyZh, usage: p.usage, summary: p.summary,
    source: p.source, author: p.author, license: p.license, licenseUrl: p.licenseUrl, copyright: p.copyright,
    addedAt: p.addedAt, detailUrl,
    // credit 配 text（有译文时注明本站翻译）；creditOriginal 配 body（英文原文），不带译文说明。
    credit: creditLine({ ...credit, translated: Boolean(p.bodyZh) }),
    creditOriginal: creditLine(credit),
  }
}

function skillDetail(s) {
  const detailUrl = absoluteUrl(s.detailUrl)
  return {
    kind: 'skill', slug: s.slug, title: s.title, name: s.name, category: s.category,
    purpose: s.purpose, scenarios: s.scenarios, tags: s.tags, agents: s.agents,
    summary: s.summary, install: s.install, requires: s.requires, examples: skillExamples(s.examples),
    source: s.source, author: s.author, license: s.license, licenseUrl: s.licenseUrl,
    addedAt: s.addedAt, detailUrl,
    credit: creditLine({ author: s.author.name, sourceUrl: s.source.url, license: s.license, detailUrl }),
  }
}

// catalog.json 里的 Bot 已经是绝对地址。
function botDetail(b) {
  return {
    kind: 'bot', title: b.nameZh ?? b.name, ...b,
    credit: creditLine({ author: b.author?.name, sourceUrl: b.templateUrl ?? b.projectUrl ?? undefined, detailUrl: b.detailUrl }),
  }
}

const common = (d) => ({
  kind: d.kind, slug: d.slug, title: d.title, category: d.category, purpose: d.purpose,
  scenarios: d.scenarios, tags: d.tags, author: d.author?.name ?? '', addedAt: d.addedAt,
  detailUrl: d.detailUrl, dataUrl: absoluteUrl(dataPath(d.kind, d.slug)),
})

/**
 * @param {{ prompts: object[], skills: object[], bots: object[] }} input
 *   prompts / skills 是 promptData()、skillData() 的结果（已排好序），bots 是 buildCatalog().bots。
 * @returns {{ index: object, files: { path: string, data: object }[] }} files 的 path 是站内路径。
 */
export function buildAgentData({ prompts, skills, bots }) {
  const details = [...prompts.map(promptDetail), ...skills.map(skillDetail), ...bots.map(botDetail)]
  const url = absoluteUrl('/')
  const items = details.map((d) => d.kind === 'prompt'
    ? { ...common(d), titleOriginal: d.titleOriginal, lang: d.lang, models: d.models, hasBody: d.text !== null, hasImages: d.images.length > 0 }
    : d.kind === 'skill'
      ? { ...common(d), name: d.name, agents: d.agents, hasExamples: d.examples.length > 0 }
      : { ...common({ ...d, purpose: d.tagline, scenarios: [], tags: [] }), name: d.name, nameZh: d.nameZh, platform: d.platform, starters: d.starters })
  const index = {
    name: SITE.name,
    url,
    docs: absoluteUrl('/llms.txt'),
    skill: absoluteUrl(`${SKILL_DIR}SKILL.md`),
    license: {
      site: 'CC-BY-4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/deed.zh-hans',
      attribution: `${SITE.name}（${url}）`,
      entries: 'Prompt 正文、Skill 和 Bot 本身归原作者，许可见每条详情的 license、copyright 字段；转交给用户时附上详情里的 credit',
    },
    counts: { prompt: prompts.length, skill: skills.length, bot: bots.length },
    items,
  }
  return { index, files: details.map((data) => ({ path: dataPath(data.kind, data.slug), data })) }
}
