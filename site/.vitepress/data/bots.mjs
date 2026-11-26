import { relative } from 'node:path'
import { BOTS_DIR, ROOT, loadAllBots, loadEnums } from '../../../scripts/lib/load-bots.mjs'
import { SQUADS_DIR, loadAllSquads } from '../../../scripts/lib/load-squads.mjs'
import { CURATION_FILE, loadCuration } from '../../../scripts/lib/load-curation.mjs'
import { summarizeBot, decorateSummary, permissionCopy, quotaCopy } from '../../../scripts/lib/bot-summary.mjs'
import { summarizeSquad } from '../../../scripts/lib/squad-summary.mjs'
import { resolveCuration } from '../../../scripts/lib/curation-summary.mjs'
import { isPublicBot, isPublicSquad } from '../../../scripts/lib/public-bot.mjs'

export function readBots() {
  return loadAllBots().filter((bot) => {
    if (isPublicBot(bot)) return true
    console.warn(`[货架] 跳过 ${bot.yamlRel}：${bot.yamlError ? '无法解析 bot.yaml' : 'slug 不合法或与文件夹不同'}`)
    return false
  })
}

export function readSquads() {
  return loadAllSquads().filter((squad) => {
    if (isPublicSquad(squad)) return true
    console.warn(`[小队] 跳过 ${squad.yamlRel}：${squad.yamlError || squad.yamlTooLarge ? '无法解析 squad.yaml' : 'slug 不合法或与文件夹不同'}`)
    return false
  })
}

/** 策展文件解析出来的对象；没有文件或解析不了都当空。 */
export function readCuration() {
  const curation = loadCuration()
  if (!curation.yamlError && !curation.yamlTooLarge && !curation.symlink) return curation.data
  console.warn(`[策展] 跳过 ${curation.rel}：无法解析，按没有策展处理`)
  return {}
}

/**
 * 网站用的全部货架数据，一次算好，保证三份数据对得上：
 * - bots：Bot 摘要 + 装饰（editorNote、pick、squads）
 * - squads：小队摘要（成员信息已经从 Bot 摘要并进来）
 * - curation：策展（只放 slug）
 * 引用了货架上没有的 Bot 时丢掉那一项并警告；正常构建前 npm run validate 已经拦住这类错误。
 */
export function shelfData(bots = readBots(), { squads = readSquads(), curation = readCuration() } = {}) {
  const names = new Map(bots.map((bot) => [bot.slug, bot.data.name]))
  const namesZh = new Map(bots.map((bot) => [bot.slug, bot.data.nameZh]))
  const base = bots.map((bot) => summarizeBot(bot, {
    asset: (file) => `/bot-assets/${bot.slug}/${encodeURIComponent(file)}`,
    names, namesZh,
  }))
  const bySlug = new Map(base.map((bot) => [bot.slug, bot]))
  const enums = loadEnums()
  const squadList = squads.flatMap((squad) => {
    const summary = summarizeSquad(squad, { bots: bySlug, enums })
    // 只核对写了 bot 的成员；写 role 的是新写岗位，本来就不在货架上。
    const wanted = Array.isArray(squad.data.members) ? squad.data.members.filter((member) => typeof member?.bot === 'string').map((member) => member.bot) : []
    const dropped = wanted.filter((slug) => !bySlug.has(slug))
    if (dropped.length) console.warn(`[小队] ${squad.yamlRel}：成员 ${dropped.join('、')} 不在货架上，已从页面上去掉`)
    if (summary.members.length >= 2) return [summary]
    console.warn(`[小队] 跳过 ${squad.yamlRel}：能显示的成员不到 2 个`)
    return []
  })
  const resolved = resolveCuration(curation, new Set(bySlug.keys()), (where, slug) => {
    console.warn(`[策展] curation/shelf.yaml 的 ${where} 里的 ${slug} 不在货架上，已去掉`)
  })
  return {
    bots: base.map((bot) => decorateSummary(bot, { curation: resolved, squads: squadList })),
    squads: squadList,
    curation: resolved,
  }
}

export function botSummaries(bots, sources) {
  return shelfData(bots, sources).bots
}

/**
 * 首页和搜索面板用的列表数据：完整摘要去掉 about。
 * about 是详情页才用的长文字（82 个 Bot 加起来两百多 KB），不放进每个页面都要加载的包；
 * 详情页的完整摘要走路由参数（site/bots/[slug].paths.mjs），每个 Bot 各自一份。
 */
export function listSummaries(bots, sources) {
  // 只留导入要复制的那一句（试跑句，没写就用第一条开场白），卡片上的「导入」也能顺手复制。
  return botSummaries(bots, sources).map(({ about, ...bot }) => ({ ...bot, trial: about?.trial || about?.starters?.[0] || null }))
}

// 数据加载器的监听范围。VitePress 1.6 的 glob 会从工作区外路径的共同祖先（可能是 /）遍历，
// 所以仓库外的目录不放进来，改由 config 里的定点 watcher（bot-watch.mjs）负责。
export function shelfWatch() {
  const inside = (path) => !relative(ROOT, path).startsWith('..')
  return [
    inside(BOTS_DIR) && `${BOTS_DIR}/**/*`,
    inside(SQUADS_DIR) && `${SQUADS_DIR}/**/*`,
    inside(CURATION_FILE) && CURATION_FILE,
  ].filter(Boolean)
}

export function explanations() {
  const enums = loadEnums()
  return {
    permissions: Object.fromEntries(enums.permissions.map((key) => [key, permissionCopy[key]])),
    quota: Object.fromEntries(enums.quotaCosts.map((key) => [key, quotaCopy[key]])),
  }
}
