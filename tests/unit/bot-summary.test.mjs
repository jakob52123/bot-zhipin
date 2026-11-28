import { expect, it } from 'vitest'
import { buildBotModel } from '../../scripts/lib/bot-model.mjs'
import { join } from 'node:path'
import { summarizeBot, decorateSummary, pitchLines, permissionCopy, quotaCopy, ACCOUNT_PERMISSIONS, SELF_RUNNING_PERMISSION } from '../../scripts/lib/bot-summary.mjs'
import { botSummaries, explanations, readBots, shelfData } from '../../site/.vitepress/data/bots.mjs'
import { ROOT, loadAllBots, loadEnums } from '../../scripts/lib/load-bots.mjs'
import { loadAllSquads } from '../../scripts/lib/load-squads.mjs'
import { loadCuration } from '../../scripts/lib/load-curation.mjs'
import { SITE } from '../../site/.vitepress/meta.mjs'

const model = (extra = {}) => ({
  ...buildBotModel('demo', { files: [] }),
  data: { name: '示例', tagline: '一句真实介绍', author: { name: '作者', github: 'demo' }, templateUrl: 'https://x.ai/bot/demo', ...extra },
})
it('摘要完整字段和默认值稳定', () => {
  expect(summarizeBot(model())).toEqual({
    slug: 'demo', name: '示例', nameZh: null, tagline: '一句真实介绍', category: undefined,
    author: { name: '作者', github: 'demo', url: null, link: 'https://github.com/demo', page: '/authors/demo' },
    platform: 'Grok Bot', templateUrl: 'https://x.ai/bot/demo', projectUrl: null, repoFiles: true, addedAt: undefined, prerequisites: ['无'], quotaCost: undefined,
    permissions: [], needsAccount: false, selfRunning: false, pitch: null, pitches: [], about: null,
    forkedFrom: null, forkedFromName: null, forkedFromNameZh: null, external: false, official: false,
    avatar: null, screenshots: [], skills: [], hasRoutines: false, routinesUrl: null, detailUrl: '/bots/demo',
  })
})
it('中文叫法：name 始终是原名，nameZh 写了才有；类型不对（投稿预览里可能没过校验）当作没写', () => {
  expect(summarizeBot(model({ name: 'Idea Stress Test', nameZh: '点子拆解员' }))).toMatchObject({ name: 'Idea Stress Test', nameZh: '点子拆解员' })
  for (const nameZh of [undefined, null, '', 123, ['点子拆解员'], { zh: '点子拆解员' }]) {
    expect(summarizeBot(model({ name: 'Idea Stress Test', nameZh })), JSON.stringify(nameZh)).toMatchObject({ name: 'Idea Stress Test', nameZh: null })
  }
})
it('改编自：原 Bot 的原名和中文叫法各走各的映射，没有中文叫法是 null', () => {
  const names = new Map([['original', 'Original Bot'], ['plain', '原作']])
  const namesZh = new Map([['original', '原版助理'], ['plain', undefined]])
  expect(summarizeBot(model({ forkedFrom: 'original' }), { names, namesZh })).toMatchObject({ forkedFromName: 'Original Bot', forkedFromNameZh: '原版助理' })
  expect(summarizeBot(model({ forkedFrom: 'plain' }), { names, namesZh })).toMatchObject({ forkedFromName: '原作', forkedFromNameZh: null })
  expect(summarizeBot(model({ forkedFrom: 'original' }), { names })).toMatchObject({ forkedFromName: 'Original Bot', forkedFromNameZh: null })
})
it.each([
  ['官方市场外部收录', true, 'https://x.ai/bot/marketplace/bots/demo', true],
  ['其他域名', true, 'https://example.com/bot/marketplace/bots/demo', false],
  ['无作者网址', true, undefined, false],
  ['非外部收录', false, 'https://x.ai/bot/marketplace/bots/demo', false],
  ['未标记外部收录', undefined, 'https://x.ai/bot/marketplace/bots/demo', false],
  ['普通模板链接', true, 'https://x.ai/bot/demo', false],
])('official 判定：%s', (_label, external, url, expected) => {
  expect(summarizeBot(model({ external, author: { name: '作者', url } })).official).toBe(expected)
})
it('没有策展和小队时，wrapper 等于共享摘要加默认装饰（所有现有 Bot 和 fixtures 逐字相同）', () => {
  for (const bots of [readBots(), loadAllBots('tests/fixtures/bots')]) {
    const names = new Map(bots.map((bot) => [bot.slug, bot.data.name]))
    const namesZh = new Map(bots.map((bot) => [bot.slug, bot.data.nameZh]))
    expect(JSON.stringify(botSummaries(bots, { squads: [], curation: {} })))
      .toBe(JSON.stringify(bots.map((bot) => ({ ...summarizeBot(bot, { names, namesZh }), editorNote: null, pick: null, squads: [] }))))
  }
})
it('作者主页优先于模板，GitHub 优先于主页', () => {
  expect(summarizeBot(model({ author: { name: '作者', url: 'https://example.com' } })).author.link).toBe('https://example.com')
  expect(summarizeBot(model({ author: { name: '作者' } })).author.link).toBe('https://x.ai/bot/demo')
  expect(summarizeBot(model({ author: { github: 'demo', url: 'https://example.com' } })).author.link).toBe('https://github.com/demo')
})
it('自定义资源映射、技能、定时任务和名字映射', () => {
  const bot = model({ forkedFrom: 'original', prerequisites: ['账号'], external: true, pitch: '可以帮你' })
  bot.avatar = {}
  bot.screenshots = [{ file: '截图.png', isImage: true }, { file: 'x.txt', isImage: false }]
  bot.skills = [{ name: 'absent', exists: false }, { name: '技能', exists: true }]
  bot.routines = ''
  const summary = summarizeBot(bot, { asset: (file) => `blob:${file}`, names: new Map([['original', '原作']]) })
  expect(summary.avatar).toBe('blob:avatar.png')
  expect(summary.screenshots).toEqual(['blob:截图.png'])
  expect(summary.skills).toEqual([{ name: '技能', description: '', sourceUrl: `${SITE.repo}/blob/${SITE.branch}/bots/demo/skills/%E6%8A%80%E8%83%BD/SKILL.md` }])
  expect(summary.forkedFromName).toBe('原作')
  expect(summary.hasRoutines).toBe(true)
  expect(summary.routinesUrl).toMatch(/\/routines.md$/)
  expect(summary.external).toBe(true)
  expect(summary.prerequisites).toEqual(['账号'])
})
it('默认资产名编码、改编名称兜底、不修改模型', () => {
  const bot = model({ forkedFrom: 'original', prerequisites: '一个账号' })
  bot.screenshots = [{ file: 'a b.png', isImage: true }]
  const before = JSON.stringify(bot)
  const summary = summarizeBot(bot)
  expect(summary.screenshots).toEqual(['/bot-assets/demo/a%20b.png'])
  expect(summary.forkedFromName).toBe('original')
  expect(summary.prerequisites).toEqual(['一个账号'])
  expect(JSON.stringify(bot)).toBe(before)
})
it('缺失 YAML 的预览摘要仍可创建', () => {
  expect(summarizeBot(buildBotModel('demo', { files: [] })).templateUrl).toBeNull()
})
it('文案导出与 schema 枚举和 explanations 完全一致', () => {
  const enums = loadEnums()
  expect(explanations()).toEqual({ permissions: permissionCopy, quota: quotaCopy })
  expect(Object.keys(permissionCopy)).toEqual(enums.permissions)
  expect(Object.keys(quotaCopy)).toEqual(enums.quotaCosts)
})

// ---- V5：多句台词、about、两个提示、策展和小队的装饰 ----
it('pitch 归一成 pitches：一句、多句、没写、类型不对', () => {
  expect(summarizeBot(model({ pitch: '可以帮你' }))).toMatchObject({ pitch: '可以帮你', pitches: ['可以帮你'] })
  expect(summarizeBot(model({ pitch: ['第一句话', '第二句话', '第三句话'] }))).toMatchObject({ pitch: '第一句话', pitches: ['第一句话', '第二句话', '第三句话'] })
  expect(summarizeBot(model())).toMatchObject({ pitch: null, pitches: [] })
  expect(summarizeBot(model({ pitch: '' }))).toMatchObject({ pitch: null, pitches: [] })
  // 投稿预览的数据可能还没通过校验：不是文字的一律丢掉，不报错。
  expect(summarizeBot(model({ pitch: 123 }))).toMatchObject({ pitch: null, pitches: [] })
  expect(summarizeBot(model({ pitch: ['有效的一句', 5, null, ''] }))).toMatchObject({ pitch: '有效的一句', pitches: ['有效的一句'] })
  expect(pitchLines({ a: 1 })).toEqual([])
})
it('about：没写是 null；写了就把缺的数组补成 []、缺的字符串补成 null', () => {
  expect(summarizeBot(model()).about).toBe(null)
  expect(summarizeBot(model({ about: {} })).about).toBe(null)
  expect(summarizeBot(model({ about: '一句话' })).about).toBe(null)
  expect(summarizeBot(model({ about: ['列表'] })).about).toBe(null)
  expect(summarizeBot(model({ about: { intro: '你给它一份文档，它挑出问题交给你。' } })).about).toEqual({
    intro: '你给它一份文档，它挑出问题交给你。', does: [], trial: null, starters: [], skills: [], routines: [],
    fit: null, notFit: null, cnFit: null, cnNote: null,
  })
  const full = {
    intro: '你给它一份文档，它挑出问题交给你。', does: ['挑问题', '排顺序'], trial: null, starters: ['帮我看这份文档'],
    skills: [{ name: 'check', does: '逐条检查' }],
    routines: [{ what: '检查更新', when: '每天早上', default: '关', quiet: '不打扰' }],
    fit: '要自查的人', notFit: '还没动笔的人', cnFit: '好', cnNote: '直接贴正文不用连账号',
  }
  expect(summarizeBot(model({ about: full })).about).toEqual(full)
  // 坏数据不让摘要报错：数组里只留类型对的，对象里缺的字段是 null。
  expect(summarizeBot(model({ about: { does: '不是列表', starters: ['好的', 3], skills: ['字符串', { name: '只有名字' }], routines: [null, { what: '任务' }] } })).about).toEqual({
    intro: null, does: [], trial: null, starters: ['好的'], skills: [{ name: '只有名字', does: null }],
    routines: [{ what: '任务', when: null, default: null, quiet: null }],
    fit: null, notFit: null, cnFit: null, cnNote: null,
  })
})
it('needsAccount 和 selfRunning 按权限判断，用到的权限名都在 schema 枚举里', () => {
  const flags = (permissions) => { const { needsAccount, selfRunning } = summarizeBot(model({ permissions })); return { needsAccount, selfRunning } }
  expect(flags([])).toEqual({ needsAccount: false, selfRunning: false })
  expect(flags(['联网', '云电脑文件', '代我发消息'])).toEqual({ needsAccount: false, selfRunning: false })
  expect(flags(['外部账号'])).toEqual({ needsAccount: true, selfRunning: false })
  expect(flags(['浏览器 Cookie'])).toEqual({ needsAccount: true, selfRunning: false })
  expect(flags(['定时自动运行'])).toEqual({ needsAccount: false, selfRunning: true })
  expect(flags(['外部账号', '定时自动运行'])).toEqual({ needsAccount: true, selfRunning: true })
  expect(flags('外部账号')).toEqual({ needsAccount: false, selfRunning: false })
  const { permissions } = loadEnums()
  for (const permission of [...ACCOUNT_PERMISSIONS, SELF_RUNNING_PERMISSION]) expect(permissions).toContain(permission)
})
it('decorateSummary：编辑点评、推荐序号、所在小队；不传数据时是默认值，不修改入参', () => {
  const summary = summarizeBot(model())
  const before = JSON.stringify(summary)
  expect(decorateSummary(summary)).toEqual({ ...summary, editorNote: null, pick: null, squads: [] })
  const squads = [
    { slug: 'team-a', name: '甲队', detailUrl: '/squads/team-a', members: [{ bot: 'other', title: '队长', lead: true }, { bot: 'demo', title: '记录员', lead: false }] },
    { slug: 'team-b', name: '乙队', detailUrl: '/squads/team-b', members: [{ bot: 'other', title: '成员', lead: false }] },
    { slug: 'team-c', name: '丙队', detailUrl: '/squads/team-c', members: [{ bot: 'demo', title: '队长', lead: true }] },
  ]
  const decorated = decorateSummary(summary, { curation: { picks: ['other', 'demo'], editorNotes: { demo: '一句点评' } }, squads })
  expect(decorated.editorNote).toBe('一句点评')
  expect(decorated.pick).toBe(1)
  expect(decorated.squads).toEqual([
    { slug: 'team-a', name: '甲队', title: '记录员', lead: false, detailUrl: '/squads/team-a' },
    { slug: 'team-c', name: '丙队', title: '队长', lead: true, detailUrl: '/squads/team-c' },
  ])
  expect(decorateSummary(summary, { curation: { picks: ['demo'], editorNotes: {} } }).pick).toBe(0)
  expect(decorateSummary(summary, { curation: { picks: ['other'], editorNotes: { other: '别人的' } } })).toMatchObject({ pick: null, editorNote: null })
  expect(JSON.stringify(summary)).toBe(before)
})
it('slug 撞上对象自带属性名时不会把内置函数当成点评', () => {
  const summary = { ...summarizeBot(model()), slug: 'constructor' }
  expect(decorateSummary(summary, { curation: { picks: [], editorNotes: {} } }).editorNote).toBe(null)
})
it('fixtures 的货架数据：装饰来自策展和小队文件', () => {
  const { bots } = shelfData(loadAllBots(join(ROOT, 'tests/fixtures/bots')), {
    squads: loadAllSquads(join(ROOT, 'tests/fixtures/squads')),
    curation: loadCuration(join(ROOT, 'tests/fixtures/curation/shelf.yaml')).data,
  })
  const by = Object.fromEntries(bots.map((bot) => [bot.slug, bot]))
  expect(by['demo-prd-reviewer']).toMatchObject({
    pick: 1, editorNote: '示例点评：问题按严重程度排好了，先看前三条就够。', needsAccount: true, selfRunning: false,
    squads: [{ slug: 'demo-squad', name: '示例·周会小队', title: '队长', lead: true, detailUrl: '/squads/demo-squad' }],
  })
  expect(by['demo-prd-reviewer'].about.does).toHaveLength(3)
  expect(by['demo-weekly-digest']).toMatchObject({ pick: 0, editorNote: null, selfRunning: true, about: null, pitches: [] })
  expect(by['demo-external']).toMatchObject({ pick: null, editorNote: null, pitch: '我是外面请来的，链接点开就能用。' })
  // 三个示例里只有外部收录那个带中文叫法；另外两个名字本来就是中文，nameZh 是 null。
  expect(by['demo-external']).toMatchObject({ name: 'Demo External Helper', nameZh: '示例·外部收录' })
  expect(by['demo-prd-reviewer']).toMatchObject({ name: '示例·PRD 评审员', nameZh: null })
  expect(by['demo-weekly-digest']).toMatchObject({ forkedFromName: '示例·PRD 评审员', forkedFromNameZh: null })
  expect(by['demo-external'].pitches).toHaveLength(2)
  expect(by['demo-external'].about.routines).toEqual([
    { what: '检查资料有没有更新', when: '每天早上 9 点', default: '关', quiet: '不打扰' },
    { what: '发一份本周汇总', when: '每周五下午', default: '未说明', quiet: '照发' },
  ])
  expect(by['demo-external'].squads).toEqual([{ slug: 'demo-squad', name: '示例·周会小队', title: '外援', lead: false, detailUrl: '/squads/demo-squad' }])
})
