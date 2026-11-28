import { lookupVersion } from './template-meta.mjs'

async function scan(items, check, concurrency = 4) {
  const results = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await check(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return { total: items.length, findings: results.filter(Boolean) }
}

const sensitivePermissions = ['浏览器 Cookie', '外部账号', '代我发消息']

async function checkBot(data, lookup) {
  const { slug, templateUrl, templateVersion: reviewed = null, permissions = [] } = data
  const base = { slug, templateUrl, name: data.nameZh || data.name, reviewed, permissions,
    sensitive: permissions.some(p => sensitivePermissions.includes(p)) }
  const meta = await lookupVersion(templateUrl, lookup)
  if (!meta.ok) return { ...base, kind: meta.kind === 'not_found' ? 'gone' : 'error', message: meta.message }
  const kind = meta.published === false ? 'unpublished' : reviewed === null ? 'missing' : reviewed !== meta.version ? 'changed' : null
  return kind && { ...base, kind, current: meta.version, updatedAt: meta.updatedAt }
}

function skillChecker(github) {
  const cache = new Map()
  function get(path) {
    if (!cache.has(path)) cache.set(path, github(path))
    return cache.get(path)
  }
  return async data => {
    const source = data.source?.url, base = { slug: data.slug, name: data.title || data.name, source }
    const match = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/tree\/([a-f\d]{40})(?:\/([^?#]*?))?\/?$/i.exec(source)
    if (!match) return { ...base, kind: 'unparsed' }
    const [, repo, reviewed, path = ''] = match
    Object.assign(base, { repo, reviewed, path })
    const root = `/repos/${repo}`
    try {
      const info = await get(root)
      if (info.full_name.toLowerCase() !== repo.toLowerCase()) return { ...base, kind: 'moved', current: info.full_name }
      if (info.archived) return { ...base, kind: 'archived' }
      const branch = info.default_branch
      const diff = await get(`${root}/compare/${reviewed}...${encodeURIComponent(branch)}`)
      const inside = name => typeof name === 'string' && (!path || name === path || name.startsWith(`${path}/`))
      const files = diff.files.filter(f => inside(f.filename) || inside(f.previous_filename)).map(f => inside(f.filename) ? f.filename : f.previous_filename)
      if (diff.files.length >= 300) {
        const since = diff.base_commit.commit.committer.date
        const params = new URLSearchParams({ sha: branch, path, since, per_page: '2' })
        const commits = await get(`${root}/commits?${params}`)
        if (!files.length && !commits.some(c => c.sha !== reviewed)) return null
      } else if (!files.length) return null
      return { ...base, kind: 'changed', files, aheadBy: diff.ahead_by, compareUrl: diff.html_url }
    } catch (e) { return { ...base, kind: e.status === 404 ? 'gone' : 'error', message: e.message } }
  }
}

export async function checkUpstream({ bots, skills, templateMeta, github, checkedAt }) {
  // OpenBot 的 Bot 没有 x.ai 模板可对；写了源项目的，按 projectUrl 里审过的提交比对，和 Skill 同一套。
  const openbot = data => data?.platform === 'OpenBot'
  const templated = bots.filter(data => !openbot(data))
  // 只认 GitHub 上的源项目（校验要求钉在 tree/<提交号> 上）；别处的没法比对，校验时已经提醒过。
  const projects = bots.filter(data => openbot(data) && typeof data.projectUrl === 'string' && data.projectUrl.startsWith('https://github.com/'))
    .map(data => ({ slug: data.slug, name: data.nameZh || data.name, source: { url: data.projectUrl } }))
  const check = skillChecker(github)
  const [b, s, p] = await Promise.all([scan(templated, data => checkBot(data, templateMeta), 2), scan(skills, check), scan(projects, check)])
  // Skill 和源项目都是查 GitHub，「一半以上没查成」合起来算，免得只有一个源项目时一次超时就开 issue。
  const onGithub = { total: s.total + p.total, findings: [...s.findings, ...p.findings] }
  const attention = [b, onGithub].some(({ total, findings }) => findings.some(f => f.kind !== 'error') || (total > 0 && findings.length * 2 >= total))
  return { checkedAt, attention, bots: b, skills: s, projects: p }
}

const TYPES = ['bots', 'skills', 'projects']
// 旧结果（测试、存档）可能没有 projects，当作一个都没查。
const findingsOf = (result, type) => result[type]?.findings ?? []

const dateFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' })
const timeFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

function errorReason(message) {
  if (['查询超时', '网络错误', '模板数据格式不对'].includes(message)) return message
  if (message === 'The operation was aborted due to timeout') return '查询超时'
  if (message === 'fetch failed') return '网络错误'
  const status = /^(?:GitHub )?HTTP (\d{3})$/.exec(message)?.[1]
  if (status === '429') return '请求太频繁，被限流了'
  if (status) return `上游返回错误，状态码 ${status}`
  return '查询失败'
}

function findingLine(type, f) {
  const prefix = `- **${f.name}**（\`${f.slug}\`）：`
  const site = ` · [本站](https://bot.jiachengbo.com/${type === 'projects' ? 'bots' : type}/${f.slug})`
  if (f.kind === 'error') return `${prefix}没查成（${errorReason(f.message)}）`
  if (type === 'bots') {
    const links = ` · [x.ai 模板](${f.templateUrl})${site}`
    switch (f.kind) {
      case 'changed': {
        const permissions = f.sensitive ? f.permissions.filter(p => sensitivePermissions.includes(p)) : []
        const suffix = permissions.length ? `，带${permissions.map(p => `「${p}」`).join('')}` : ''
        return `${prefix}审过 v${f.reviewed}，现在 v${f.current}（${dateFormat.format(new Date(f.updatedAt))} 改的）${suffix}${links}`
      }
      case 'missing': return `${prefix}没记审过的版本，现在是 v${f.current}${links}`
      case 'gone': return `${prefix}x.ai 上找不到这个模板了${site}`
      case 'unpublished': return `${prefix}作者把模板设成不公开了${links}`
    }
  } else {
    switch (f.kind) {
      case 'changed': {
        const scope = f.path ? `的 \`${f.path}\` ` : '的整个仓库'
        const names = f.files.slice(0, 5).map(file => file.startsWith(`${f.path}/`) ? file.slice(f.path.length + 1) : file).join('、')
        const more = f.files.length > 5 ? `等 ${f.files.length} 个` : ''
        const detail = f.files.length ? `改了 ${f.files.length} 个文件（${names}${more}）` : '有新提交（改动太多，没列文件）'
        return `${prefix}\`${f.repo}\` ${scope}在审过之后${detail} · [看改动](${f.compareUrl})${site}`
      }
      case 'gone': return `${prefix}仓库或审过的那次提交找不到了`
      case 'moved': return `${prefix}仓库改名或转移到了 \`${f.current}\``
      case 'archived': return `${prefix}仓库已归档`
      case 'unparsed': return `${prefix}${type === 'projects' ? 'projectUrl' : 'source.url'} 不是 tree/<提交号> 的形式`
    }
  }
}

const headings = ['需要先看', 'Bot 模板改过', '没记审过的版本', 'Skill 上游改过', 'OpenBot 源项目改过', '核对失败']
export function report(result) {
  const sections = headings.map(() => [])
  for (const type of TYPES) for (const f of findingsOf(result, type)) {
    const bot = type === 'bots'
    const section = f.kind === 'error' ? 5 : ['gone', 'unpublished'].includes(f.kind) || (bot && f.kind === 'changed' && f.sensitive) ? 0
      : type === 'projects' ? 4 : !bot ? 3 : f.kind === 'missing' ? 2 : 1
    sections[section].push(findingLine(type, f))
  }
  const text = sections.flatMap((rows, i) => rows.length ? [`## ${headings[i]}\n\n${rows.join('\n')}`] : []).join('\n\n')
  const checked = new Date(result.checkedAt)
  const projects = result.projects?.total ? `、${result.projects.total} 个 OpenBot 源项目` : ''
  const summary = text || `全部和审过的版本一致：${result.bots.total} 个 Bot、${result.skills.total} 个 Skill${projects}。`
  return `核对时间：${dateFormat.format(checked)} ${timeFormat.format(checked)}（北京时间）\n\n${summary}\n\n处理办法见 \`docs/dev/MAINTAINING.md\` 的「上游核对」一节。`
}

const findingKey = (type, f) => `${type.slice(0, -1)}:${f.slug}:${f.kind}:${f.current ?? f.reviewed ?? '-'}`

function reviewFindings(result, map) {
  // Temporary failures stay in the report but are not items to review.
  return TYPES.flatMap(type => findingsOf(result, type).filter(f => f.kind !== 'error').map(f => map(type, f)))
}

export function findingKeys(result) {
  return reviewFindings(result, findingKey).sort()
}

export function findingLines(result) {
  return new Map(reviewFindings(result, (type, f) => [findingKey(type, f), findingLine(type, f)]))
}

export function planIssue({ open, attention, body, keys, lines }) {
  if (!attention) return open ? [{ action: 'comment', body: '复核完了，全部和审过的版本一致。' }, { action: 'close' }] : []
  const marked = `${body}\n\n<!-- upstream-watch keys=${JSON.stringify(keys)} -->`
  if (!open) return [{ action: 'create', body: marked }]
  let previous = []
  try { const parsed = JSON.parse(open.body.match(/<!-- upstream-watch keys=(\[[^\n]*\]) -->\s*$/)[1]); if (Array.isArray(parsed)) previous = parsed } catch { /* no valid previous marker */ }
  const added = keys.filter(k => !previous.includes(k))
  return [{ action: 'update', body: marked }, ...(added.length ? [{ action: 'comment', body: `新增待复核：\n${added.map(k => lines.get(k)).join('\n')}` }] : [])]
}
