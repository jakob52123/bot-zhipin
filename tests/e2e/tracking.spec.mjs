import { test as base, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { makeWebSubmissionLink } from '../../scripts/make-submission-link.mjs'
import { db } from './library-data.mjs'

const test = base.extend({
  wire: [async ({ page, context, baseURL }, use) => {
    const errors = [], events = [], clicks = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL })
    await context.route('**/*', r => new URL(r.request().url()).origin === baseURL ? r.continue() : r.fulfill({ contentType: 'text/html', body: 'mock' }))
    await page.route('**/api/events', r => { events.push(...r.request().postDataJSON().events); return r.fulfill({ status: 204 }) })
    await page.route('**/api/stats', r => r.fulfill({ json: { ok: true, heat: {}, byKind: {}, squads: {} } }))
    await page.route('**/api/click', r => { clicks.push(r.request().postDataJSON()); return r.fulfill({ json: { ok: true } }) })
    // 卡片和侧栏的作者小头像走同源的 /api/avatar（决策 77）；静态预览没有函数，给一张小图，不让 404 记成控制台错误。
    await page.route('**/api/avatar/**', r => r.fulfill({ path: 'site/public/apple-touch-icon.png', contentType: 'image/png' }))
    await use({ events, clicks })
    expect(errors).toEqual([])
  }, { auto: true }],
})
const history = (p, name) => p.evaluate(n => (window.__bzTrack || []).filter(e => e.name === n), name)
const recorded = (p, name, props, extra = {}) => expect.poll(() => history(p, name)).toEqual(expect.arrayContaining([expect.objectContaining({ ...extra, props: expect.objectContaining(props) })]))
const step = (p, name, props = {}) => recorded(p, 'submit_step', { step: name, ...props })
async function go(p, path) { await p.goto(path); await recorded(p, 'page_view', {}) }
// 触发真实 DOM 监听器，取消浏览器默认打开新窗口的动作。
async function link(locator) { await locator.evaluate(a => { a.addEventListener('click', e => e.preventDefault(), { once: true }); a.click() }) }
const slug = 'demo-prd-reviewer', botPath = `/bots/${slug}`, squad = 'demo-squad', squadPath = `/squads/${squad}`
const prompt = 'mollick-writing-mentor', promptPath = `/prompts/${prompt}`, skillPath = '/skills/write-query'

test('首次首页、站外来源、发送批次', async ({ page, wire }) => {
  await page.goto('/', { referer: 'https://example.org/article' })
  await recorded(page, 'page_view', { landing: true, ref: 'example.org' }, { page: 'home' })
  await expect.poll(() => wire.events.filter(e => e.name === 'page_view')).toHaveLength(1)
  expect(await history(page, 'page_view')).toHaveLength(1)
})
test('卡片进入详情', async ({ page }) => { await go(page, '/'); await page.locator(`[data-slug="${slug}"] [data-testid="detail-link"]`).first().click(); await recorded(page, 'page_view', { prev: 'home' }, { slug, page: 'bot' }) })
test('不存在的地址', async ({ page }) => {
  // 使用静态站的 404 壳，但不让浏览器把故意制造的 HTTP 404 计入 console error。
  await page.route('**/bots/not-a-real-bot', r => r.fulfill({ contentType: 'text/html', path: 'site/.vitepress/dist/404.html' }))
  await go(page, '/bots/not-a-real-bot'); await recorded(page, 'page_view', {}, { page: '404' })
})
test('分组、排序、专题和清除只记 filter', async ({ page }) => {
  await go(page, '/')
  const collection = page.getByTestId('collection-card').first()
  for (const [button, where, value] of [[page.locator('[data-role="产品"][data-testid="role-tab"]'), 'shelf_role', '产品'], [page.getByTestId('sort-new'), 'shelf_sort', 'new'], [collection, 'collection', await collection.getAttribute('data-slug')], [page.getByTestId('filter-clear'), 'collection', 'none']]) {
    await button.click(); await recorded(page, 'filter', { where, value, results: await page.getByTestId('bot-card').count() })
  }
  expect(await history(page, 'page_view')).toHaveLength(1)
})
test('详情协议导入、热度、疑似未安装且无出站重复', async ({ page, wire }) => {
  // 不在测试机唤起真实 App。只替换浏览器处理协议的最后一步。
  await page.addInitScript(() => { const append = document.body?.append || Element.prototype.append; Element.prototype.append = function (...nodes) { for (const n of nodes) if (n instanceof HTMLIFrameElement && n.src.startsWith('grokbot:')) n.src = 'about:blank'; return append.apply(this, nodes) } })
  await go(page, botPath); await page.getByTestId('btn-import').click()
  await recorded(page, 'bot_import', { from: 'detail', direct: true, mod: false, trial: 'copied' }, { slug })
  expect(wire.clicks).toHaveLength(1); await recorded(page, 'bot_no_app', {}, { slug }); expect(await history(page, 'outbound')).toHaveLength(0)
})
test('卡片复制', async ({ page }) => { await go(page, '/'); await page.locator(`[data-slug="${slug}"] [data-testid="btn-prompt"]`).first().click(); await recorded(page, 'bot_copy_prompt', { from: 'card', ok: true }, { slug }) })
for (const [name, event, options, count] of [
  ['中键', 'auxclick', { button: 'middle' }, 0],
  ['Cmd/Ctrl 左键', 'click', { modifiers: ['ControlOrMeta'] }, 1],
]) test(`卡片${name}导入`, async ({ page, wire }) => {
  await go(page, '/')
  const button = page.locator(`[data-slug="${slug}"] [data-testid="btn-import"]`).first()
  // 保留真实鼠标事件，只阻止打开外部模板页。
  await button.evaluate((a, type) => a.addEventListener(type, e => e.preventDefault(), { once: true }), event)
  await button.click(options)
  const imported = () => wire.events.filter(e => e.name === 'bot_import' && e.slug === slug)
  await expect.poll(imported).toEqual([expect.objectContaining({ props: { from: 'card', direct: false, mod: true } })])
  expect(wire.clicks).toEqual(count ? [{ slug, kind: 'import' }] : [])
})
test('主推导入', async ({ page }) => { await go(page, '/'); await link(page.getByTestId('featured-import').first()); await recorded(page, 'bot_import', { from: 'featured', direct: false }) })
test('开场白', async ({ page }) => { await go(page, botPath); await page.getByTestId('starter').first().click(); await recorded(page, 'bot_copy_starter', { ok: true, index: 0 }) })
test('小队阵容和步骤成员', async ({ page }) => { await go(page, squadPath); for (const [id, from] of [['member-import','squad_lineup'], ['setup-import','squad_setup']]) { const a = page.getByTestId(id).first(); const member = await a.evaluate(a => a.closest('[data-slug]').dataset.slug); await link(a); await recorded(page, 'bot_import', { from, squad }, { slug: member }) } })
test('小队阵容中键导入不报热度', async ({ page, wire }) => {
  await go(page, squadPath)
  const button = page.getByTestId('member-import').first()
  const member = await button.evaluate(a => {
    a.addEventListener('auxclick', e => e.preventDefault(), { once: true })
    return a.closest('[data-slug]').dataset.slug
  })
  await button.click({ button: 'middle' })
  await expect.poll(() => wire.events.filter(e => e.name === 'bot_import')).toEqual([
    expect.objectContaining({ slug: member, props: expect.objectContaining({ from: 'squad_lineup', squad, mod: true }) }),
  ])
  expect(wire.clicks).toEqual([])
})
test('组队与两种口令', async ({ page }) => { await go(page, squadPath); await page.getByTestId('squad-start').click(); await recorded(page, 'squad_start', {}); for (const which of ['kickoff','tryout']) { await page.getByTestId(`copy-${which}`).click(); await recorded(page, 'squad_copy', { which, ok: true }) } })
for (const translated of [true,false]) test(`列表复制 translated=${translated}`, async ({ page }) => {
  const item = db.prompts.find(i => i.body && !!i.bodyZh === translated)
  await go(page, '/prompts/'); await page.locator(`[data-slug="${item.slug}"] header .copy`).click(); await recorded(page, 'prompt_copy', { from: 'list', lang: translated ? 'translated' : 'original', ok: true }, { slug: item.slug })
})
test('展开后复制，收起不报', async ({ page }) => { await go(page, '/prompts/'); const row = page.locator(`[data-slug="${prompt}"]`); await row.locator('.ix-snip-toggle').click(); await recorded(page, 'prompt_open', {}, { slug: prompt }); await row.locator('.ix-snip-toolbar .copy').click(); await recorded(page, 'prompt_copy', { from: 'list_open', lang: 'translated', ok: true }); await row.locator('.ix-snip-toggle').click(); expect(await history(page, 'prompt_open')).toHaveLength(1) })
for (const [selector, from, lang] of [['.ix-actions .copy','detail_side','translated'], ['.ix-body header .copy','detail_body','translated'], ['.ix-original .copy','detail_en','original']]) test(from, async ({ page }) => { await go(page, promptPath); if (from === 'detail_en') await page.locator('.ix-original summary').click(); await page.locator(selector).click(); await recorded(page, 'prompt_copy', { from, lang, ok: true }, { slug: prompt }) })
for (const [selector, props] of [['.ix-term', { what: 'command', agent: 'Claude Code' }], ['.ix-example', { what: 'example' }]]) test(`Skill ${props.what}`, async ({ page }) => { await go(page, skillPath); await page.locator(`${selector} .copy`).first().click(); await recorded(page, 'skill_copy', { ...props, ok: true, index: 0 }, { slug: 'write-query' }) })
test('作者、出处、许可和仓库出站', async ({ page }) => { await go(page, promptPath); for (const [selector, kind] of [['.ix-meta a:first-of-type','author'], ['.ix-actions a','source'], ['.ix-meta a[data-track-kind="license"]','license'], ['[data-testid="footer-repo"]','repo']]) { await link(page.locator(selector).first()); await recorded(page, 'outbound', { kind }) } })
test('分类结果数、搜索停手和相同词去重', async ({ page }) => {
  await go(page, '/prompts/'); const cat = page.locator('[data-cat]').nth(1), value = await cat.getAttribute('data-cat'); await cat.click(); await recorded(page, 'filter', { where: 'library_cat', value, results: await page.locator('.ix-row').count() }); const input = page.locator('#library-search'); await input.fill('a'); await input.fill(' no-match-xyz '); await recorded(page, 'library_search', { q: 'no-match-xyz', cat: value, results: 0 }); await input.fill('no-match-xyz'); await page.waitForTimeout(1550); expect(await history(page, 'library_search')).toHaveLength(1)
})

test('搜索面板：⌘K 选中跨组第 2 条，只记一次完整命中数', async ({ page, wire }) => {
  await go(page, '/')
  await page.keyboard.press('ControlOrMeta+k')
  const panel = page.getByTestId('search-panel'), input = panel.getByRole('combobox')
  await input.fill('  整理  ')
  // 样例货架先列一个 Bot 和一支小队；等异步的两库都到了，从播报读全数，而不是数可见选项。
  const status = panel.getByRole('status')
  await expect(status).toHaveText(/找到 1 个 Bot，1 支小队，\d+ 条 Prompt.*，\d+ 个 Skill/)
  const counts = [...(await status.textContent()).matchAll(/(\d+) (?:个 Bot|支小队|条 Prompt|个 Skill)/g)]
  const results = counts.reduce((sum, match) => sum + Number(match[1]), 0)
  const options = panel.getByRole('option')
  expect(results).toBeGreaterThan(await options.count())
  await input.press('ArrowDown')
  await expect(options.nth(1)).toHaveAttribute('data-slug', squad)
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true')
  await input.press('Enter')
  await recorded(page, 'page_view', { prev: 'home' }, { page: 'squad', slug: squad })
  await expect.poll(() => wire.events.filter(e => e.name === 'search')).toEqual([
    expect.objectContaining({ page: 'home', slug: squad, props: { q: '整理', results, via: 'shortcut', picked: true, pick_type: 'squad', pick_rank: 1 } }),
  ])
})
test('搜索面板：点击打开、输入后 Esc，只记最终词，不带选中字段', async ({ page }) => {
  await go(page, '/')
  await page.getByTestId('search-trigger').click()
  const input = page.getByTestId('search-input')
  await input.fill('先前的词')
  await input.fill(`  找   ${'🔎'.repeat(41)}  `)
  await input.press('Escape')
  await expect(page.getByTestId('search-panel')).toHaveCount(0)
  expect(await history(page, 'search')).toEqual([
    expect.objectContaining({ props: { q: '找 ' + '🔎'.repeat(38), results: 0, via: 'button', picked: false } }),
  ])
})
test('搜索面板：斜杠打开、输入后点关闭', async ({ page }) => {
  await go(page, botPath)
  await page.keyboard.press('/')
  const q = '全站无此查询词'
  await page.getByTestId('search-input').fill(q)
  await page.getByRole('button', { name: '关闭搜索' }).click()
  await expect(page.getByTestId('search-panel')).toHaveCount(0)
  const searches = await history(page, 'search')
  expect(searches).toEqual([expect.objectContaining({ page: 'bot', props: { q, results: 0, via: 'slash', picked: false } })])
  expect(searches[0]).not.toHaveProperty('slug') // 没选条目，不拿来源详情页的 slug 充数。
})
test('搜索面板：打开不输入就关，不记 search', async ({ page }) => {
  await go(page, '/')
  await page.getByTestId('search-trigger').click()
  const input = page.getByTestId('search-input')
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('')
  await input.press('Escape')
  await expect(page.getByTestId('search-panel')).toHaveCount(0)
  expect(await history(page, 'search')).toEqual([])
})

const bundle = makeWebSubmissionLink('tests/fixtures/bots/demo-prd-reviewer')
async function submission(p, { loggedOut = false, fail = false, linkBundle = true, query = '' } = {}) {
  const data = JSON.parse(readFileSync('site/public/api-data/submit-context.json', 'utf8'))
  await p.route('**/api-data/submit-context.json', r => r.fulfill({ json: { ...data, index: [] } }))
  // Mock expected HTTP failures at fetch boundary so Chromium doesn't emit artificial console errors.
  await p.addInitScript(({ loggedOut, fail }) => { const fetch = window.fetch; window.fetch = function (url, init) { if (loggedOut && url === '/api/auth/me' || fail && url === '/api/submit') return Promise.resolve(Response.json({ error: loggedOut ? 'unauthenticated' : 'submit_disabled' }, { status: loggedOut ? 401 : 503 })); return fetch.call(this, url, init) } }, { loggedOut, fail })
  await p.route('**/api/auth/me', r => r.fulfill({ json: { id: 1, login: 'demo' } })); await p.route('**/api/auth/start', r => r.fulfill({ status: 204 }))
  await p.route('**/api/submit', r => r.fulfill({ json: { ok: true, update: false, slug, pr: { number: 7, url: 'https://github.com/jakob52123/bot-zhipin/pull/7' }, warnings: [] } })); await p.route('**/api/submit/status?*', r => r.fulfill({ json: { state: 'live' } }))
  await go(p, `/submit${query}${linkBundle ? '#' + bundle.token : ''}`); await step(p, 'view'); if (linkBundle) await step(p, 'checked', { ok: true, n: 0 })
}
test('投稿读链接、校验与预览隔离', async ({ page }) => { await submission(page); await step(page, 'read', { via: 'link' }); const before = await page.evaluate(() => window.__bzTrack.length); for (const id of ['btn-import','btn-prompt']) await page.getByTestId('preview-card').getByTestId(id).dispatchEvent('click'); expect(await page.evaluate(() => window.__bzTrack.length)).toBe(before) })
test('投稿登录返回、点击登录', async ({ page }) => { await submission(page, { loggedOut: true, query: '?login=cancelled' }); await step(page, 'login_back', { ok: false, code: 'cancelled' }); await page.getByTestId('login-button').click(); await step(page, 'login_click') })
test('未授权、授权提交与终态', async ({ page }) => { await submission(page); await page.getByTestId('submit-button').dispatchEvent('click'); await step(page, 'submit_click', { ok: false, code: 'license_required' }); await page.clock.install(); await page.getByTestId('license-checkbox').check(); await page.getByTestId('submit-button').click(); await step(page, 'submitted', { mode: 'new', pr: 7 }); await expect(page.getByTestId('submit-result')).toBeVisible(); await page.clock.fastForward(11000); await step(page, 'progress', { code: 'live', pr: 7 }) })
test('失败与备用 Issue', async ({ page }) => { await submission(page, { fail: true }); await page.getByTestId('license-checkbox').check(); await page.getByTestId('submit-button').click(); await step(page, 'submit_fail', { code: 'submit_disabled' }); await link(page.getByTestId('issue-fallback')); await step(page, 'issue_fallback') })
test('内置浏览器、复制投稿提示词与坏包', async ({ page }) => { await page.addInitScript(() => Object.defineProperty(navigator, 'userAgent', { value: 'MicroMessenger' })); await submission(page, { linkBundle: false }); await step(page, 'inapp', { code: '微信' }); await page.getByTestId('copy-submit-prompt').click(); await step(page, 'copy_prompt', { ok: true }); await page.getByTestId('paste-box').locator('summary').click(); await page.getByTestId('paste-input').fill('BZB1:broken'); await page.getByTestId('paste-submit').click(); await step(page, 'bundle_error', { code: 'invalid_bundle' }) })
