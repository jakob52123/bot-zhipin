// OpenBot 平台（决策 76）：校验规则、摘要、安装提示词、小队拦截、上游核对源项目、搜索、真实货架上的那一个。
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import YAML from 'yaml'
import { ROOT, loadBot, loadAllBots, loadEnums } from '../../scripts/lib/load-bots.mjs'
import { buildBotModel } from '../../scripts/lib/bot-model.mjs'
import { buildSquadModel } from '../../scripts/lib/squad-model.mjs'
import { validateModels } from '../../scripts/lib/validate/core.mjs'
import { validateSquads } from '../../scripts/lib/validate/squads.mjs'
import { summarizeBot } from '../../scripts/lib/bot-summary.mjs'
import { buildCatalog } from '../../scripts/lib/catalog.mjs'
import { checkUpstream, report } from '../../scripts/lib/upstream.mjs'
import { CLOUD_FILES, GROK_BOT, LOCAL_FILES, OPENBOT, platformOf } from '../../scripts/lib/platform.mjs'
import { installPrompt, botRepoUrl } from '../../site/.vitepress/meta.mjs'
import { searchBots } from '../../site/.vitepress/theme/search.ts'
import { loadCuration } from '../../scripts/lib/load-curation.mjs'

const now = '2026-11-28T04:00:00Z'
const template = (() => {
  const bot = loadBot('_template', join(ROOT, 'bots'))
  return buildBotModel('_template', { files: bot.files.filter((file) => file.text !== null).map((file) => ({ rel: file.path.slice(bot.dir.length + 1), text: file.text, size: file.text.length })) })
})()
const openbotData = (update = () => {}) => {
  const data = {
    slug: 'local-helper', name: '本机助手', tagline: '在你自己的电脑上替你整理文件', category: '管家', platform: OPENBOT,
    author: { name: '某作者', github: 'someone' }, addedAt: '2026-11-27', prerequisites: ['一台 Mac'], quotaCost: '低',
    permissions: [LOCAL_FILES], external: true,
  }
  update(data)
  return data
}
const role = '# 岗位说明\n\n## 你是谁\n\n你在用户自己的电脑上整理下载文件夹。\n'
const model = (data, { withRole = true, extra = [] } = {}) => buildBotModel(data.slug, { files: [
  { rel: 'bot.yaml', text: YAML.stringify(data), size: 1 },
  ...(withRole ? [{ rel: 'ROLE.md', text: role, size: role.length }] : []),
  ...extra,
] })
const check = (data, options = {}, files) => validateModels([model(data, files)], { template, now, ...options }).errors
const where = (errors) => errors.map((error) => error.where)

describe('平台常量都在 schema 枚举里', () => {
  it('platform、两种文件权限', () => {
    const schema = loadEnums()
    expect(schema.permissions).toEqual(expect.arrayContaining([CLOUD_FILES, LOCAL_FILES]))
    const platforms = JSON.parse(readFileSync(join(ROOT, 'schema/bot.schema.json'), 'utf8')).properties.platform.enum
    expect(platforms).toEqual([GROK_BOT, OPENBOT])
    expect(platformOf({})).toBe(GROK_BOT)
    expect(platformOf({ platform: 'openbot' })).toBe(GROK_BOT)
    expect(platformOf({ platform: OPENBOT })).toBe(OPENBOT)
  })
})

describe('校验', () => {
  it('OpenBot 外部收录：不写 templateUrl、有 ROLE.md 就通过，技能可以没有', () => {
    expect(check(openbotData())).toEqual([])
  })
  it('OpenBot 写了 templateUrl 或 templateVersion 报错', () => {
    const errors = check(openbotData((data) => { data.templateUrl = 'https://x.ai/bot/abc'; data.templateVersion = 2 }))
    expect(where(errors)).toEqual(expect.arrayContaining(['templateUrl', 'templateVersion']))
    expect(errors.find((error) => error.where === 'templateUrl').problem).toContain('OpenBot 的 Bot 不写 templateUrl')
  })
  it('OpenBot 没有 ROLE.md 报错，外部收录也一样', () => {
    const errors = check(openbotData(), {}, { withRole: false })
    expect(errors).toMatchObject([{ file: 'bots/local-helper/ROLE.md', problem: '缺少 ROLE.md' }])
  })
  it('OpenBot 写了的技能照样检查', () => {
    const errors = check(openbotData(), {}, { extra: [{ rel: 'skills/tidy/SKILL.md', text: '没有 frontmatter\n', size: 10 }] })
    expect(errors).toMatchObject([{ file: 'bots/local-helper/skills/tidy/SKILL.md', where: 'frontmatter' }])
  })
  it('两种文件权限各归各的平台', () => {
    expect(check(openbotData((data) => { data.permissions = [CLOUD_FILES] }))).toMatchObject([{ where: 'permissions', problem: expect.stringContaining(CLOUD_FILES) }])
    const grok = openbotData((data) => { delete data.platform; data.templateUrl = 'https://x.ai/bot/abc' })
    expect(check(grok)).toMatchObject([{ where: 'permissions', problem: expect.stringContaining(LOCAL_FILES) }])
  })
  it('Grok Bot（不写 platform）照旧必须有 templateUrl', () => {
    const errors = check(openbotData((data) => { delete data.platform; data.permissions = [] }))
    expect(errors).toMatchObject([{ where: 'templateUrl', problem: expect.stringContaining('缺少必填字段 templateUrl（x.ai 模板分享链接）') }])
  })
  it('网站投稿暂时不收 OpenBot', () => {
    const data = openbotData((item) => { delete item.external })
    const errors = check(data, { policy: { submission: { login: 'someone' } } })
    expect(errors.find((error) => error.where === 'platform')?.problem).toBe('网站投稿暂时只收 Grok Bot')
  })
  it('projectUrl：https；GitHub 上的要钉在提交上，别处的只提醒', () => {
    const run = (url) => validateModels([model(openbotData((data) => { data.projectUrl = url }))], { template, now })
    expect(where(run('http://example.com').errors)).toEqual(['projectUrl'])
    expect(run('https://github.com/o/r').errors).toMatchObject([{ where: 'projectUrl', problem: 'GitHub 上的源项目要钉在审过的那次提交上' }])
    expect(run(`https://github.com/o/r/tree/${'c'.repeat(40)}`)).toEqual({ errors: [], warnings: [] })
    expect(run(`https://github.com/o/r/tree/${'c'.repeat(40)}/sub/dir`).errors).toEqual([])
    expect(run('https://gitee.com/o/r')).toMatchObject({ errors: [], warnings: [{ where: 'projectUrl' }] })
  })
})

describe('摘要和机读数据', () => {
  const bot = (data) => summarizeBot(model(data))
  it('OpenBot：平台、没有模板链接、仓库里有文件', () => {
    expect(bot(openbotData((data) => { data.projectUrl = 'https://github.com/o/r' }))).toMatchObject({
      platform: OPENBOT, templateUrl: null, projectUrl: 'https://github.com/o/r', repoFiles: true, external: true,
      author: { link: 'https://github.com/someone' },
    })
  })
  it('外部收录的 Grok Bot 仓库里没有文件；作者投稿的有', () => {
    const grok = (update) => bot(openbotData((data) => { delete data.platform; data.templateUrl = 'https://x.ai/bot/abc'; data.permissions = []; update(data) }))
    expect(grok(() => {})).toMatchObject({ platform: GROK_BOT, repoFiles: false })
    expect(grok((data) => { delete data.external })).toMatchObject({ repoFiles: true })
  })
  it('没有 GitHub 和主页的 OpenBot 作者，作者链接退到源项目', () => {
    expect(bot(openbotData((data) => { data.author = { name: '某作者' }; data.projectUrl = 'https://example.com/p' })).author.link).toBe('https://example.com/p')
  })
  it('catalog：OpenBot 带安装提示词，Grok Bot 的是 null', () => {
    const openbot = { ...bot(openbotData()), detailUrl: '/bots/local-helper' }
    const [entry] = buildCatalog({ bots: [openbot] }).bots
    expect(entry).toMatchObject({ platform: OPENBOT, templateUrl: null, installPrompt: installPrompt('local-helper', OPENBOT), projectUrl: null })
  })
})

describe('安装提示词', () => {
  it('Grok Bot 的原文不变', () => {
    expect(installPrompt('x').split('\n')[0]).toBe(`请帮我安装一个 Bot：${botRepoUrl('x')}`)
    expect(installPrompt('x', GROK_BOT)).toBe(installPrompt('x'))
  })
  it('OpenBot：新建一个 Agent，先说清楚再装，定时任务先不开', () => {
    const text = installPrompt('x', OPENBOT)
    expect(text.split('\n')[0]).toBe(`请帮我在 OpenBot 里新建一个 Agent，照这个 Bot 来装：${botRepoUrl('x')}`)
    expect(text).toContain('等我确认后再新建')
    expect(text).toContain('先建好但不开')
  })
})

describe('小队暂时只能编 Grok Bot', () => {
  const squad = buildSquadModel('mixed', { raw: YAML.stringify({
    slug: 'mixed', name: '混编小队', tagline: '一个队长带一个本机帮手', formation: '带队', origin: '本站编队',
    author: { name: '作者', github: 'someone' }, addedAt: '2026-11-10',
    members: [{ bot: 'lead-bot', title: '队长', does: '派活给帮手', lead: true }, { bot: 'local-helper', title: '帮手', does: '在本机整理文件' }],
  }) })
  it('成员是 OpenBot 的 Bot 报错', () => {
    const { errors } = validateSquads([squad], { botSlugs: ['lead-bot', 'local-helper'], openbotSlugs: ['local-helper'], now })
    expect(errors).toMatchObject([{ where: 'members.1.bot', problem: expect.stringContaining('小队暂时只能编 Grok Bot') }])
  })
  it('不传 openbotSlugs 时和以前一样', () => {
    expect(validateSquads([squad], { botSlugs: ['lead-bot', 'local-helper'], now }).errors).toEqual([])
  })
})

describe('上游核对：OpenBot 不查 x.ai，写了源项目的按审过的提交比对', () => {
  const sha = 'b'.repeat(40)
  const openbot = { slug: 'local-helper', name: '本机助手', platform: OPENBOT, projectUrl: `https://github.com/o/r/tree/${sha}`, permissions: [] }
  const github = vi.fn(async (path) => path.includes('/compare/') ? { files: [{ filename: 'AGENTS.md' }], html_url: 'https://github.com/o/r/compare/x', ahead_by: 1 } : { full_name: 'o/r', default_branch: 'main' })
  it('不调模板接口；源项目改了进单独一节，链接回 Bot 页', async () => {
    const templateMeta = vi.fn()
    const result = await checkUpstream({ bots: [openbot, { slug: 'no-project', name: '没写源项目', platform: OPENBOT }], skills: [], templateMeta, github, checkedAt: now })
    expect(templateMeta).not.toHaveBeenCalled()
    expect(result.bots.total).toBe(0)
    expect(result.projects).toMatchObject({ total: 1, findings: [{ slug: 'local-helper', kind: 'changed', repo: 'o/r', reviewed: sha }] })
    expect(result.attention).toBe(true)
    const text = report(result)
    expect(text).toContain('## OpenBot 源项目改过')
    expect(text).toContain('https://bot.jiachengbo.com/bots/local-helper')
  })
  it('只有一个源项目时，一次没查成不开 issue（和 Skill 合起来算「一半以上没查成」）', async () => {
    const down = vi.fn(async () => { throw Object.assign(new Error('GitHub HTTP 502'), { status: 502 }) })
    const fine = vi.fn(async (path) => path.includes('/compare/') ? { files: [], html_url: '', ahead_by: 0 } : { full_name: path.split('/').slice(2, 4).join('/'), default_branch: 'main' })
    const skills = Array.from({ length: 3 }, (_, i) => ({ slug: `s${i}`, name: `s${i}`, source: { url: `https://github.com/x/y${i}/tree/${sha}` } }))
    const github = vi.fn(async (path) => path.startsWith('/repos/o/r') ? down(path) : fine(path))
    const result = await checkUpstream({ bots: [openbot], skills, templateMeta: vi.fn(), github, checkedAt: now })
    expect(result.projects.findings).toMatchObject([{ kind: 'error' }])
    expect(result.attention).toBe(false)
  })
  it('不在 GitHub 上的源项目不进核对', async () => {
    const github = vi.fn()
    const result = await checkUpstream({ bots: [{ ...openbot, projectUrl: 'https://gitee.com/o/r' }], skills: [], templateMeta: vi.fn(), github, checkedAt: now })
    expect(github).not.toHaveBeenCalled()
    expect(result.projects.total).toBe(0)
  })
  it('全都一致时，摘要里带上源项目个数', async () => {
    const same = vi.fn(async (path) => path.includes('/compare/') ? { files: [], html_url: '', ahead_by: 0 } : { full_name: 'o/r', default_branch: 'main' })
    const result = await checkUpstream({ bots: [openbot], skills: [], templateMeta: vi.fn(), github: same, checkedAt: now })
    expect(report(result)).toContain('全部和审过的版本一致：0 个 Bot、0 个 Skill、1 个 OpenBot 源项目。')
  })
})

describe('搜索', () => {
  const bots = [
    { slug: 'local-helper', name: '本机助手', tagline: '整理文件', platform: OPENBOT },
    { slug: 'grok-one', name: '云端助手', tagline: '整理文件', platform: GROK_BOT },
  ]
  it('搜 openbot 只出 OpenBot 的；搜 bot 不会因为平台名冒出来', () => {
    expect(searchBots(bots, 'openbot').map((bot) => bot.slug)).toEqual(['local-helper'])
    expect(searchBots(bots, 'OpenBot').map((bot) => bot.slug)).toEqual(['local-helper'])
    expect(searchBots(bots, 'bot')).toEqual([])
    expect(searchBots(bots, 'grok').map((bot) => bot.slug)).toEqual(['grok-one'])
  })
})

describe('货架上的百搭剪辑', () => {
  const bot = loadAllBots().find((item) => item.slug === 'video-clip-sop')
  it('是 OpenBot 的外部收录，源项目钉在审过的提交上', () => {
    expect(bot.data).toMatchObject({ platform: OPENBOT, external: true, author: { github: 'CrazyGoudanli' } })
    expect(bot.data.templateUrl).toBeUndefined()
    expect(bot.data.projectUrl).toMatch(/^https:\/\/github\.com\/CrazyGoudanli\/video-clip-sop\/tree\/[a-f\d]{40}$/)
    expect(bot.skills.map((skill) => skill.name)).toEqual(['video-clip-sop-setup'])
  })
  it('在本周主推里', () => {
    expect(loadCuration().data.featured.map((item) => item.bot)).toContain('video-clip-sop')
  })
})
