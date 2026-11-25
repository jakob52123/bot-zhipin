import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { CONTRIBUTE_URL, DEFAULT_PITCHES, FOOTER, SITE, installPrompt } from '../../site/.vitepress/meta.mjs'
import { renderDesigns } from '../../site/.vitepress/data/design-renderer.mjs'

const weekly = 'demo-weekly-digest'
const reviewer = 'demo-prd-reviewer'
const external = 'demo-external'
const card = (page, slug) => page.locator(`[data-testid="bot-card"][data-slug="${slug}"]`)
const order = (page) => page.getByTestId('bot-card').evaluateAll((nodes) => nodes.map((node) => node.dataset.slug))
const stats = { ok: true, heat: { [external]: 5, [reviewer]: 2 }, byKind: {} }

async function mockStats(page, data = stats) {
  await page.route('**/api/stats', (route) => route.fulfill({ json: data }))
}

test.beforeEach(async ({ context, page }) => {
  await context.route('https://x.ai/**', (route) => route.fulfill({ contentType: 'text/html', body: '<p>模拟导入页面</p>' }))
  await page.route('**/api/click', (route) => route.fulfill({ json: { ok: true, counted: true, heat: 99 } }))
})

test('接口失败：排序留在推荐、热度不占位、链接与外部收录按钮', async ({ page }) => {
  await page.route('**/api/stats', (route) => route.abort())
  await page.goto('/')
  // 默认是「推荐」，它不靠热度（先排编辑置顶的），拿不到热度也不用换排序。
  await expect(page.getByTestId('sort-rec')).toHaveAttribute('aria-pressed', 'true')
  // 默认按分组分段：分组顺序跟 schema 走（产品、内容、管家）。
  expect(await order(page)).toEqual([reviewer, weekly, external])
  // 列表卡只在热度大于 0 时显示热度；拿不到热度就不占位。
  await expect(card(page, weekly).getByTestId('heat')).toHaveCount(0)
  await expect(page.getByTestId('contribute-link')).toHaveAttribute('href', CONTRIBUTE_URL)
  await expect(card(page, reviewer).getByTestId('author-link')).toHaveAttribute('href', '/authors/example-user')
  await expect(card(page, external).getByTestId('author-link')).toHaveAttribute('href', 'https://x.ai/bot/demo-external-000')
  await expect(card(page, external).getByTestId('btn-prompt')).toHaveCount(0)
  await expect(card(page, weekly).getByTestId('detail-link')).toHaveAttribute('href', `/bots/${weekly}`)
})

test('延迟失败不覆盖用户手动排序；HTTP / JSON 失败均可降级', async ({ page }) => {
  let release
  const gate = new Promise((resolve) => { release = resolve })
  await page.route('**/api/stats', async (route) => {
    await gate
    await route.fulfill({ status: 500, json: { ok: false } })
  })
  await page.goto('/')
  await page.getByTestId('sort-hot').click()
  const response = page.waitForResponse('**/api/stats')
  release()
  await response
  await expect(page.getByTestId('sort-hot')).toHaveAttribute('aria-pressed', 'true')
  await expect(card(page, weekly).getByTestId('heat')).toHaveCount(0)
  await page.unroute('**/api/stats')
  await page.route('**/api/stats', (route) => route.fulfill({ contentType: 'text/html', body: '<h1>没有后端</h1>' }))
  await page.reload()
  await expect(page.getByTestId('sort-rec')).toHaveAttribute('aria-pressed', 'true')
})

test('热度更新不跳位、切换后重排、复制反馈与导入上报', async ({ page, context, baseURL }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL })
  await mockStats(page)
  const clicks = []
  await page.route('**/api/click', (route) => {
    clicks.push(route.request().postDataJSON())
    return route.fulfill({ json: { ok: true, counted: true, heat: 99 } })
  })
  // 三个示例 Bot 各在一个分组里，分组显示时看不出排序；进「示例·全部」专题（三个都在、不分组）来看。
  await page.goto('/?c=demo-all')
  await expect(card(page, external).getByTestId('heat')).toHaveText('热度 5')
  // 推荐 = 编辑在专题里排的顺序；切到最热才按热度排。
  expect(await order(page)).toEqual([reviewer, weekly, external])
  await page.getByTestId('sort-hot').click()
  expect(await order(page)).toEqual([external, reviewer, weekly])
  await expect(card(page, weekly).getByTestId('heat')).toHaveCount(0)
  await card(page, weekly).getByTestId('btn-prompt').click()
  // 复制成功：文字换成「已复制」，前面的图标从 copy 换成对勾。
  await expect(card(page, weekly).getByTestId('btn-prompt')).toHaveText('已复制')
  await expect(card(page, weekly).getByTestId('btn-prompt').locator('svg')).toHaveAttribute('data-icon', 'check')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(installPrompt(weekly))
  await expect(card(page, weekly).getByTestId('heat')).toHaveText('热度 99')
  expect(await order(page)).toEqual([external, reviewer, weekly])
  expect(clicks).toContainEqual({ slug: weekly, kind: 'prompt' })
  await page.getByTestId('sort-new').click()
  await page.getByTestId('sort-hot').click()
  expect(await order(page)).toEqual([weekly, external, reviewer])
  const link = card(page, reviewer).getByTestId('btn-import')
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  const shelfURL = page.url()
  await link.click()
  await expect.poll(() => clicks).toContainEqual({ slug: reviewer, kind: 'import' })
  await expect(page).toHaveURL(shelfURL)
  expect(context.pages()).toEqual([page])
  await expect(card(page, weekly).getByTestId('btn-prompt')).toHaveText('复制安装提示词')
  await expect(card(page, weekly).getByTestId('btn-prompt').locator('svg')).toHaveAttribute('data-icon', 'copy')
})

test('剪贴板和上报失败时仍可手动复制，不报页面错误', async ({ page }) => {
  await mockStats(page)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('模拟拒绝')) } })
  })
  await page.route('**/api/click', (route) => route.abort())
  await page.goto('/')
  await card(page, weekly).getByTestId('btn-prompt').click()
  const fallback = card(page, weekly).getByTestId('prompt-fallback')
  await expect(fallback).toBeVisible()
  await expect(fallback.locator('textarea')).toHaveValue(installPrompt(weekly))
  await expect(fallback.locator('textarea')).toBeFocused()
  await fallback.locator('textarea').press('Escape')
  await expect(fallback).toHaveCount(0)
  await expect(card(page, weekly).getByTestId('btn-prompt')).toBeFocused()
  expect(errors).toEqual([])
})

test('头像台词：悬停、键盘、互斥、默认台词不连续重复', async ({ page }) => {
  await mockStats(page)
  await page.goto('/')
  const first = card(page, reviewer)
  const second = card(page, weekly)
  await first.getByTestId('avatar').hover()
  await expect(first.getByTestId('pitch-bubble')).toHaveAttribute('data-text', '评审会上被问住之前，先让我问你一遍。')
  await second.getByTestId('avatar').hover()
  await expect(page.locator('[data-testid="pitch-bubble"][data-open="true"]')).toHaveCount(1)
  const previous = await second.getByTestId('pitch-bubble').getAttribute('data-text')
  expect(DEFAULT_PITCHES).toContain(previous)
  await page.mouse.move(0, 0)
  await expect(second.getByTestId('pitch-bubble')).toHaveAttribute('data-open', 'false')
  await second.getByTestId('avatar').focus()
  await expect(second.getByTestId('pitch-bubble')).toHaveAttribute('data-open', 'true')
  expect(await second.getByTestId('pitch-bubble').getAttribute('data-text')).not.toBe(previous)
  await page.keyboard.press('Tab')
  await expect(second.getByTestId('pitch-bubble')).toHaveAttribute('data-open', 'false')
})

test('触摸点按头像打开，点别处关闭', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, hasTouch: true, viewport: { width: 390, height: 844 } })
  try {
    const page = await context.newPage()
    await mockStats(page)
    await page.goto('/')
    await card(page, weekly).getByTestId('avatar').tap()
    await expect(card(page, weekly).getByTestId('pitch-bubble')).toHaveAttribute('data-open', 'true')
    await card(page, reviewer).getByTestId('avatar').tap()
    await expect(page.locator('[data-testid="pitch-bubble"][data-open="true"]')).toHaveCount(1)
    await page.locator('h1').tap()
    await expect(page.locator('[data-testid="pitch-bubble"][data-open="true"]')).toHaveCount(0)
  } finally { await context.close() }
})

test('详情、SSR 头像一致性、技能和任务源码链接、外部隐藏区块', async ({ page, request }) => {
  await mockStats(page)
  await page.goto('/')
  const rawHome = await (await request.get('/')).text()
  const rawDetail = await (await request.get(`/bots/${weekly}`)).text()
  expect(rawHome).toContain('<svg')
  // 活体 SVG 会随时间变化，比较两页预渲染的同一 Bot 身体路径。
  const [homeBody, detailBody] = await page.evaluate(({ rawHome, rawDetail, weekly }) => {
    const parser = new DOMParser()
    const body = (html, selector) => parser.parseFromString(html, 'text/html')
      .querySelector(`${selector} [data-part="body"]`)?.getAttribute('d')
    return [body(rawHome, `[data-testid="bot-card"][data-slug="${weekly}"]`), body(rawDetail, '[data-testid="bot-detail"]')]
  }, { rawHome, rawDetail, weekly })
  expect(homeBody).toMatch(/^M/)
  expect(detailBody).toBe(homeBody)
  expect(await card(page, reviewer).getByTestId('avatar').locator('img').evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true)
  await card(page, weekly).getByTestId('detail-link').click()
  await expect(page.getByTestId('bot-detail')).toBeVisible()
  await expect(page).toHaveTitle(/示例·周报整理员/)
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', '把一周零散的聊天和笔记整理成一份周报')
  await expect(page.getByTestId('forked-from')).toContainText('示例·PRD 评审员')
  await expect(page.getByTestId('section-prereq')).toContainText('无')
  // 额度在侧栏里：三根由矮到高的小柱 + 一个字；档位的含义不直接显示，在 title 和读屏文本里。
  const meter = page.getByTestId('detail-rail').getByTestId('quota-meter')
  await expect(meter).toHaveAttribute('data-quota', '低')
  await expect(meter).toHaveAttribute('title', '偶尔用一下，几乎不占额度')
  await expect(meter.locator('.quota-level')).toHaveText('低')
  await expect(meter.locator('.quota-bars > i')).toHaveCount(3)
  await expect(meter.locator('.bz-sr-only')).toHaveText('：偶尔用一下，几乎不占额度')
  // 说明句只给读屏：视觉上是 1px 的隐藏块，不占版面。
  expect((await meter.locator('.bz-sr-only').boundingBox()).width).toBeLessThanOrEqual(1)
  expect(await meter.locator('.quota-bars > i').evaluateAll((cells) => cells.map((cell) => getComputedStyle(cell).backgroundColor)).then((colors) => colors.filter((color) => color === colors[0]).length), '「低」只亮一格').toBe(1)
  // 权限：一排标签，每项的含义同样在 title 和读屏文本里。
  const auto = page.getByTestId('section-permissions').locator('.permission-list > li', { hasText: '定时自动运行' })
  await expect(auto).toHaveClass(/bz-tag/)
  await expect(auto).toHaveAttribute('title', '会按计划自己运行，不用你每次叫它')
  await expect(auto.locator('.bz-sr-only')).toHaveText('：会按计划自己运行，不用你每次叫它')
  expect((await auto.locator('.bz-sr-only').boundingBox()).width).toBeLessThanOrEqual(1)
  expect((await auto.boundingBox()).height, '权限是 22 高的标签').toBe(22)
  await expect(page.getByTestId('section-screenshots').locator('img')).toHaveCount(2)
  await expect(page.getByTestId('section-skills').locator('a')).toHaveAttribute('href', /\/bots\/demo-weekly-digest\/skills\/weekly-summary\/SKILL\.md$/)
  await expect(page.getByTestId('section-design')).toContainText('解决谁的什么问题')
  await page.getByTestId('forked-from').locator('a').click()
  await expect(page.getByTestId('section-prereq').locator('li')).toHaveCount(2)
  await expect(page.getByTestId('section-routines').locator('a')).toHaveAttribute('href', /\/bots\/demo-prd-reviewer\/routines\.md$/)
  // 定时任务这一块只有标题和链接，没有说明句。
  await expect(page.getByTestId('section-routines').locator('p')).toHaveCount(0)
  await expect(page.getByTestId('forked-from')).toHaveCount(0)
  await page.goto(`/bots/${external}`)
  // 来源写在侧栏里（官方市场 / 社区收录 / 作者投稿），页面底部不再有一行来源说明。
  await expect(page.getByTestId('detail-rail').locator('.bot-origin')).toHaveText('社区收录')
  await expect(page.getByTestId('bot-detail')).not.toContainText('本站只收录链接')
  await expect(page.locator('.external-notice')).toHaveCount(0)
  // 外部收录没有安装提示词、截图、设计说明；技能用 about 里整理好的名字和一句话，不带源码链接。
  for (const id of ['btn-prompt', 'section-screenshots', 'section-design']) {
    await expect(page.getByTestId(id)).toHaveCount(0)
  }
  await expect(page.getByTestId('section-skills').getByTestId('skill-item')).toHaveCount(2)
  await expect(page.getByTestId('section-skills').locator('a')).toHaveCount(0)
})

test('界面上没有解释性的句子：首屏、区块、页尾、404、搜索占位字', async ({ page }) => {
  await mockStats(page)
  await page.goto('/')
  // 首屏的字只有站名和搜索框（其余是球池里的 Bot）；tagline 只留在 meta description 里。
  await expect(page.locator('.pit-copy > *')).toHaveCount(2)
  await expect(page.getByTestId('ballpit').locator('h1')).toHaveCount(1)
  await expect(page.getByTestId('ballpit').locator('p')).toHaveCount(0)
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Grok Bot 模板货架/)
  await expect(page.getByTestId('search-trigger').locator('.search-trigger-text')).toHaveText('搜索')
  // 区块只有标题；列表区右侧保留计数。
  await expect(page.locator('.bz-section-head p')).toHaveCount(0)
  await expect(page.locator('#featured-title')).toHaveText('本周主推')
  await expect(page.locator('#squads-title')).toHaveText('小队')
  await expect(page.locator('#collections-title')).toHaveText('专题')
  await expect(page.locator('#all-title')).toHaveText('全部 Bot')
  await expect(page.locator('.bot-count')).toHaveText('共 3 个')
  // 分组的组头只有吉祥物、分组名和数量，没有分组说明。
  await expect(page.locator('.role-head p')).toHaveCount(0)
  await expect(page.locator('.role-head').first()).toHaveText('产品1 个')
  // 页尾只有「我要投稿」：图标 + 动词。
  await expect(page.locator('.shelf-footer > *')).toHaveCount(1)
  await expect(page.getByTestId('contribute-link')).toHaveText('我要投稿')
  await expect(page.getByTestId('contribute-link').locator('svg')).toHaveAttribute('data-icon', 'plus')
  // 搜索面板的占位字和首屏一致。
  await page.getByTestId('search-trigger').click()
  await expect(page.getByTestId('search-input')).toHaveAttribute('placeholder', '搜索')
  await page.keyboard.press('Escape')
  // 404：只有标题和返回按钮。
  await page.goto('/bots/not-exist-xyz')
  await expect(page.locator('.not-found h1')).toHaveText('这一页走丢了')
  await expect(page.locator('.not-found p:not([aria-hidden="true"])')).toHaveCount(0)
  await expect(page.locator('.not-found .bz-btn')).toHaveText('回货架看看')
  await expect(page.locator('.not-found .bz-btn svg')).toHaveAttribute('data-icon', 'arrow-left')
})

test('整张卡可点进详情；头像、作者、导入、复制在它上面各管各的', async ({ page, context, baseURL }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL })
  await mockStats(page)
  await page.goto('/')
  const bot = card(page, weekly)
  await bot.scrollIntoViewIfNeeded()
  // 卡里仍然只有一个指向详情的链接；卡上随便一处（介绍、元信息、空白）都是手型。
  await expect(bot.locator(`a[href="/bots/${weekly}"]`)).toHaveCount(1)
  const cursorAt = (locator, selector) => locator.evaluate((el, selector) => {
    const box = (selector ? el.querySelector(selector) : el).getBoundingClientRect()
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    return { cursor: getComputedStyle(hit).cursor, link: hit.closest('a')?.getAttribute('href') ?? null }
  }, selector)
  for (const selector of ['.bot-tagline', '.bot-stats .stat-quota', '.bot-stats .stat-account']) {
    expect(await cursorAt(bot, selector), selector).toEqual({ cursor: 'pointer', link: `/bots/${weekly}` })
  }
  // 鼠标真的悬停上去之后（气泡打开、介绍淡出）也一样：介绍那一块点下去要进详情，不能被淡出的介绍吃掉。
  const hoverAt = await bot.locator('.bot-tagline').boundingBox()
  await page.mouse.move(hoverAt.x + hoverAt.width / 2, hoverAt.y + hoverAt.height / 2, { steps: 3 })
  await expect(bot.getByTestId('pitch-bubble')).toHaveAttribute('data-open', 'true')
  await page.waitForTimeout(250)
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y).closest('a')?.getAttribute('href') ?? null, [hoverAt.x + hoverAt.width / 2, hoverAt.y + hoverAt.height / 2]), '悬停时介绍位置仍是整卡链接').toBe(`/bots/${weekly}`)
  await page.mouse.move(5, 5)
  // 头像、作者、导入、复制不被整卡链接盖住。
  for (const id of ['avatar', 'author-link', 'btn-import', 'btn-prompt']) {
    const hit = await bot.getByTestId(id).evaluate((el) => {
      const box = el.getBoundingClientRect()
      return el.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2))
    })
    expect(hit, `${id} 在整卡链接上面`).toBe(true)
  }
  // 点头像是戳，点复制是复制：都不跳走。
  await bot.getByTestId('avatar').click()
  await expect(bot.getByTestId('pitch-bubble')).toHaveAttribute('data-open', 'true')
  await bot.getByTestId('btn-prompt').click()
  await expect(bot.getByTestId('btn-prompt')).toHaveText('已复制')
  await expect(page).toHaveURL(/\/$/)
  // 桌面点导入触发该卡的上报，不跟随整卡链接。
  const request = page.waitForRequest((r) => r.url().endsWith('/api/click') && r.postDataJSON().kind === 'import')
  await bot.getByTestId('btn-import').click()
  expect((await request).postDataJSON()).toEqual({ slug: weekly, kind: 'import' })
  await expect(page).toHaveURL('/')
  // 点介绍那一块（不是名字）进详情。
  const tagline = await bot.locator('.bot-tagline').boundingBox()
  await page.mouse.click(tagline.x + tagline.width / 2, tagline.y + tagline.height / 2)
  await expect(page).toHaveURL(new RegExp(`/bots/${weekly}$`))
  await expect(page.getByTestId('bot-detail')).toBeVisible()
  // 主推卡同样整卡可点：点介绍进详情，点砖是戳，导入按钮不被整卡链接盖住。
  await page.goto('/')
  const featured = page.locator(`[data-testid="featured-card"][data-slug="${reviewer}"]`)
  await featured.scrollIntoViewIfNeeded()
  await expect(featured.locator(`a[href="/bots/${reviewer}"]`)).toHaveCount(1)
  expect(await cursorAt(featured, '.bot-tagline')).toEqual({ cursor: 'pointer', link: `/bots/${reviewer}` })
  for (const selector of ['.featured-tile', '.bot-author', '[data-testid="featured-import"]']) {
    const hit = await featured.locator(selector).evaluate((el) => {
      const box = el.getBoundingClientRect()
      return el.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2))
    })
    expect(hit, `${selector} 在整卡链接上面`).toBe(true)
  }
  await featured.locator('.featured-tile').click()
  await expect(page).toHaveURL(/\/$/)
  const line = await featured.locator('.bot-tagline').boundingBox()
  await page.mouse.click(line.x + line.width / 2, line.y + line.height / 2)
  await expect(page).toHaveURL(new RegExp(`/bots/${reviewer}$`))
})

test('设计说明：模板和 HTML 不执行，图片相对路径与引用式图片改写', async ({ page }) => {
  const designs = await renderDesigns([{ slug: weekly, design: `<!-- 私有备注 -->\n# 设计说明\n\n## 正文\n\n{{ 1 + 1 }}\n\n<img src="x" onerror="alert(1)">\n\n<script>alert(2)</script>\n\n![图](./screenshots/digest.png)\n\n![引用][shot]\n\n[shot]: screenshots/digest-2.png\n\n[危险](javascript:alert(1))\n\n![属性](x){onerror="alert(1)"}\n\n<<< /etc/passwd\n` }])
  await page.setContent(designs[weekly])
  await expect(page.locator('body')).toContainText('{{ 1 + 1 }}')
  await expect(page.locator('body')).not.toContainText('私有备注')
  await expect(page.locator('h1, script, img[onerror], a[href^="javascript:"]')).toHaveCount(0)
  await expect(page.locator(`img[src="/bot-assets/${weekly}/digest.png"]`)).toHaveCount(1)
  await expect(page.locator(`img[src="/bot-assets/${weekly}/digest-2.png"]`)).toHaveCount(1)
  await expect(page.locator('body')).toContainText('<<< /etc/passwd')
})

test('手机无横向滚动、深色模式与可选交付截图', async ({ page }) => {
  await mockStats(page)
  const shots = process.env.E2E_SCREENSHOTS
  if (shots) await mkdir(shots, { recursive: true })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await expect(card(page, external).getByTestId('heat')).toHaveText('热度 5')
  if (shots) {
    // 长截图从页顶开始，等首轮热度重排淡入结束，避免固定导航/动画的抓拍伪影。
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(650)
    await page.screenshot({ path: join(shots, 'home-1280.png'), fullPage: true })
  }
  await page.goto(`/bots/${weekly}`)
  await expect(page.getByTestId('section-design')).toBeVisible()
  if (shots) await page.screenshot({ path: join(shots, 'detail-1280.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  for (const path of ['/', `/bots/${weekly}`]) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    if (shots && path === '/') await page.screenshot({ path: join(shots, 'home-390.png'), fullPage: true })
  }
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await expect(page.getByTestId('bot-detail')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('每一页底部都有页脚：创建人、开源仓库、鸣谢', async ({ page }) => {
  for (const path of ['/', `/bots/${weekly}`, '/submit']) {
    await page.goto(path)
    const footer = page.getByTestId('site-footer')
    await expect(footer).toHaveCount(1)
    await expect(footer.getByTestId('footer-creator')).toHaveText(`${FOOTER.creatorLabel}：${FOOTER.creator} · ${FOOTER.org}`)
    await expect(footer.getByTestId('footer-repo')).toHaveAttribute('href', SITE.repo)
    await expect(footer.getByTestId('footer-repo')).toHaveAttribute('target', '_blank')
    await expect(footer.getByTestId('footer-thanks')).toHaveText(FOOTER.thanks)
  }
  // 手机宽度：页脚不撑出横向滚动
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto('/')
  await page.getByTestId('site-footer').scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
})

test('页脚开源项目换行时隐藏行首分隔点，同行的分隔点仍显示', async ({ page }) => {
  await page.goto('/')
  const project = page.getByTestId('footer-repo').locator('..')
  await expect(project.locator('.site-footer-sep')).toHaveCount(2)
  for (const width of [320, 360, 390, 414, 680, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await project.scrollIntoViewIfNeeded()
    const layout = await project.evaluate((dd) => {
      const { left, right } = dd.getBoundingClientRect()
      const clipMargin = parseFloat(getComputedStyle(dd).overflowClipMargin) || 0
      const [repo, license, privacy] = dd.children
      const licenseText = document.createRange()
      licenseText.selectNode(license.lastChild)
      const items = [repo.getBoundingClientRect(), licenseText.getBoundingClientRect(), privacy.lastElementChild.getBoundingClientRect()]
      const mid = (rect) => (rect.top + rect.bottom) / 2
      const separators = [...dd.querySelectorAll('.site-footer-sep')].map((sep) => sep.getBoundingClientRect())
      const starts = items.map((item, i) => i === 0 || Math.abs(mid(item) - mid(items[i - 1])) >= 6)
      return {
        indents: items.filter((_, i) => starts[i]).map((item) => Math.abs(item.left - left)),
        dots: separators.map((dot, i) => starts[i + 1]
          ? dot.right <= left - clipMargin
          : dot.width > 0 && dot.left >= items[i].right - 1 && dot.right <= right),
        overflow: document.documentElement.scrollWidth - innerWidth,
      }
    })
    const atWidth = `${width}px`
    expect(layout.overflow, atWidth).toBeLessThanOrEqual(0)
    expect(Math.max(...layout.indents), atWidth).toBeLessThanOrEqual(2)
    expect(layout.dots, atWidth).toEqual([true, true])
    if (width === 320) expect(layout.indents.length, atWidth).toBeGreaterThan(1)
    if (width >= 1024) expect(layout.indents, atWidth).toHaveLength(1)
  }
})

test('触屏导入在新页面打开 x.ai 模板', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, baseURL })
  try {
    await context.route('https://x.ai/**', r => r.fulfill({ body: 'ok' }))
    const page = await context.newPage()
    await page.goto(`/bots/${reviewer}`)
    const popup = page.waitForEvent('popup')
    await page.getByTestId('btn-import').tap()
    await expect(await popup).toHaveURL(/^https:\/\/x\.ai\/bot\/demo-prd-reviewer-000/)
  } finally {
    await context.close()
  }
})
