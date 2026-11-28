// 策展数据：纯函数，不读盘。把 curation/shelf.yaml 整理成网站用的形状，里面只放 slug，
// Bot 的详细信息页面自己去货架数据（bots.data）里按 slug 取，不在这里再存一份。

const text = (value) => typeof value === 'string' && value ? value : null
const rows = (value) => Array.isArray(value) ? value.filter((item) => item !== null && typeof item === 'object' && !Array.isArray(item)) : []

/**
 * data：策展文件解析出来的对象（没有文件就是 null 或 {}）。
 * slugs：货架上全部 Bot 的 slug（Set）。不在货架上的 slug 会被丢掉，每丢一个调用一次 onDrop(位置, slug)。
 * 正常情况下 npm run validate 已经拦住了这些错误；这里兜底是为了开发时不让一处写错拖垮整个页面。
 */
export function resolveCuration(data, slugs, onDrop = () => {}) {
  const source = data !== null && typeof data === 'object' && !Array.isArray(data) ? data : {}
  const known = (slug, where) => {
    if (typeof slug === 'string' && slugs.has(slug)) return true
    onDrop(where, String(slug))
    return false
  }
  const unique = (list) => [...new Set(list)]
  const featured = []
  for (const item of rows(source.featured)) {
    if (featured.length < 3 && known(item.bot, 'featured') && !featured.some((entry) => entry.bot === item.bot)) featured.push({ bot: item.bot })
  }
  const picks = unique((Array.isArray(source.picks) ? source.picks : []).filter((slug) => known(slug, 'picks')))
  const collections = []
  for (const item of rows(source.collections)) {
    if (typeof item.slug !== 'string' || collections.some((entry) => entry.slug === item.slug)) continue
    const bots = unique((Array.isArray(item.bots) ? item.bots : []).filter((slug) => known(slug, `collections.${item.slug}`)))
    // 一个 Bot 都不剩的专题不显示。
    if (bots.length) collections.push({ slug: item.slug, title: text(item.title), blurb: text(item.blurb), bots })
  }
  const editorNotes = {}
  const notes = source.editorNotes
  if (notes !== null && typeof notes === 'object' && !Array.isArray(notes)) {
    for (const [slug, note] of Object.entries(notes)) if (known(slug, 'editorNotes') && text(note)) editorNotes[slug] = note
  }
  return { featured, picks, collections, editorNotes }
}
