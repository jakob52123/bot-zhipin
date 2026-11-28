// 策展文件的校验（schema + 和货架的交叉校验）、网站用的整理函数、全量校验入口和目录解析规则。
import { afterEach, describe, expect, it } from 'vitest'
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import YAML from 'yaml'
import { ROOT, loadAllBots } from '../../scripts/lib/load-bots.mjs'
import { loadCuration } from '../../scripts/lib/load-curation.mjs'
import { buildCurationModel, CURATION_YAML_BYTES } from '../../scripts/lib/squad-model.mjs'
import { validateCuration } from '../../scripts/lib/validate/squads.mjs'
import { resolveCuration } from '../../scripts/lib/curation-summary.mjs'
import { validateAll, validateBots, formatResult } from '../../scripts/validate.mjs'

const now = new Date('2026-11-14T04:00:00Z')
const shelf = ['alpha-bot', 'beta-bot', 'gamma-bot', 'delta-bot']
const base = () => ({
  featured: [{ bot: 'alpha-bot' }, { bot: 'beta-bot' }],
  picks: ['alpha-bot', 'gamma-bot'],
  collections: [
    { slug: 'starter', title: '零门槛上手', blurb: '不用连账号就能用', bots: ['alpha-bot', 'beta-bot'] },
    { slug: 'daily', title: '每天一份简报', blurb: '定好时间自己跑', bots: ['gamma-bot', 'delta-bot', 'alpha-bot'] },
  ],
  editorNotes: { 'alpha-bot': '用过的人都说省事。' },
})
const model = (update = () => {}) => { const data = base(); update(data); return buildCurationModel({ raw: YAML.stringify(data) }) }
const run = (update) => validateCuration(model(update), { botSlugs: shelf })
const at = (update, where) => run(update).errors.filter((error) => error.where === where)
const long = (n) => '字'.repeat(n)
const temps = []
afterEach(() => { for (const temp of temps.splice(0)) rmSync(temp, { recursive: true, force: true }) })
const temporary = () => { const temp = mkdtempSync(join(tmpdir(), 'curation-test-')); temps.push(temp); return temp }

describe('合法的策展', () => {
  it('写全了通过；每一段都可以不写；文件不存在、只有注释也都算空', () => {
    expect(run()).toEqual({ errors: [], warnings: [] })
    for (const key of Object.keys(base())) expect(run((data) => { delete data[key] }).errors, key).toEqual([])
    expect(validateCuration(buildCurationModel({ raw: null }), { botSlugs: [] })).toEqual({ errors: [], warnings: [] })
    for (const raw of ['', '# 暂时不策展\n', '{}\n', 'editorNotes: {}\n']) {
      const curation = buildCurationModel({ raw })
      expect(curation.data).toEqual(raw.startsWith('editorNotes') ? { editorNotes: {} } : {})
      expect(validateCuration(curation, { botSlugs: [] }).errors).toEqual([])
    }
  })
  it('仓库里的策展文件和 fixtures 的策展文件都能读出来，内容符合约定', () => {
    const real = loadCuration(join(ROOT, 'curation/shelf.yaml'))
    expect(real).toMatchObject({ exists: true, yamlError: null, rel: 'curation/shelf.yaml' })
    // 主推、置顶名单、专题都是编辑随时会改的内容，这里不写死是哪几个、有多少个，只查形状：
    // 主推 3 个；置顶名单不空、不重复；每个专题 2–12 个 Bot、不重复。
    expect(real.data.featured).toHaveLength(3)
    expect(real.data.picks.length).toBeGreaterThan(0)
    expect(new Set(real.data.picks).size).toBe(real.data.picks.length)
    expect(real.data.collections.length).toBeGreaterThan(0)
    for (const item of real.data.collections) {
      expect(item.bots.length, item.slug).toBeGreaterThanOrEqual(2)
      expect(item.bots.length, item.slug).toBeLessThanOrEqual(12)
      expect(new Set(item.bots).size, item.slug).toBe(item.bots.length)
    }
    // 编辑点评写给的都是货架上的 Bot。不要求每个 Bot 都有：新投稿进来时还没人写点评。
    const shelfSlugs = new Set(loadAllBots(join(ROOT, 'bots')).map((bot) => bot.slug))
    const noted = Object.keys(real.data.editorNotes)
    expect(noted.length).toBeGreaterThan(0)
    for (const slug of noted) expect(shelfSlugs.has(slug), slug).toBe(true)
    const fixture = loadCuration(join(ROOT, 'tests/fixtures/curation/shelf.yaml'))
    expect(fixture.data.featured).toHaveLength(3)
    expect(fixture.data.collections).toHaveLength(2)
    expect(validateCuration(fixture, { botSlugs: ['demo-prd-reviewer', 'demo-weekly-digest', 'demo-external'] })).toEqual({ errors: [], warnings: [] })
  })
})

describe('schema', () => {
  it.each([
    ['主推超过 3 个', (d) => { d.featured = shelf.map((bot) => ({ bot })) }, 'featured', '最多 3 项'],
    ['主推缺 bot', (d) => { delete d.featured[1].bot }, 'featured.1.bot', '缺少必填字段 featured.1.bot'],
    // 主推卡不再带点评（决策 79）：留着旧的 note 会报不认识的字段。
    ['主推还写着 note', (d) => { d.featured[0].note = '为什么推它的一句话。' }, 'featured.0.note', '不认识的字段 featured.0.note'],
    ['picks 有重复', (d) => { d.picks = ['alpha-bot', 'alpha-bot'] }, 'picks', '含重复项'],
    ['picks 写成一句话', (d) => { d.picks = 'alpha-bot' }, 'picks', '要求 array'],
    ['专题缺 title', (d) => { delete d.collections[0].title }, 'collections.0.title', '缺少必填字段 collections.0.title'],
    ['专题缺 bots', (d) => { delete d.collections[0].bots }, 'collections.0.bots', '缺少必填字段 collections.0.bots'],
    ['专题 slug 格式不对', (d) => { d.collections[0].slug = 'Zero Setup' }, 'collections.0.slug', '格式不正确'],
    ['专题 title 超过 12 字', (d) => { d.collections[0].title = long(13) }, 'collections.0.title', '要求 2～12 个字符'],
    ['专题 title 只有 1 字', (d) => { d.collections[0].title = '短' }, 'collections.0.title', '要求 2～12 个字符'],
    ['专题 blurb 不到 4 字', (d) => { d.collections[0].blurb = '简介' }, 'collections.0.blurb', '要求 4～40 个字符'],
    ['专题 blurb 超过 40 字', (d) => { d.collections[0].blurb = long(41) }, 'collections.0.blurb', '要求 4～40 个字符'],
    ['专题只有 1 个 Bot', (d) => { d.collections[0].bots = ['alpha-bot'] }, 'collections.0.bots', '要求至少 2 项'],
    ['专题超过 12 个 Bot', (d) => { d.collections[0].bots = Array.from({ length: 13 }, (_, i) => `bot-${i}`) }, 'collections.0.bots', '最多 12 项'],
    ['专题里 Bot 重复', (d) => { d.collections[0].bots = ['alpha-bot', 'beta-bot', 'alpha-bot'] }, 'collections.0.bots', '含重复项'],
    ['编辑点评不到 4 字', (d) => { d.editorNotes['alpha-bot'] = '不错' }, 'editorNotes.alpha-bot', '要求 4～100 个字符'],
    ['编辑点评超过 100 字', (d) => { d.editorNotes['alpha-bot'] = long(101) }, 'editorNotes.alpha-bot', '要求 4～100 个字符'],
    ['编辑点评不是文字', (d) => { d.editorNotes['alpha-bot'] = ['列表'] }, 'editorNotes.alpha-bot', '要求 string'],
    ['顶层有不认识的字段', (d) => { d.feature = [] }, 'feature', '是不是想写 featured'],
  ])('%s', (_label, mutate, where, problem) => {
    const errors = at(mutate, where)
    expect(errors).toHaveLength(1)
    expect(errors[0].file).toBe('curation/shelf.yaml')
    expect(errors[0].problem).toContain(problem)
    expect(errors[0].fix.length).toBeGreaterThan(4)
  })
})

describe('和货架的交叉校验', () => {
  const fix = '改成 bots/ 里已有的 slug；这个 Bot 已经下架的话，把这一项删掉。'
  it('主推的 Bot 不在货架上', () => {
    expect(at((d) => { d.featured[1].bot = 'ghost-bot' }, 'featured.1.bot')).toEqual([
      { file: 'curation/shelf.yaml', where: 'featured.1.bot', problem: '主推的第 2 个 Bot ghost-bot 不在货架上', fix },
    ])
  })
  it('推荐排序里的 Bot 不在货架上', () => {
    expect(at((d) => { d.picks.push('ghost-bot') }, 'picks.2')).toEqual([
      { file: 'curation/shelf.yaml', where: 'picks.2', problem: '推荐排序里的第 3 个 Bot ghost-bot 不在货架上', fix },
    ])
  })
  it('专题里的 Bot 不在货架上', () => {
    expect(at((d) => { d.collections[1].bots[1] = 'ghost-bot' }, 'collections.1.bots.1')).toEqual([
      { file: 'curation/shelf.yaml', where: 'collections.1.bots.1', problem: '专题「每天一份简报」里的 ghost-bot 不在货架上', fix },
    ])
  })
  it('编辑点评写给了不在货架上的 Bot', () => {
    expect(at((d) => { d.editorNotes['ghost-bot'] = '写给一个不存在的 Bot。' }, 'editorNotes.ghost-bot')).toEqual([
      { file: 'curation/shelf.yaml', where: 'editorNotes.ghost-bot', problem: '编辑点评写给了 ghost-bot，但它不在货架上', fix },
    ])
  })
  it('四处同时写错：每处各报一条，都指到具体位置', () => {
    const { errors } = run((d) => {
      d.featured[0].bot = 'ghost-a'; d.picks[0] = 'ghost-b'; d.collections[0].bots[0] = 'ghost-c'; d.editorNotes = { 'ghost-d': '写给一个不存在的 Bot。' }
    })
    expect(errors.map((error) => error.where)).toEqual(['featured.0.bot', 'picks.0', 'collections.0.bots.0', 'editorNotes.ghost-d'])
  })
  it('货架为空时所有引用都报错', () => {
    expect(validateCuration(model(), { botSlugs: [] }).errors).toHaveLength(2 + 2 + 5 + 1)
  })
  it('同一个 Bot 主推了两次', () => {
    const errors = at((d) => { d.featured.push({ bot: 'alpha-bot' }) }, 'featured.2.bot')
    expect(errors).toHaveLength(1)
    expect(errors[0].problem).toBe('主推里 alpha-bot 写了两次（第 1 个和第 3 个）')
  })
  it('两个专题用了同一个 slug', () => {
    const errors = at((d) => { d.collections[1].slug = 'starter' }, 'collections.1.slug')
    expect(errors).toHaveLength(1)
    expect(errors[0].problem).toBe('专题的 slug starter 重复（第 1 个和第 2 个专题）')
  })
})

describe('文件本身', () => {
  it('YAML 写坏了：报行号，不回显原文', () => {
    const { errors } = validateCuration(buildCurationModel({ raw: 'featured:\n  - bot: [没闭合\n' }), { botSlugs: shelf })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ file: 'curation/shelf.yaml' })
    expect(errors[0].problem).toMatch(/^YAML 格式错误（第 \d+ 行）/)
    expect(JSON.stringify(errors)).not.toContain('没闭合')
  })
  it('顶层是列表', () => {
    expect(validateCuration(buildCurationModel({ raw: '- a\n- b\n' }), { botSlugs: shelf }).errors[0].problem).toContain('YAML 格式错误')
  })
  it('超过 64KB', () => {
    const { errors } = validateCuration(buildCurationModel({ raw: `# ${'x'.repeat(CURATION_YAML_BYTES)}\n` }), { botSlugs: shelf })
    expect(errors).toEqual([expect.objectContaining({ where: '文件大小', problem: 'shelf.yaml 超过 64KB' })])
  })
  it('是符号链接或文件夹：不读内容', () => {
    const dir = temporary()
    const outside = join(dir, 'outside.yaml')
    writeFileSync(outside, 'picks: [leaked-bot]\n')
    symlinkSync(outside, join(dir, 'shelf.yaml'))
    const linked = loadCuration(join(dir, 'shelf.yaml'))
    expect(linked).toMatchObject({ symlink: true, data: {} })
    expect(validateCuration(linked, { botSlugs: shelf }).errors).toEqual([expect.objectContaining({ where: '文件类型', problem: '策展文件不能是符号链接或文件夹' })])
    mkdirSync(join(dir, 'folder.yaml'))
    expect(loadCuration(join(dir, 'folder.yaml')).symlink).toBe(true)
    expect(loadCuration(join(dir, 'absent.yaml'))).toMatchObject({ exists: false, symlink: false, data: {} })
  })
  it('点评里夹了密钥：报出来并打码', () => {
    const secret = 'gh' + 'p_' + 'b'.repeat(36)
    const { errors } = run((d) => { d.editorNotes['alpha-bot'] = `内部令牌 ${secret}` })
    expect(errors.some((error) => error.problem.includes('疑似密钥'))).toBe(true)
    expect(JSON.stringify(errors)).not.toContain(secret)
  })
})

describe('网站用的策展数据（resolveCuration）', () => {
  const slugs = new Set(shelf)
  it('只放 slug，形状固定；没有文件时四段都是空的', () => {
    expect(resolveCuration(base(), slugs)).toEqual({
      featured: [{ bot: 'alpha-bot' }, { bot: 'beta-bot' }],
      picks: ['alpha-bot', 'gamma-bot'],
      collections: [
        { slug: 'starter', title: '零门槛上手', blurb: '不用连账号就能用', bots: ['alpha-bot', 'beta-bot'] },
        { slug: 'daily', title: '每天一份简报', blurb: '定好时间自己跑', bots: ['gamma-bot', 'delta-bot', 'alpha-bot'] },
      ],
      editorNotes: { 'alpha-bot': '用过的人都说省事。' },
    })
    for (const empty of [null, undefined, {}, [], '一句话']) {
      expect(resolveCuration(empty, slugs)).toEqual({ featured: [], picks: [], collections: [], editorNotes: {} })
    }
  })
  it('不在货架上的 slug 丢掉，每丢一个通知一次；一个 Bot 都不剩的专题不显示', () => {
    const dropped = []
    const data = base()
    data.featured.push({ bot: 'ghost-a' })
    data.picks = ['ghost-b', 'alpha-bot']
    data.collections[0].bots = ['ghost-c', 'ghost-d']
    data.collections[1].bots = ['gamma-bot', 'ghost-e']
    data.editorNotes['ghost-f'] = '写给不存在的 Bot。'
    const result = resolveCuration(data, slugs, (where, slug) => dropped.push(`${where}:${slug}`))
    expect(result.featured.map((item) => item.bot)).toEqual(['alpha-bot', 'beta-bot'])
    expect(result.picks).toEqual(['alpha-bot'])
    expect(result.collections).toEqual([{ slug: 'daily', title: '每天一份简报', blurb: '定好时间自己跑', bots: ['gamma-bot'] }])
    expect(result.editorNotes).toEqual({ 'alpha-bot': '用过的人都说省事。' })
    expect(dropped).toEqual(['featured:ghost-a', 'picks:ghost-b', 'collections.starter:ghost-c', 'collections.starter:ghost-d', 'collections.daily:ghost-e', 'editorNotes:ghost-f'])
  })
  it('没通过校验的数据也不会让它报错：重复的只留第一个，主推最多 3 个，类型不对的跳过，多写的字段不带出去', () => {
    const result = resolveCuration({
      featured: [{ bot: 'alpha-bot', note: '旧的点评' }, { bot: 'alpha-bot' }, 'x', { bot: 'beta-bot' }, { bot: 'gamma-bot' }, { bot: 'delta-bot' }],
      picks: ['alpha-bot', 'alpha-bot', 5],
      collections: [{ slug: 'one', title: '专题', blurb: '说明文字', bots: ['alpha-bot', 'alpha-bot'] }, { slug: 'one', bots: ['beta-bot'] }, { bots: ['beta-bot'] }, null],
      editorNotes: { 'alpha-bot': 5, 'beta-bot': '一句点评' },
    }, slugs)
    expect(result.featured).toEqual([{ bot: 'alpha-bot' }, { bot: 'beta-bot' }, { bot: 'gamma-bot' }])
    expect(result.picks).toEqual(['alpha-bot'])
    expect(result.collections).toEqual([{ slug: 'one', title: '专题', blurb: '说明文字', bots: ['alpha-bot'] }])
    expect(result.editorNotes).toEqual({ 'beta-bot': '一句点评' })
  })
  it('不修改传入的数据', () => {
    const data = base(), before = JSON.stringify(data)
    resolveCuration(data, new Set(['alpha-bot']))
    expect(JSON.stringify(data)).toBe(before)
  })
})

describe('全量校验（Bot + 小队 + 策展）', () => {
  const fixtures = join(ROOT, 'tests/fixtures')
  const promptCount = readdirSync(join(fixtures, 'prompts'), { withFileTypes: true })
    .filter(file => file.isFile() && file.name.endsWith('.yaml')).length
  function sandbox() {
    const dir = temporary()
    for (const name of ['bots', 'squads', 'curation']) cpSync(join(fixtures, name), join(dir, name), { recursive: true })
    return dir
  }
  const cli = (args = [], env = {}) => spawnSync(process.execPath, [join(ROOT, 'scripts/validate.mjs'), ...args], {
    cwd: ROOT, env: { ...process.env, BOTS_DIR: '', SQUADS_DIR: '', CURATION_FILE: '', PROMPTS_DIR: '', SKILLS_DIR: '', ...env }, encoding: 'utf8', timeout: 15000,
  })

  it('真实仓库通过，成功时打印 Bot 数和小队数', () => {
    const result = validateAll({ botsDir: join(ROOT, 'bots') })
    expect(result.errors).toEqual([])
    expect(result.squads.length).toBeGreaterThanOrEqual(1)
    expect(result.warnings.map(w => [w.file, w.where])).toEqual(result.prompts
      .filter(p => p.data.lang === 'en' && p.data.body && !p.data.bodyZh).map(p => [`prompts/${p.name}`, 'bodyZh']))
    expect(formatResult(result).split('\n').at(-1)).toBe(`✓ 校验通过：${result.bots.length} 个 Bot（其中 ${result.bots.filter((bot) => bot.data.external === true).length} 个外部收录），${result.squads.length} 支小队，${result.prompts.length} 条 Prompt，${result.skills.length} 个 Skill`)
  })
  it('fixtures 通过；只校验 Bot 的入口不带小队数', () => {
    const result = validateAll({ botsDir: join(fixtures, 'bots'), now })
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
    expect(formatResult(result)).toBe(`✓ 校验通过：3 个 Bot（其中 1 个外部收录），1 支小队，${promptCount} 条 Prompt，3 个 Skill`)
    expect(formatResult(validateBots({ botsDir: join(fixtures, 'bots'), now }))).toBe('✓ 校验通过：3 个 Bot（其中 1 个外部收录）')
  })
  it('Bot 下架后，引用它的小队和策展都报错，汇总里分开数', () => {
    const dir = sandbox()
    rmSync(join(dir, 'bots/demo-external'), { recursive: true })
    const result = validateAll({ botsDir: join(dir, 'bots'), now })
    expect(result.errors.map((error) => `${error.file}|${error.where}`)).toEqual([
      'squads/demo-squad/squad.yaml|members.2.bot',
      'curation/shelf.yaml|featured.2.bot',
      'curation/shelf.yaml|collections.0.bots.1',
      'curation/shelf.yaml|collections.1.bots.2',
    ])
    const output = formatResult(result)
    expect(output).toContain('✗ squads/demo-squad/squad.yaml\n  位置：members.2.bot\n  问题：第 3 个成员 demo-external 不在货架上\n  改法：')
    expect(output).toContain('✗ curation/shelf.yaml\n  位置：featured.2.bot\n  问题：主推的第 3 个 Bot demo-external 不在货架上\n  改法：')
    expect(output).toContain('校验未通过：1 支小队、策展文件 共 4 处错误。按上面的「改法」逐条修改后，重新运行 npm run validate。')
  })
  it('Bot、小队、策展同时出错：汇总三样都数到', () => {
    const dir = sandbox()
    writeFileSync(join(dir, 'bots/demo-external/bot.yaml'), 'name: [坏掉\n')
    const output = formatResult(validateAll({ botsDir: join(dir, 'bots'), now }))
    // bot.yaml 坏掉的 Bot 自己有 4 条（截图已不是必填，DECISIONS 第 43 条），小队 1 条，策展 3 条。
    expect(output).toContain('校验未通过：1 个 Bot、1 支小队、策展文件 共 8 处错误')
  })
  it('bot.yaml 解析不了的 Bot 不算在货架上（和网站口径一致）', () => {
    const dir = sandbox()
    writeFileSync(join(dir, 'bots/demo-weekly-digest/bot.yaml'), 'slug: other-name\n')
    const where = validateAll({ botsDir: join(dir, 'bots'), now }).errors.filter((error) => !error.file.startsWith('bots/')).map((error) => error.where)
    expect(where).toContain('members.1.bot')
    expect(where).toContain('picks.0')
  })
  it('只给 Bot 目录：小队和策展取它的兄弟目录；兄弟目录不存在就当空', () => {
    const dir = sandbox()
    expect(validateAll({ botsDir: join(dir, 'bots'), now }).squads).toHaveLength(1)
    rmSync(join(dir, 'squads'), { recursive: true })
    rmSync(join(dir, 'curation'), { recursive: true })
    const result = validateAll({ botsDir: join(dir, 'bots'), now })
    expect(result.errors).toEqual([])
    expect(result.squads).toEqual([])
    expect(result.curation.exists).toBe(false)
    // 沙盒只复制了 Bot、小队、策展，旁边没有 prompts/、skills/，也都当空。
    expect(formatResult(result)).toBe('✓ 校验通过：3 个 Bot（其中 1 个外部收录），0 支小队，0 条 Prompt，0 个 Skill')
  })
  it('显式传入的小队目录和策展文件优先', () => {
    const dir = sandbox()
    const elsewhere = temporary()
    cpSync(join(dir, 'squads'), join(elsewhere, 'my-squads'), { recursive: true })
    writeFileSync(join(elsewhere, 'my-shelf.yaml'), 'picks: [ghost-bot]\n')
    rmSync(join(dir, 'squads'), { recursive: true })
    const result = validateAll({ botsDir: join(dir, 'bots'), squadsDir: join(elsewhere, 'my-squads'), curationFile: join(elsewhere, 'my-shelf.yaml'), now })
    expect(result.squads).toHaveLength(1)
    expect(result.errors.map((error) => error.where)).toEqual(['picks.0'])
  })
  it('CLI：默认读仓库的 squads/ 和 curation/；只设 BOTS_DIR 时跟着取兄弟目录', () => {
    const real = cli()
    expect(real.status).toBe(0)
    expect(real.stdout).toMatch(/✓ 校验通过：\d+ 个 Bot（其中 \d+ 个外部收录），[1-9]\d* 支小队，\d+ 条 Prompt，\d+ 个 Skill/)
    const fixture = cli([], { BOTS_DIR: 'tests/fixtures/bots' })
    expect(fixture.status).toBe(0)
    expect(fixture.stdout.trim()).toBe(`✓ 校验通过：3 个 Bot（其中 1 个外部收录），1 支小队，${promptCount} 条 Prompt，3 个 Skill`)
    const viaDir = cli(['--dir', join(fixtures, 'bots')])
    expect(viaDir.stdout.trim()).toBe(`✓ 校验通过：3 个 Bot（其中 1 个外部收录），1 支小队，${promptCount} 条 Prompt，3 个 Skill`)
  })
  it('CLI：SQUADS_DIR、CURATION_FILE 可以单独覆盖；小队或策展出错退出 1', () => {
    const dir = sandbox()
    const bad = join(temporary(), 'shelf.yaml')
    writeFileSync(bad, 'picks: [ghost-bot]\n')
    const curation = cli([], { BOTS_DIR: 'tests/fixtures/bots', CURATION_FILE: bad })
    expect(curation.status).toBe(1)
    expect(curation.stdout).toContain('✗ curation/shelf.yaml\n  位置：picks.0\n  问题：推荐排序里的第 1 个 Bot ghost-bot 不在货架上')
    expect(curation.stdout).toContain('校验未通过：策展文件 共 1 处错误')
    writeFileSync(join(dir, 'squads/demo-squad/squad.yaml'), 'slug: demo-squad\n')
    const squads = cli([], { BOTS_DIR: 'tests/fixtures/bots', SQUADS_DIR: join(dir, 'squads') })
    expect(squads.status).toBe(1)
    expect(squads.stdout).toContain('✗ squads/demo-squad/squad.yaml')
    expect(squads.stdout).toMatch(/校验未通过：1 支小队 共 \d+ 处错误/)
    // 覆盖成空目录：没有小队，照样通过。
    const empty = cli([], { BOTS_DIR: 'tests/fixtures/bots', SQUADS_DIR: join(temporary(), 'none'), CURATION_FILE: join(temporary(), 'none.yaml') })
    expect(empty.status).toBe(0)
    expect(empty.stdout.trim()).toBe(`✓ 校验通过：3 个 Bot（其中 1 个外部收录），0 支小队，${promptCount} 条 Prompt，3 个 Skill`)
  })
})
