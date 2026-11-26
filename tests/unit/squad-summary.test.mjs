// 小队摘要（并集、合并、默认值）和网站数据（bots / squads / curation 三份对得上）。
import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import YAML from 'yaml'
import { ROOT, loadAllBots, loadEnums } from '../../scripts/lib/load-bots.mjs'
import { loadAllSquads } from '../../scripts/lib/load-squads.mjs'
import { loadCuration } from '../../scripts/lib/load-curation.mjs'
import { buildSquadModel } from '../../scripts/lib/squad-model.mjs'
import { summarizeSquad } from '../../scripts/lib/squad-summary.mjs'
import { shelfData, shelfWatch, listSummaries, readBots, readSquads, readCuration } from '../../site/.vitepress/data/bots.mjs'
import { syncAssets } from '../../scripts/sync-assets.mjs'

const enums = loadEnums()
const bot = (slug, extra = {}) => ({
  slug, name: `名字-${slug}`, nameZh: null, tagline: `介绍-${slug}`, category: '产品', detailUrl: `/bots/${slug}`, templateUrl: `https://x.ai/bot/${slug}`,
  quotaCost: '低', permissions: [], prerequisites: ['无'], avatar: null, needsAccount: false, selfRunning: false,
  // 下面这些不该被带进成员里。
  author: { name: '作者' }, addedAt: '2026-11-01', about: null, pitches: [], screenshots: [], skills: [],
  ...extra,
})
const shelf = () => new Map([
  bot('lead-bot', { nameZh: '带队的', quotaCost: '中', permissions: ['联网', '云电脑文件'], prerequisites: ['一个飞书账号', '无'], avatar: '/bot-assets/lead-bot/avatar.png' }),
  bot('second-bot', { quotaCost: '高', permissions: ['定时自动运行', '联网', '外部账号'], prerequisites: ['一份名单'], needsAccount: true, selfRunning: true, category: '市场' }),
  bot('third-bot'),
  bot('unused-bot', { quotaCost: '高', permissions: ['代我发消息'] }),
].map((item) => [item.slug, item]))
const base = () => ({
  slug: 'test-squad', name: '测试小队', tagline: '一个队长带两个帮手干活', formation: '带队', origin: '本站编队',
  author: { name: '作者', github: 'someone' }, addedAt: '2026-11-10',
  members: [
    { bot: 'lead-bot', title: '队长', does: '把活分给两位帮手', lead: true },
    { bot: 'second-bot', title: '帮手', does: '负责第一部分的活' },
    { bot: 'third-bot', title: '替补', does: '负责第二部分的活', optional: true },
  ],
})
const summary = (update = () => {}, bots = shelf()) => {
  const data = base(); update(data)
  return summarizeSquad(buildSquadModel('test-squad', { raw: YAML.stringify(data) }), { bots, enums })
}
const temps = []
afterEach(() => { for (const temp of temps.splice(0)) rmSync(temp, { recursive: true, force: true }) })

describe('小队摘要', () => {
  it('最小写法：原字段照搬，可选字段给默认值，字段顺序稳定', () => {
    const result = summary()
    expect(Object.keys(result)).toEqual([
      'slug', 'name', 'tagline', 'formation', 'origin', 'author', 'addedAt', 'members', 'leader',
      'flow', 'setup', 'kickoff', 'tryout', 'notes', 'missing', 'quota', 'permissions', 'prerequisites', 'detailUrl',
    ])
    expect(result).toMatchObject({
      slug: 'test-squad', name: '测试小队', tagline: '一个队长带两个帮手干活', formation: '带队', origin: '本站编队',
      author: { name: '作者', github: 'someone', url: null, link: 'https://github.com/someone', page: '/authors/someone' }, addedAt: '2026-11-10',
      flow: [], setup: [], kickoff: null, tryout: null, notes: [], missing: [], detailUrl: '/squads/test-squad',
    })
  })
  it('作者链接：GitHub 优先，其次主页，都没有就是 null', () => {
    expect(summary((d) => { d.author = { name: '作者', github: 'someone', url: 'https://example.com' } }).author.link).toBe('https://github.com/someone')
    expect(summary((d) => { d.author = { name: '作者', url: 'https://example.com' } }).author).toEqual({ name: '作者', github: null, url: 'https://example.com', link: 'https://example.com', page: null })
    expect(summary((d) => { d.author = { name: '作者' } }).author.link).toBe(null)
  })
  it('成员并入对应 Bot 摘要的 12 个字段（含中文叫法），不多带别的', () => {
    const [lead, second, third] = summary().members
    expect(lead).toEqual({
      bot: 'lead-bot', title: '队长', does: '把活分给两位帮手', lead: true, optional: false, custom: false, brief: null,
      name: '名字-lead-bot', nameZh: '带队的', tagline: '介绍-lead-bot', category: '产品', detailUrl: '/bots/lead-bot', templateUrl: 'https://x.ai/bot/lead-bot',
      quotaCost: '中', permissions: ['联网', '云电脑文件'], prerequisites: ['一个飞书账号', '无'], avatar: '/bot-assets/lead-bot/avatar.png',
      needsAccount: false, selfRunning: false,
    })
    expect(second).toMatchObject({ bot: 'second-bot', nameZh: null, lead: false, optional: false, category: '市场', quotaCost: '高', needsAccount: true, selfRunning: true })
    expect(third).toMatchObject({ bot: 'third-bot', title: '替补', lead: false, optional: true })
    for (const member of [lead, second, third]) expect(Object.keys(member)).toHaveLength(19)
  })
  it('leader 是队长的 slug；没有队长是 null', () => {
    expect(summary().leader).toBe('lead-bot')
    expect(summary((d) => { d.formation = '搭伙'; delete d.members[0].lead }).leader).toBe(null)
    expect(summary((d) => { d.members[0].lead = false; d.members[2].lead = true }).leader).toBe('third-bot')
  })
  it('额度：max 取成员里最高的一档（按 schema 枚举的顺序比），perMember 逐个列出', () => {
    expect(summary().quota).toEqual({
      max: '高',
      perMember: [{ bot: 'lead-bot', quotaCost: '中' }, { bot: 'second-bot', quotaCost: '高' }, { bot: 'third-bot', quotaCost: '低' }],
    })
    expect(summary((d) => { d.members = [d.members[0], d.members[2]] }).quota.max).toBe('中')
    expect(summary((d) => { d.members = [d.members[2], { bot: 'third-bot', title: '重复', does: '同一个 Bot 再来一次' }] }).quota.max).toBe('低')
    // 额度写错的成员不参与比较；一个能比的都没有就是 null。
    const odd = shelf(); odd.get('lead-bot').quotaCost = '超高'; odd.get('second-bot').quotaCost = undefined
    expect(summary(() => {}, odd).quota.max).toBe('低')
    odd.get('third-bot').quotaCost = null
    expect(summary(() => {}, odd).quota.max).toBe(null)
  })
  it('权限：成员的并集，按 schema 枚举顺序排，每项写明是谁用', () => {
    const result = summary().permissions
    expect(result).toEqual([
      { permission: '云电脑文件', bots: ['lead-bot'] },
      { permission: '外部账号', bots: ['second-bot'] },
      { permission: '联网', bots: ['lead-bot', 'second-bot'] },
      { permission: '定时自动运行', bots: ['second-bot'] },
    ])
    const order = result.map((item) => enums.permissions.indexOf(item.permission))
    expect(order).toEqual([...order].sort((a, b) => a - b))
    // 不在队里的 Bot 的权限不算；都不用权限时是空数组。
    expect(result.some((item) => item.permission === '代我发消息')).toBe(false)
    expect(summary((d) => { d.members = [d.members[2], d.members[2]] }).permissions).toEqual([])
  })
  it('准备事项：按成员列出，内容是「无」的不列', () => {
    expect(summary().prerequisites).toEqual([
      { bot: 'lead-bot', items: ['一个飞书账号'] },
      { bot: 'second-bot', items: ['一份名单'] },
    ])
    expect(summary((d) => { d.members = [d.members[2], d.members[2]] }).prerequisites).toEqual([])
  })
  it('可选字段写了就照搬', () => {
    const result = summary((d) => {
      d.flow = [{ from: 'you', to: 'lead-bot', what: '一份需求' }, { from: 'lead-bot', to: 'second-bot', what: '任务简报' }]
      d.setup = [{ title: '放进同一个分区', detail: '在侧栏里把这几个 Bot 拖到一起。' }]
      d.kickoff = '你是队长，另外两位是帮手。'
      d.tryout = '帮我把这件事拆一下。'
      d.notes = ['替补不装也能跑。']
      d.missing = [{ name: 'Fourth Helper', does: '原本负责最后的检查' }]
    })
    expect(result.flow).toEqual([{ from: 'you', to: 'lead-bot', what: '一份需求' }, { from: 'lead-bot', to: 'second-bot', what: '任务简报' }])
    expect(result.setup).toEqual([{ title: '放进同一个分区', detail: '在侧栏里把这几个 Bot 拖到一起。' }])
    expect(result).toMatchObject({ kickoff: '你是队长，另外两位是帮手。', tryout: '帮我把这件事拆一下。', notes: ['替补不装也能跑。'] })
    expect(result.missing).toEqual([{ name: 'Fourth Helper', does: '原本负责最后的检查' }])
  })
  it('不在货架上的成员丢掉，引用它的 flow 一起丢掉；并集和额度只算留下的', () => {
    const bots = shelf(); bots.delete('second-bot')
    const result = summary((d) => {
      d.flow = [{ from: 'lead-bot', to: 'second-bot', what: '任务简报' }, { from: 'second-bot', to: 'you', what: '做好的结果' }, { from: 'lead-bot', to: 'third-bot', what: '另一份简报' }]
    }, bots)
    expect(result.members.map((member) => member.bot)).toEqual(['lead-bot', 'third-bot'])
    expect(result.flow).toEqual([{ from: 'lead-bot', to: 'third-bot', what: '另一份简报' }])
    expect(result.quota).toEqual({ max: '中', perMember: [{ bot: 'lead-bot', quotaCost: '中' }, { bot: 'third-bot', quotaCost: '低' }] })
    expect(result.permissions.map((item) => item.permission)).toEqual(['云电脑文件', '联网'])
    expect(result.prerequisites).toEqual([{ bot: 'lead-bot', items: ['一个飞书账号'] }])
  })
  it('新写岗位：不查货架，bot 放 role 代号，名字是岗位名，带 brief；不算额度和权限，flow 照留', () => {
    const brief = '职责：开工前判断材料够不够。输入：任务卡和原句。产出：已知事实和缺口两列。'
    const result = summary((d) => {
      d.members[2] = { role: 'unused-bot', title: '材料核对员', does: '开工前列明已知事实与缺口', brief }
      d.flow = [{ from: 'lead-bot', to: 'unused-bot', what: '任务卡' }, { from: 'unused-bot', to: 'you', what: '缺口表' }]
    })
    const custom = result.members[2]
    expect(custom).toMatchObject({
      bot: 'unused-bot', custom: true, brief, name: '材料核对员', nameZh: null, title: '材料核对员',
      detailUrl: null, templateUrl: null, quotaCost: null, permissions: [], prerequisites: [], avatar: null,
    })
    expect(Object.keys(custom)).toHaveLength(19)
    expect(result.flow).toHaveLength(2)
    expect(result.quota.perMember.map((item) => item.bot)).toEqual(['lead-bot', 'second-bot'])
    // 代号碰巧和货架上的 unused-bot 同名，也不能拿那个 Bot 的权限（代我发消息）。
    expect(result.permissions.map((item) => item.permission)).not.toContain('代我发消息')
  })
  it('纯函数：不修改传入的小队和 Bot 摘要，同样输入得到同样输出', () => {
    const bots = shelf()
    const squad = buildSquadModel('test-squad', { raw: YAML.stringify(base()) })
    const before = JSON.stringify([squad, [...bots]])
    const first = summarizeSquad(squad, { bots, enums })
    expect(JSON.stringify([squad, [...bots]])).toBe(before)
    expect(summarizeSquad(squad, { bots, enums })).toEqual(first)
    // 成员里的数组是从 Bot 摘要带过来的同一份数据，页面只读不改。
    expect(first.members[0].permissions).toEqual(bots.get('lead-bot').permissions)
  })
  it('没通过校验的数据也不报错', () => {
    for (const data of [null, {}, { members: '不是列表' }, { members: [null, '字符串', { bot: 5 }], flow: [null, {}], setup: '字符串', notes: [1, '有效的一条'], missing: [3] }]) {
      const result = summarizeSquad({ slug: 'odd-squad', data }, { bots: shelf(), enums })
      expect(result).toMatchObject({ slug: 'odd-squad', members: [], leader: null, flow: [], setup: [], missing: [], permissions: [], prerequisites: [], detailUrl: '/squads/odd-squad' })
      expect(result.quota).toEqual({ max: null, perMember: [] })
    }
  })
})

describe('网站数据：bots、squads、curation 三份对得上', () => {
  const fixtures = join(ROOT, 'tests/fixtures')
  const fixtureData = () => shelfData(loadAllBots(join(fixtures, 'bots')), {
    squads: loadAllSquads(join(fixtures, 'squads')), curation: loadCuration(join(fixtures, 'curation/shelf.yaml')).data,
  })
  function consistent({ bots, squads, curation }) {
    const by = new Map(bots.map((item) => [item.slug, item]))
    for (const squad of squads) {
      expect(squad.detailUrl).toBe(`/squads/${squad.slug}`)
      expect(squad.members.length).toBeGreaterThanOrEqual(2)
      for (const member of squad.members) {
        // 新写岗位不在货架上，只核对它带着岗位说明、没挂到同名 Bot 上。
        if (member.custom) {
          expect(member.brief, `${squad.slug} 的新岗位 ${member.bot}`).toBeTruthy()
          expect(by.get(member.bot)?.squads ?? []).not.toContainEqual(expect.objectContaining({ slug: squad.slug }))
          continue
        }
        const source = by.get(member.bot)
        expect(source, `${squad.slug} 的成员 ${member.bot}`).toBeDefined()
        for (const field of ['name', 'tagline', 'category', 'detailUrl', 'templateUrl', 'quotaCost', 'permissions', 'prerequisites', 'avatar', 'needsAccount', 'selfRunning']) {
          expect(member[field], `${member.bot}.${field}`).toEqual(source[field])
        }
        // 反过来：成员 Bot 的摘要上也挂着这支队。
        expect(source.squads).toContainEqual({ slug: squad.slug, name: squad.name, title: member.title, lead: member.lead, detailUrl: squad.detailUrl })
      }
      for (const step of squad.flow) for (const who of [step.from, step.to]) expect(who === 'you' || squad.members.some((member) => member.bot === who)).toBe(true)
    }
    for (const item of bots) {
      expect(item.squads).toHaveLength(squads.filter((squad) => squad.members.some((member) => member.bot === item.slug)).length)
      expect(item.pick).toBe(curation.picks.includes(item.slug) ? curation.picks.indexOf(item.slug) : null)
      expect(item.editorNote).toBe(curation.editorNotes[item.slug] ?? null)
    }
    for (const slug of [...curation.featured.map((item) => item.bot), ...curation.picks, ...curation.collections.flatMap((item) => item.bots), ...Object.keys(curation.editorNotes)]) {
      expect(by.has(slug), `策展里的 ${slug}`).toBe(true)
    }
    expect(curation.featured.length).toBeLessThanOrEqual(3)
    expect(new Set(curation.collections.map((item) => item.slug)).size).toBe(curation.collections.length)
  }

  it('fixtures：一支小队、三个主推、两个专题', () => {
    const data = fixtureData()
    consistent(data)
    expect(data.bots.map((item) => item.slug)).toEqual(['demo-external', 'demo-prd-reviewer', 'demo-weekly-digest'])
    const [squad] = data.squads
    expect(data.squads).toHaveLength(1)
    expect(squad).toMatchObject({
      slug: 'demo-squad', name: '示例·周会小队', formation: '带队', origin: '本站编队', leader: 'demo-prd-reviewer',
      author: { name: '示例作者', github: 'example-user', url: null, link: 'https://github.com/example-user', page: '/authors/example-user' },
      quota: { max: '中', perMember: [{ bot: 'demo-prd-reviewer', quotaCost: '中' }, { bot: 'demo-weekly-digest', quotaCost: '低' }, { bot: 'demo-external', quotaCost: '低' }] },
      permissions: [
        { permission: '云电脑文件', bots: ['demo-weekly-digest'] },
        { permission: '外部账号', bots: ['demo-prd-reviewer'] },
        { permission: '联网', bots: ['demo-prd-reviewer'] },
        { permission: '定时自动运行', bots: ['demo-weekly-digest'] },
        { permission: '代我发消息', bots: ['demo-weekly-digest'] },
      ],
      prerequisites: [{ bot: 'demo-prd-reviewer', items: ['一份写好的 PRD（文字或文档链接）', '飞书或 Notion 账号（可选，用来读在线文档）'] }],
    })
    expect(squad.members.map((member) => [member.bot, member.title, member.lead, member.optional])).toEqual([
      ['demo-prd-reviewer', '队长', true, false], ['demo-weekly-digest', '记录员', false, false], ['demo-external', '外援', false, true],
    ])
    expect(squad.members[0].avatar).toBe('/bot-assets/demo-prd-reviewer/avatar.png')
    expect(squad.flow).toHaveLength(3)
    expect(squad.setup).toHaveLength(2)
    expect(squad.notes).toHaveLength(2)
    expect(squad.missing).toEqual([{ name: '示例·排期员', does: '原本负责把评审意见排进迭代计划' }])
    expect(squad.kickoff).toContain('你是这支小队的队长')
    expect(squad.tryout).toContain('PRD')
    expect(data.curation.featured.map((item) => item.bot)).toEqual(['demo-prd-reviewer', 'demo-weekly-digest', 'demo-external'])
    expect(data.curation.picks).toEqual(['demo-weekly-digest', 'demo-prd-reviewer'])
    expect(data.curation.collections.map((item) => [item.slug, item.bots.length])).toEqual([['demo-starter', 2], ['demo-all', 3]])
    expect(data.curation.editorNotes).toEqual({ 'demo-prd-reviewer': '示例点评：问题按严重程度排好了，先看前三条就够。' })
  })
  it('真实数据：一个人的市场部能出页面，策展一个 slug 都没丢', () => {
    const data = shelfData(readBots(), { squads: readSquads(), curation: readCuration() })
    consistent(data)
    const squad = data.squads.find((item) => item.slug === 'one-person-marketing')
    expect(squad).toMatchObject({ name: '一个人的市场部', formation: '带队', origin: '原作者成套', leader: 'project-manager', detailUrl: '/squads/one-person-marketing' })
    expect(squad.members.map((member) => member.bot)).toEqual(['project-manager', 'market-researcher', 'product-marketer', 'website-ops', 'marketing-analyst'])
    expect(squad.missing.map((item) => item.name)).toEqual(['Performance Marketer'])
    const raw = loadCuration(join(ROOT, 'curation/shelf.yaml')).data
    expect(data.curation.featured).toEqual(raw.featured)
    expect(data.curation.picks).toEqual(raw.picks)
    expect(data.curation.collections).toEqual(raw.collections)
    expect(data.bots.find((item) => item.slug === 'idea-stress-test').pick).toBe(0)
    expect(data.bots.find((item) => item.slug === 'project-manager').squads).toEqual([{ slug: 'one-person-marketing', name: '一个人的市场部', title: '队长', lead: true, detailUrl: '/squads/one-person-marketing' }])
    // 每个 Bot 都落在 schema 的某个分组里。各分组的人数不写死：有人投稿，货架就变。
    const count = Object.fromEntries(enums.categories.map((category) => [category, data.bots.filter((item) => item.category === category).length]))
    expect(Object.values(count).reduce((sum, n) => sum + n, 0)).toBe(data.bots.length)
  })
  it('引用了货架上没有的 Bot：成员和策展项被丢掉；成员不到 2 个的小队不出页面', () => {
    const bots = loadAllBots(join(fixtures, 'bots'))
    const sources = { squads: loadAllSquads(join(fixtures, 'squads')), curation: loadCuration(join(fixtures, 'curation/shelf.yaml')).data }
    const without = (slug) => shelfData(bots.filter((item) => item.slug !== slug), sources)
    const two = without('demo-external')
    consistent(two)
    expect(two.squads[0].members.map((member) => member.bot)).toEqual(['demo-prd-reviewer', 'demo-weekly-digest'])
    expect(two.curation.featured).toHaveLength(2)
    expect(two.curation.collections.map((item) => item.bots)).toEqual([['demo-weekly-digest'], ['demo-prd-reviewer', 'demo-weekly-digest']])
    const one = shelfData(bots.filter((item) => item.slug === 'demo-prd-reviewer'), sources)
    consistent(one)
    expect(one.squads).toEqual([])
    expect(one.bots[0].squads).toEqual([])
  })
  it('没有小队、没有策展时三份都是空的默认值', () => {
    const data = shelfData(loadAllBots(join(fixtures, 'bots')), { squads: [], curation: {} })
    expect(data.squads).toEqual([])
    expect(data.curation).toEqual({ featured: [], picks: [], collections: [], editorNotes: {} })
    for (const item of data.bots) expect(item).toMatchObject({ editorNote: null, pick: null, squads: [] })
  })
  it('三个数据加载器和小队路由读的是同一份数据，监听范围覆盖 Bot、小队、策展三处', async () => {
    const [bots, squads, curation, paths] = await Promise.all([
      import('../../site/.vitepress/data/bots.data.mjs'), import('../../site/.vitepress/data/squads.data.mjs'),
      import('../../site/.vitepress/data/curation.data.mjs'), import('../../site/squads/[slug].paths.mjs'),
    ])
    const data = shelfData()
    // 列表数据不带 about 全文（首页和搜索面板每页都加载）；详情页的完整摘要走路由参数。
    const list = bots.default.load()
    expect(list).toEqual(data.bots.map(({ about, ...bot }) => ({ ...bot, trial: about?.trial || about?.starters?.[0] || null })))
    expect(list).toEqual(listSummaries())
    for (const bot of list) expect(bot).not.toHaveProperty('about')
    expect(data.bots.some((bot) => bot.about !== null)).toBe(true)
    expect(squads.default.load()).toEqual(data.squads)
    expect(curation.default.load()).toEqual(data.curation)
    const routes = paths.default.paths()
    expect(routes.map((route) => route.params.slug)).toEqual(data.squads.map((squad) => squad.slug))
    expect(routes[0].params.squad).toEqual(data.squads[0])
    expect(Object.keys(routes[0].params.copy)).toEqual(['permissions', 'quota'])
    const watch = shelfWatch()
    expect(watch).toEqual([join(ROOT, 'bots/**/*'), join(ROOT, 'squads/**/*'), join(ROOT, 'curation/shelf.yaml')])
    for (const loader of [bots, squads, curation]) expect(loader.default.watch).toEqual(watch)
  })
  it('sync-assets 另写一份 squad-slugs.json，和能出页面的小队一致', () => {
    const temp = mkdtempSync(join(tmpdir(), 'squad-sync-')); temps.push(temp)
    const result = syncAssets({ botsDir: join(fixtures, 'bots'), out: join(temp, 'assets'), apiData: join(temp, 'api') })
    expect(result).toMatchObject({ bots: 3, squads: 1 })
    expect(JSON.parse(readFileSync(join(temp, 'api/squad-slugs.json'), 'utf8'))).toEqual(['demo-squad'])
    expect(JSON.parse(readFileSync(join(temp, 'api/slugs.json'), 'utf8'))).toEqual(['demo-external', 'demo-prd-reviewer', 'demo-weekly-digest'])
    // 旁边没有 squads/ 的 Bot 目录：清单是空数组，不报错。
    const lonely = syncAssets({ botsDir: join(fixtures, 'bots'), squadsDir: join(temp, 'no-squads'), out: join(temp, 'assets2'), apiData: join(temp, 'api2') })
    expect(lonely.squads).toBe(0)
    expect(JSON.parse(readFileSync(join(temp, 'api2/squad-slugs.json'), 'utf8'))).toEqual([])
  })
})
