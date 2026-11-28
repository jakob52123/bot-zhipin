// 小队和策展的校验内核：纯函数，不读盘。两者都只引用货架上已有的 Bot，所以要传入货架的 slug 列表。
import { validate as checkSquad, schema as squadSchema } from './generated/squad-schema.mjs'
import { validate as checkCuration, schema as curationSchema } from './generated/curation-schema.mjs'
import { reportSchemaErrors } from './schema.mjs'
import { validateDate } from './core.mjs'
import { redact, scanSecrets } from './secrets.mjs'
import { scanPersonalInfo } from './pii.mjs'

/** flow 里代表用户本人的写法；它不是成员，所以也不能拿来当成员的 slug。 */
export const YOU = 'you'

// 和 Bot 校验同一套口径：同一个文件同一个位置只出一条，后来的问题并进去。
export function reporter(prefix, errors, warnings) {
  const seen = new Map()
  return (path, where, problem, fix, warning = false) => {
    const item = { file: redact(`${prefix}${path}`), where: redact(where), problem: redact(problem), fix: redact(fix) }
    const key = `${warning}|${item.file}|${item.where}`
    const previous = seen.get(key)
    if (previous) {
      if (!previous.problem.includes(item.problem)) previous.problem += `；${item.problem}`
      if (!previous.fix.includes(item.fix)) previous.fix += ` ${item.fix}`
      return
    }
    seen.set(key, item)
    ;(warning ? warnings : errors).push(item)
  }
}

export function reportYaml(model, name, report, { tooLarge, missing }) {
  if (model.yamlTooLarge) {
    report(name, '文件大小', tooLarge.problem, tooLarge.fix)
    return false
  }
  if (model.yamlError) {
    const line = Number(/at line (\d+)/.exec(model.yamlError)?.[1] || 1)
    if (model.raw === null) report(name, `第 ${line} 行`, `YAML 格式错误（第 ${line} 行）：找不到 ${name}`, missing)
    else report(name, `第 ${line} 行`, `YAML 格式错误（第 ${line} 行）：无法解析为合法的「键: 值」映射`, '检查这一行及上一行的缩进、冒号、引号、括号和重复字段；顶层必须是「键: 值」映射。')
    return false
  }
  return true
}

// 策展和收录库也复用密钥规则；只有小队投稿启用隐私提醒。
export function scan(name, raw, report, { personalInfo = false } = {}) {
  if (typeof raw !== 'string') return
  const model = { files: [{ path: name, size: new TextEncoder().encode(raw).length, text: raw, format: null }] }
  scanSecrets(model, report)
  if (personalInfo) scanPersonalInfo(model, report)
}

const isMap = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const rows = (value) => Array.isArray(value) ? value.map((item, index) => [item, index]).filter(([item]) => isMap(item)) : []
const nth = (index) => `第 ${index + 1} 个`

/** squads 是 buildSquadModel 的结果；botSlugs 是货架上全部 Bot 的 slug。 */
export function validateSquads(squads, { botSlugs = [], openbotSlugs = [], now = new Date() } = {}) {
  const errors = [], warnings = []
  const shelf = new Set(botSlugs)
  // 小队是一个 Grok Bot 群（导入、接线都按 Grok Bot 写），OpenBot 的 Bot 暂时编不进来。
  const openbots = new Set(openbotSlugs)
  const taken = new Map()
  for (const squad of squads) {
    const report = reporter(`squads/${squad.slug}/`, errors, warnings)
    const name = 'squad.yaml'
    for (const link of squad.symlinks) {
      report(link, '文件类型', '不允许符号链接（文件或目录）', '删除符号链接；小队文件夹里只放一个真实的 squad.yaml。')
    }
    for (const extra of squad.extras) {
      report(extra, '多余文件', '小队文件夹里只能有 squad.yaml 这一个文件', `删除 squads/${squad.slug}/${extra}；Bot 自己的文件放在 bots/<slug>/ 里。`)
    }
    const parsed = reportYaml(squad, name, report, {
      tooLarge: { problem: 'squad.yaml 超过 16KB', fix: '精简 kickoff、setup、notes 的文字；长说明写进成员 Bot 自己的文件。' },
      missing: '在这个小队文件夹里创建 squad.yaml，可参考 squads/ 下已有的小队，填写真实信息。',
    })
    if (parsed) {
      const data = squad.data
      reportSchemaErrors({
        check: checkSquad, schema: squadSchema, data, doc: name, schemaFile: 'schema/squad.schema.json',
        report: (where, problem, fix) => report(name, where, problem, fix),
      })
      if (typeof data.slug === 'string') {
        if (data.slug !== squad.slug) report(name, 'slug', `slug ${data.slug} 和文件夹名不一致（文件夹是 ${squad.slug}）`, `将 slug 改为 ${squad.slug}，或把文件夹改成与 slug 一致的合法名称。`)
        const first = taken.get(data.slug)
        if (first) report(name, 'slug', `slug 重复，与 squads/${first}/squad.yaml 相同`, '给这支小队换一个没人用过的 slug，并把文件夹改成同名。')
        else taken.set(data.slug, squad.slug)
      }
      validateDate({ data, yamlPath: name }, now, report)

      const members = rows(data.members).filter(([member]) => typeof member.bot === 'string')
      const position = new Map()
      for (const [member, index] of members) {
        const where = `members.${index}.bot`
        if (member.bot === YOU) {
          report(name, where, `${nth(index)}成员写的是 ${YOU}；${YOU} 在 flow 里代表用户本人，不能当成员`, '成员只能是货架上的 Bot，把这一项删掉；用户本人不用写进 members。')
          continue
        }
        if (position.has(member.bot)) {
          report(name, where, `成员 ${member.bot} 写了两次（${nth(position.get(member.bot))}和${nth(index)}）`, '每个 Bot 在一支队里只能出现一次，删掉重复的那一项。')
          continue
        }
        position.set(member.bot, index)
        if (!shelf.has(member.bot)) {
          report(name, where, `${nth(index)}成员 ${member.bot} 不在货架上`, '改成 bots/ 里已有的 slug；这个 Bot 还没上架的话，先把它投稿上架，再编进小队。')
        } else if (openbots.has(member.bot)) {
          report(name, where, `${nth(index)}成员 ${member.bot} 是 OpenBot 的 Bot，小队暂时只能编 Grok Bot`, '换成货架上的 Grok Bot，或者把这一项删掉。')
        }
      }

      const leads = members.filter(([member]) => member.lead === true).map(([member]) => member.bot)
      if (leads.length > 1) {
        report(name, 'members', `有 ${leads.length} 个成员标了 lead: true（${leads.join('、')}），一支队只能有一个队长`, '只在队长那一项保留 lead: true，其余的删掉这一行。')
      } else if (data.formation === '带队' && !leads.length && members.length) {
        report(name, 'members', '队形是「带队」，但没有成员标 lead: true', '在队长那一项加一行 lead: true；没有队长的话，把 formation 改成「接力」或「搭伙」。')
      }

      for (const [step, index] of rows(data.flow)) {
        for (const side of ['from', 'to']) {
          const who = step[side]
          if (typeof who !== 'string' || who === YOU || position.has(who)) continue
          report(name, `flow.${index}.${side}`, `flow 第 ${index + 1} 条的 ${side} 写的是 ${who}，它不是这支队的成员`, `改成 members 里某个成员的 slug；代表用户本人就写 ${YOU}。`)
        }
        if (typeof step.from === 'string' && step.from === step.to) {
          report(name, `flow.${index}`, `flow 第 ${index + 1} 条的 from 和 to 都是 ${step.from}，自己交给自己没有意义`, '改成两个不同的成员，或者删掉这一条。')
        }
      }
    }
    scan(name, squad.raw, report, { personalInfo: true })
  }
  return { errors, warnings }
}

/** curation 是 buildCurationModel 的结果；文件不存在时什么都不报。 */
export function validateCuration(curation, { botSlugs = [] } = {}) {
  const errors = [], warnings = []
  const shelf = new Set(botSlugs)
  const report = reporter('curation/', errors, warnings)
  const name = 'shelf.yaml'
  if (curation.symlink) {
    report(name, '文件类型', '策展文件不能是符号链接或文件夹', '删掉它，换成一个真实的 curation/shelf.yaml 文件。')
    return { errors, warnings }
  }
  if (!curation.exists) return { errors, warnings }
  const parsed = reportYaml(curation, name, report, {
    tooLarge: { problem: 'shelf.yaml 超过 64KB', fix: '策展文件只放 slug 和一两句话，删掉用不到的专题和点评。' },
    missing: '创建 curation/shelf.yaml；暂时不策展的话，删掉这个文件也可以。',
  })
  if (parsed) {
    const data = curation.data
    reportSchemaErrors({
      check: checkCuration, schema: curationSchema, data, doc: name, schemaFile: 'schema/curation.schema.json',
      report: (where, problem, fix) => report(name, where, problem, fix),
    })
    const offShelf = '改成 bots/ 里已有的 slug；这个 Bot 已经下架的话，把这一项删掉。'
    const featured = new Map()
    for (const [item, index] of rows(data.featured)) {
      if (typeof item.bot !== 'string') continue
      const where = `featured.${index}.bot`
      if (featured.has(item.bot)) report(name, where, `主推里 ${item.bot} 写了两次（${nth(featured.get(item.bot))}和${nth(index)}）`, '每个 Bot 只主推一次，删掉重复的那一项。')
      else featured.set(item.bot, index)
      if (!shelf.has(item.bot)) report(name, where, `主推的${nth(index)} Bot ${item.bot} 不在货架上`, offShelf)
    }
    if (Array.isArray(data.picks)) data.picks.forEach((slug, index) => {
      if (typeof slug === 'string' && !shelf.has(slug)) report(name, `picks.${index}`, `推荐排序里的${nth(index)} Bot ${slug} 不在货架上`, offShelf)
    })
    const collections = new Map()
    for (const [collection, index] of rows(data.collections)) {
      const label = typeof collection.title === 'string' ? `专题「${collection.title}」` : `${nth(index)}专题`
      if (typeof collection.slug === 'string') {
        if (collections.has(collection.slug)) report(name, `collections.${index}.slug`, `专题的 slug ${collection.slug} 重复（${nth(collections.get(collection.slug))}和${nth(index)}专题）`, '给其中一个专题换一个没用过的 slug。')
        else collections.set(collection.slug, index)
      }
      if (Array.isArray(collection.bots)) collection.bots.forEach((slug, at) => {
        if (typeof slug === 'string' && !shelf.has(slug)) report(name, `collections.${index}.bots.${at}`, `${label}里的 ${slug} 不在货架上`, offShelf)
      })
    }
    if (isMap(data.editorNotes)) for (const slug of Object.keys(data.editorNotes)) {
      if (!shelf.has(slug)) report(name, `editorNotes.${slug}`, `编辑点评写给了 ${slug}，但它不在货架上`, offShelf)
    }
  }
  scan(name, curation.raw, report)
  return { errors, warnings }
}
