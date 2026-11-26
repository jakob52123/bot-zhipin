// 小队校验：schema 之外的每条规则各有用例；纯内核直接喂模型，fs 适配器另测。
import { afterEach, describe, expect, it } from 'vitest'
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import YAML from 'yaml'
import { ROOT } from '../../scripts/lib/load-bots.mjs'
import { loadAllSquads, loadSquad, listSquadDirs } from '../../scripts/lib/load-squads.mjs'
import { buildSquadModel, SQUAD_YAML_BYTES } from '../../scripts/lib/squad-model.mjs'
import { validateSquads, YOU } from '../../scripts/lib/validate/squads.mjs'
import { isPublicSquad } from '../../scripts/lib/public-bot.mjs'

const now = '2026-11-14T04:00:00Z'
const shelf = ['lead-bot', 'second-bot', 'third-bot', 'fourth-bot', 'fifth-bot', 'sixth-bot', 'seventh-bot']
const base = () => ({
  slug: 'test-squad', name: '测试小队', tagline: '一个队长带两个帮手干活', formation: '带队', origin: '本站编队',
  author: { name: '作者', github: 'someone' }, addedAt: '2026-11-10',
  members: [
    { bot: 'lead-bot', title: '队长', does: '把活分给两位帮手', lead: true },
    { bot: 'second-bot', title: '帮手', does: '负责第一部分的活' },
    { bot: 'third-bot', title: '帮手', does: '负责第二部分的活', optional: true },
  ],
})
const model = (update = () => {}, slug = 'test-squad') => { const data = base(); update(data); return buildSquadModel(slug, { raw: YAML.stringify(data) }) }
const run = (update, options = {}) => validateSquads([model(update)], { botSlugs: shelf, now, ...options })
const at = (update, where) => run(update).errors.filter((error) => error.where === where)
const long = (n) => '字'.repeat(n)
const temps = []
afterEach(() => { for (const temp of temps.splice(0)) rmSync(temp, { recursive: true, force: true }) })
const temporary = () => { const temp = mkdtempSync(join(tmpdir(), 'squad-test-')); temps.push(temp); return temp }

describe('合法的小队', () => {
  it('最小写法通过；可选字段全写上也通过', () => {
    expect(run()).toEqual({ errors: [], warnings: [] })
    expect(run((data) => {
      data.flow = [{ from: YOU, to: 'lead-bot', what: '一份需求' }, { from: 'lead-bot', to: 'second-bot', what: '任务简报' }, { from: 'second-bot', to: YOU, what: '做好的结果' }]
      data.setup = [{ title: '放进同一个分区', detail: '在侧栏里把这几个 Bot 拖到同一个分区。' }]
      data.kickoff = '你是队长，另外两位是帮手，有活先分给他们。'
      data.tryout = '帮我把这件事拆一下。'
      data.notes = ['第三位是可选成员，不装也能跑。']
      data.missing = [{ name: 'Fourth Helper', does: '原本负责最后的检查' }]
    })).toEqual({ errors: [], warnings: [] })
  })
  it('fixtures 和仓库里的真实小队都通过', () => {
    const fixtures = loadAllSquads(join(ROOT, 'tests/fixtures/squads'))
    expect(fixtures.map((squad) => squad.slug)).toEqual(['demo-squad'])
    expect(validateSquads(fixtures, { botSlugs: ['demo-prd-reviewer', 'demo-weekly-digest', 'demo-external'], now })).toEqual({ errors: [], warnings: [] })
    const real = loadAllSquads(join(ROOT, 'squads'))
    expect(real.map((squad) => squad.slug)).toContain('one-person-marketing')
    const marketing = real.find((squad) => squad.slug === 'one-person-marketing').data
    expect(marketing.members.map((member) => member.bot)).toEqual(['project-manager', 'market-researcher', 'product-marketer', 'website-ops', 'marketing-analyst'])
    expect(marketing.members.find((member) => member.lead).bot).toBe('project-manager')
    expect(marketing.missing.map((item) => item.name)).toEqual(['Performance Marketer'])
  })
})

describe('schema', () => {
  it.each(['slug', 'name', 'tagline', 'formation', 'origin', 'author', 'addedAt', 'members'])('缺必填字段 %s', (field) => {
    const errors = at((data) => { delete data[field] }, field)
    expect(errors).toHaveLength(1)
    expect(errors[0].file).toBe('squads/test-squad/squad.yaml')
    expect(errors[0].problem).toContain(`缺少必填字段 ${field}`)
  })
  it.each([
    ['name 超过 20 字', (d) => { d.name = long(21) }, 'name', '要求 1～20 个字符'],
    ['name 带尖括号', (d) => { d.name = '<b>小队</b>' }, 'name', '不能使用字符 <、>、"'],
    ['tagline 不到 4 字', (d) => { d.tagline = '太短' }, 'tagline', '要求 4～40 个字符'],
    ['tagline 超过 40 字', (d) => { d.tagline = long(41) }, 'tagline', '要求 4～40 个字符'],
    ['formation 不在可选值里', (d) => { d.formation = '乱战' }, 'formation', '可选值：带队、接力、搭伙'],
    ['origin 不在可选值里', (d) => { d.origin = '捡来的' }, 'origin', '可选值：原作者成套、本站编队、社区投稿'],
    ['author 缺 name', (d) => { d.author = { github: 'someone' } }, 'author.name', '缺少必填字段 author.name'],
    ['author.github 格式不对', (d) => { d.author.github = '@someone' }, 'author.github', '格式不正确'],
    ['author.url 不是 https', (d) => { d.author = { name: '作者', url: 'http://example.com' } }, 'author.url', '格式不正确'],
    ['addedAt 格式不对', (d) => { d.addedAt = '2026/11/10' }, 'addedAt', '要求 YYYY-MM-DD'],
    ['只有 1 个成员', (d) => { d.members = d.members.slice(0, 1) }, 'members', '要求至少 2 项'],
    ['有 7 个成员', (d) => { d.members = shelf.map((bot, i) => ({ bot, title: '成员', does: '负责一部分的活', lead: i === 0 })) }, 'members', '最多 6 项'],
    ['成员缺 title', (d) => { delete d.members[1].title }, 'members.1.title', '缺少必填字段 members.1.title'],
    ['成员缺 does', (d) => { delete d.members[1].does }, 'members.1.does', '缺少必填字段 members.1.does'],
    ['成员 title 超过 12 字', (d) => { d.members[1].title = long(13) }, 'members.1.title', '要求 2～12 个字符'],
    ['成员 does 不到 4 字', (d) => { d.members[1].does = '干活' }, 'members.1.does', '要求 4～40 个字符'],
    ['成员 lead 不是布尔值', (d) => { d.members[1].lead = '是' }, 'members.1.lead', '要求 boolean'],
    ['成员里有不认识的字段', (d) => { d.members[1].tittle = '写错了' }, 'members.1.tittle', '是不是想写 title'],
    ['flow 有 13 条', (d) => { d.flow = Array.from({ length: 13 }, () => ({ from: 'lead-bot', to: 'second-bot', what: '任务简报' })) }, 'flow', '最多 12 项'],
    ['flow 缺 what', (d) => { d.flow = [{ from: 'lead-bot', to: 'second-bot' }] }, 'flow.0.what', '缺少必填字段 flow.0.what'],
    ['flow 的 what 超过 20 字', (d) => { d.flow = [{ from: 'lead-bot', to: 'second-bot', what: long(21) }] }, 'flow.0.what', '要求 2～20 个字符'],
    ['setup 有 7 条', (d) => { d.setup = Array.from({ length: 7 }, () => ({ title: '一个步骤', detail: '照着做就行了。' })) }, 'setup', '最多 6 项'],
    ['setup 的 title 超过 20 字', (d) => { d.setup = [{ title: long(21), detail: '照着做就行了。' }] }, 'setup.0.title', '要求 2～20 个字符'],
    ['setup 的 detail 超过 140 字', (d) => { d.setup = [{ title: '一个步骤', detail: long(141) }] }, 'setup.0.detail', '要求 4～140 个字符'],
    ['kickoff 不到 10 字', (d) => { d.kickoff = '太短的口令' }, 'kickoff', '要求 10～500 个字符'],
    ['kickoff 超过 500 字', (d) => { d.kickoff = long(501) }, 'kickoff', '要求 10～500 个字符'],
    ['tryout 超过 100 字', (d) => { d.tryout = long(101) }, 'tryout', '要求 4～100 个字符'],
    ['notes 有 7 条', (d) => { d.notes = Array.from({ length: 7 }, () => '要知道的一件事') }, 'notes', '最多 6 项'],
    ['notes 某条超过 120 字', (d) => { d.notes = [long(121)] }, 'notes.0', '要求 4～120 个字符'],
    ['missing 有 5 条', (d) => { d.missing = Array.from({ length: 5 }, () => ({ name: '某成员', does: '原本负责一件事' })) }, 'missing', '最多 4 项'],
    ['missing 的 does 超过 60 字', (d) => { d.missing = [{ name: '某成员', does: long(61) }] }, 'missing.0.does', '要求 4～60 个字符'],
    ['顶层有不认识的字段', (d) => { d.memebers = [] }, 'memebers', '是不是想写 members'],
  ])('%s', (_label, mutate, where, problem) => {
    const errors = at(mutate, where)
    expect(errors).toHaveLength(1)
    expect(errors[0].problem).toContain(problem)
    expect(errors[0].fix.length).toBeGreaterThan(4)
  })
  it('kickoff、setup.detail、notes 可以带引号和尖括号（只当文字显示），name 和 tagline 不行', () => {
    expect(run((d) => { d.kickoff = '把 "竞品简报" 交给 <定位专员>，再回来告诉我。'; d.notes = ['侧栏里选 "Move to new section"。'] }).errors).toEqual([])
    expect(at((d) => { d.tagline = '带 "引号" 的一句话介绍' }, 'tagline')).toHaveLength(1)
  })
})

describe('slug', () => {
  it('和文件夹不同名', () => {
    const { errors } = validateSquads([model(() => {}, 'other-folder')], { botSlugs: shelf, now })
    expect(errors).toEqual([{
      file: 'squads/other-folder/squad.yaml', where: 'slug',
      problem: 'slug test-squad 和文件夹名不一致（文件夹是 other-folder）',
      fix: '将 slug 改为 other-folder，或把文件夹改成与 slug 一致的合法名称。',
    }])
  })
  it('两支小队写了同一个 slug', () => {
    const { errors } = validateSquads([model(() => {}, 'test-squad'), model(() => {}, 'zz-copy')], { botSlugs: shelf, now })
    const copy = errors.filter((error) => error.file === 'squads/zz-copy/squad.yaml')
    expect(copy).toHaveLength(1)
    expect(copy[0].problem).toContain('slug 重复，与 squads/test-squad/squad.yaml 相同')
    expect(errors.filter((error) => error.file === 'squads/test-squad/squad.yaml')).toEqual([])
  })
  it('小队可以和 Bot 同名（路由不同）', () => {
    expect(validateSquads([model((d) => { d.slug = 'lead-bot' }, 'lead-bot')], { botSlugs: shelf, now }).errors).toEqual([])
  })
})

describe('成员', () => {
  it('成员不在货架上', () => {
    const errors = at((d) => { d.members[2].bot = 'ghost-bot' }, 'members.2.bot')
    expect(errors).toHaveLength(1)
    expect(errors[0].problem).toBe('第 3 个成员 ghost-bot 不在货架上')
    expect(errors[0].fix).toContain('role: ghost-bot')
  })
  it('货架为空时每个成员都报', () => {
    expect(validateSquads([model()], { now }).errors.map((error) => error.where)).toEqual(['members.0.bot', 'members.1.bot', 'members.2.bot'])
  })
  it('同一个 Bot 写了两次', () => {
    const errors = at((d) => { d.members[2].bot = 'second-bot' }, 'members.2.bot')
    expect(errors).toHaveLength(1)
    expect(errors[0].problem).toBe('成员 second-bot 写了两次（第 2 个和第 3 个）')
  })
  it('you 代表用户本人，不能当成员', () => {
    const errors = at((d) => { d.members[2].bot = YOU }, 'members.2.bot')
    expect(errors).toHaveLength(1)
    expect(errors[0].problem).toContain('you 在 flow 里代表用户本人，不能当成员')
    // 即使货架上真有一个叫 you 的 Bot 也不行。
    expect(validateSquads([model((d) => { d.members[2].bot = YOU })], { botSlugs: [...shelf, YOU], now }).errors).toHaveLength(1)
  })
})

describe('队长', () => {
  it('带队：恰好一个 lead 才通过', () => {
    expect(run().errors).toEqual([])
    const none = at((d) => { delete d.members[0].lead }, 'members')
    expect(none).toHaveLength(1)
    expect(none[0].problem).toBe('队形是「带队」，但没有成员标 lead: true')
    expect(none[0].fix).toContain('把 formation 改成「接力」或「搭伙」')
    expect(at((d) => { d.members[0].lead = false }, 'members')).toHaveLength(1)
    const two = at((d) => { d.members[1].lead = true }, 'members')
    expect(two).toHaveLength(1)
    expect(two[0].problem).toBe('有 2 个成员标了 lead: true（lead-bot、second-bot），一支队只能有一个队长')
  })
  it.each(['接力', '搭伙'])('%s：可以没有队长，最多一个', (formation) => {
    expect(run((d) => { d.formation = formation; delete d.members[0].lead }).errors).toEqual([])
    expect(run((d) => { d.formation = formation }).errors).toEqual([])
    const errors = at((d) => { d.formation = formation; d.members[1].lead = true; d.members[2].lead = true }, 'members')
    expect(errors).toHaveLength(1)
    expect(errors[0].problem).toContain('有 3 个成员标了 lead: true')
  })
})

describe('flow', () => {
  it('from、to 必须是成员或 you', () => {
    const errors = run((d) => { d.flow = [{ from: 'fourth-bot', to: 'second-bot', what: '任务简报' }, { from: 'lead-bot', to: 'nobody', what: '任务简报' }] }).errors
    expect(errors.map((error) => error.where)).toEqual(['flow.0.from', 'flow.1.to'])
    expect(errors[0].problem).toBe('flow 第 1 条的 from 写的是 fourth-bot，它不是这支队的成员')
    expect(errors[1].problem).toBe('flow 第 2 条的 to 写的是 nobody，它不是这支队的成员')
    expect(errors[0].fix).toContain('代表用户本人就写 you')
  })
  it('you 在两头都合法，但不能自己交给自己', () => {
    expect(run((d) => { d.flow = [{ from: YOU, to: 'lead-bot', what: '一份需求' }, { from: 'third-bot', to: YOU, what: '做好的结果' }] }).errors).toEqual([])
    for (const who of [YOU, 'lead-bot']) {
      const errors = at((d) => { d.flow = [{ from: who, to: who, what: '任务简报' }] }, 'flow.0')
      expect(errors).toHaveLength(1)
      expect(errors[0].problem).toBe(`flow 第 1 条的 from 和 to 都是 ${who}，自己交给自己没有意义`)
    }
  })
  it('from 格式不对：和「不是成员」并成同一条，不拆成两条', () => {
    const errors = run((d) => { d.flow = [{ from: 'Lead Bot', to: 'second-bot', what: '任务简报' }] }).errors
    expect(errors).toHaveLength(1)
    expect(errors[0].where).toBe('flow.0.from')
    expect(errors[0].problem).toContain('格式不正确')
    expect(errors[0].problem).toContain('它不是这支队的成员')
  })
})

describe('上架日期', () => {
  it.each(['2026-02-30', '2026-13-01'])('不是真实日期：%s', (date) => {
    expect(at((d) => { d.addedAt = date }, 'addedAt')[0].problem).toContain('不是有效日期')
  })
  it('不能晚于今天（北京时间，多 1 天容差）', () => {
    expect(run((d) => { d.addedAt = '2026-11-15' }).errors).toEqual([])
    expect(at((d) => { d.addedAt = '2026-11-16' }, 'addedAt')[0].problem).toContain('不能晚于今天')
  })
})

describe('文件本身', () => {
  it('YAML 写坏了：报行号，不回显原文', () => {
    const { errors } = validateSquads([buildSquadModel('test-squad', { raw: 'slug: test-squad\nname: [没闭合\n' })], { botSlugs: shelf, now })
    expect(errors).toHaveLength(1)
    expect(errors[0].problem).toMatch(/^YAML 格式错误（第 \d+ 行）：无法解析为合法的「键: 值」映射$/)
    expect(JSON.stringify(errors)).not.toContain('没闭合')
  })
  it.each(['', '- a\n- b\n', '只是一句话'])('顶层不是映射：%j', (raw) => {
    const { errors } = validateSquads([buildSquadModel('test-squad', { raw })], { botSlugs: shelf, now })
    expect(errors).toHaveLength(1)
    expect(errors[0].problem).toContain('YAML 格式错误')
  })
  it('文件夹里没有 squad.yaml', () => {
    const { errors } = validateSquads([buildSquadModel('test-squad', { raw: null })], { botSlugs: shelf, now })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ file: 'squads/test-squad/squad.yaml', problem: 'YAML 格式错误（第 1 行）：找不到 squad.yaml' })
    expect(errors[0].fix).toContain('创建 squad.yaml')
  })
  it('超过 16KB', () => {
    const { errors } = validateSquads([buildSquadModel('test-squad', { raw: `# ${'注'.repeat(SQUAD_YAML_BYTES)}\n` })], { botSlugs: shelf, now })
    expect(errors).toEqual([expect.objectContaining({ file: 'squads/test-squad/squad.yaml', where: '文件大小', problem: 'squad.yaml 超过 16KB' })])
  })
  it('多余的文件和符号链接', () => {
    const squad = { ...model(), extras: ['README.md', 'cover'], symlinks: ['link'] }
    const { errors } = validateSquads([squad], { botSlugs: shelf, now })
    expect(errors.map((error) => [error.file, error.where])).toEqual([
      ['squads/test-squad/link', '文件类型'], ['squads/test-squad/README.md', '多余文件'], ['squads/test-squad/cover', '多余文件'],
    ])
    expect(errors[1].problem).toBe('小队文件夹里只能有 squad.yaml 这一个文件')
  })
  it('口令里夹了密钥：报出来并打码', () => {
    const secret = 'gh' + 'p_' + 'a'.repeat(36)
    const { errors } = validateSquads([model((d) => { d.kickoff = `你是队长，登录时用这个令牌 ${secret}` })], { botSlugs: shelf, now })
    expect(errors).toHaveLength(1)
    expect(errors[0].problem).toContain('疑似密钥')
    expect(JSON.stringify(errors)).not.toContain(secret)
  })
  it('报错只有 file / where / problem / fix 四项，路径都以 squads/ 开头', () => {
    const { errors } = run((d) => { d.name = ''; d.members[1].bot = 'ghost-bot'; d.flow = [{ from: 'x-x', to: 'x-x', what: '东西' }] })
    expect(errors.length).toBeGreaterThanOrEqual(3)
    for (const error of errors) {
      expect(Object.keys(error).sort()).toEqual(['file', 'fix', 'problem', 'where'])
      expect(error.file.startsWith('squads/test-squad/')).toBe(true)
    }
  })
})

describe('读盘适配器', () => {
  it('目录不存在当没有小队；下划线和点开头的文件夹不算', () => {
    const dir = temporary()
    expect(listSquadDirs(join(dir, 'absent'))).toEqual([])
    for (const name of ['_template', '.hidden', 'real-squad']) mkdirSync(join(dir, name))
    writeFileSync(join(dir, 'stray.txt'), '不是文件夹')
    expect(listSquadDirs(dir)).toEqual(['real-squad'])
  })
  it('多余文件、子文件夹、符号链接都读成诊断，不跟随链接', () => {
    const dir = temporary()
    cpSync(join(ROOT, 'tests/fixtures/squads/demo-squad'), join(dir, 'demo-squad'), { recursive: true })
    writeFileSync(join(dir, 'demo-squad/notes.md'), '多余')
    mkdirSync(join(dir, 'demo-squad/assets'))
    const outside = join(temporary(), 'secret.yaml')
    writeFileSync(outside, 'slug: leaked\n')
    symlinkSync(outside, join(dir, 'demo-squad/link.yaml'))
    const squad = loadSquad('demo-squad', dir)
    expect(squad.extras).toEqual(['assets', 'notes.md'])
    expect(squad.symlinks).toEqual(['link.yaml'])
    expect(squad.data.slug).toBe('demo-squad')
    expect(squad).toMatchObject({ rel: 'squads/demo-squad', yamlRel: 'squads/demo-squad/squad.yaml' })
    // squad.yaml 本身是符号链接：不读内容。
    rmSync(join(dir, 'demo-squad/squad.yaml'))
    symlinkSync(outside, join(dir, 'demo-squad/squad.yaml'))
    const linked = loadSquad('demo-squad', dir)
    expect(linked.data).toBe(null)
    expect(linked.symlinks).toContain('squad.yaml')
    expect(isPublicSquad(linked)).toBe(false)
  })
  it('整个文件夹是符号链接：不进去读', () => {
    const dir = temporary()
    symlinkSync(join(ROOT, 'tests/fixtures/squads/demo-squad'), join(dir, 'demo-squad'))
    const [squad] = loadAllSquads(dir)
    expect(squad.data).toBe(null)
    expect(squad.symlinks).toEqual(['.'])
    expect(validateSquads([squad], { botSlugs: shelf, now }).errors.some((error) => error.where === '文件类型')).toBe(true)
  })
  it('超限的 squad.yaml 不读进内存，照样报文件太大', () => {
    const dir = temporary()
    mkdirSync(join(dir, 'big-squad'))
    writeFileSync(join(dir, 'big-squad/squad.yaml'), `slug: big-squad\n# ${'x'.repeat(SQUAD_YAML_BYTES)}\n`)
    const squad = loadSquad('big-squad', dir)
    expect(squad.yamlTooLarge).toBe(true)
    expect(squad.raw.includes('big-squad')).toBe(false)
    expect(isPublicSquad(squad)).toBe(false)
  })
  it('上架口径：能解析、slug 合法且和文件夹同名', () => {
    expect(isPublicSquad(model())).toBe(true)
    expect(isPublicSquad(model(() => {}, 'other-folder'))).toBe(false)
    expect(isPublicSquad(buildSquadModel('test-squad', { raw: 'name: [坏' }))).toBe(false)
    expect(isPublicSquad(model((d) => { d.slug = 'Bad_Slug' }, 'Bad_Slug'))).toBe(false)
  })
})

describe('新写岗位（role + brief）', () => {
  const brief = '职责：开工前判断材料够不够。输入：任务卡和原句。产出：已知事实和缺口两列。不做什么：不替用户补信息。'
  const custom = (d) => { d.members[2] = { role: 'material-checker', title: '材料核对员', does: '开工前列明已知事实与缺口', brief } }
  it('货架上没有的岗位写 role 和 brief 就通过；flow 用 role 指它', () => {
    expect(run((d) => {
      custom(d)
      d.flow = [{ from: 'lead-bot', to: 'material-checker', what: '编号任务卡' }, { from: 'material-checker', to: YOU, what: '缺口表' }]
    })).toEqual({ errors: [], warnings: [] })
  })
  it('全是新写岗位、队长也是新写的也通过', () => {
    expect(run((d) => {
      d.members = [
        { role: 'boss', title: '总管', does: '定范围、派活、收件', lead: true, brief },
        { role: 'writer', title: '执行编辑', does: '按任务卡交一版稿', brief },
      ]
      d.flow = [{ from: 'boss', to: 'writer', what: '任务卡' }]
    })).toEqual({ errors: [], warnings: [] })
  })
  it('bot 和 role 都没写', () => {
    const errors = at((d) => { delete d.members[1].bot }, 'members.1')
    expect(errors).toHaveLength(1)
    expect(errors[0].problem).toBe('第 2 个成员既没写 bot 也没写 role')
  })
  it('bot 和 role 同时写', () => {
    const errors = at((d) => { d.members[1].role = 'helper'; d.members[1].brief = brief }, 'members.1')
    expect(errors[0].problem).toBe('第 2 个成员同时写了 bot 和 role')
  })
  it('role 没有 brief', () => {
    const errors = at((d) => { custom(d); delete d.members[2].brief }, 'members.2.brief')
    expect(errors[0].problem).toContain('没有 brief')
  })
  it('货架 Bot 写了 brief', () => {
    const errors = at((d) => { d.members[1].brief = brief }, 'members.1.brief')
    expect(errors[0].problem).toContain('不用写 brief')
  })
  it('role 和别的成员重名、或者写成 you', () => {
    expect(at((d) => { custom(d); d.members[2].role = 'second-bot' }, 'members.2.role')[0].problem).toContain('写了两次')
    expect(at((d) => { custom(d); d.members[2].role = YOU }, 'members.2.role')[0].problem).toContain('不能当成员')
  })
  it('brief 太短被 schema 拦下', () => {
    expect(at((d) => { custom(d); d.members[2].brief = '太短' }, 'members.2.brief')).toHaveLength(1)
  })
})
