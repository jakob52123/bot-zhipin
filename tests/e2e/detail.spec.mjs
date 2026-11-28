// 详情页（一份看得懂的「简历」）：主栏的区块、吸顶的侧栏、开场白复制、所在小队、窄屏、减少动效。
// 规格见 docs/dev/INTERACTION.md §9。「同组的 Bot」在 fixtures 里出不来（三个示例各在一个分组），
// 它的数据由 tests/unit/detail-data.test.mjs 覆盖。
import { test, expect } from '@playwright/test'

const reviewer = 'demo-prd-reviewer'
const weekly = 'demo-weekly-digest'
const external = 'demo-external'
const sections = (page) => page.locator('.detail-main > section').evaluateAll((nodes) => nodes.map((node) => node.dataset.testid))
// 区块标题只取标题自己的字，不带后面的数量。
const headings = (page) => page.locator('.detail-main > section > h2').evaluateAll((nodes) => nodes.map((node) => node.firstChild.textContent.trim()))
const box = (locator) => locator.boundingBox()

test.beforeEach(async ({ context, page }) => {
  await context.route('https://x.ai/**', (route) => route.fulfill({ contentType: 'text/html', body: '<p>模拟导入页面</p>' }))
  await page.route('**/api/stats', (route) => route.fulfill({ json: {
    ok: true, heat: { [reviewer]: 7 }, byKind: { [reviewer]: { import: 7, prompt: 0, starter: 0 } }, squads: {},
  } }))
  await page.route('**/api/click', (route) => route.fulfill({ json: { ok: true, counted: true, heat: 8 } }))
})

test('内容多的 Bot：区块自上而下齐全，只有标题和数据', async ({ page }) => {
  await page.goto(`/bots/${reviewer}`)
  expect(await sections(page)).toEqual([
    'section-about', 'section-starters', 'section-screenshots', 'section-skills', 'section-routines', 'section-prereq',
    'section-permissions', 'section-fit', 'section-editor', 'section-design', 'section-squads',
  ])
  expect(await headings(page)).toEqual(['能做什么', '开场白', '截图', '技能', '定时任务', '导入前准备', '权限', '适合谁', '编辑点评', '设计说明', '所在小队'])
  // 能做什么：一段介绍 + 一列它会做的事，每条前面一个 Bot 色的圆点。
  const about = page.getByTestId('section-about')
  await expect(about.locator('.about-intro')).toHaveText('你把写好的 PRD 发给它，它按检查清单逐条过一遍，把问题按严重程度排好交给你。')
  await expect(about.locator('.does-list > li')).toHaveText(['按清单检查目标、范围、验收标准有没有写清', '把发现的问题按严重程度排序', '给每个问题配一句怎么改'])
  expect(await about.locator('.does-list > li').first().evaluate((el) => getComputedStyle(el, '::before').backgroundColor)).toBe('rgb(138, 138, 147)')
  // 技能：作者投稿的用 skills/ 目录里的，标题后面跟数量。
  await expect(page.getByTestId('section-skills').locator('.section-count')).toHaveText('2')
  await expect(page.getByTestId('skill-item')).toHaveCount(2)
  // 导入前准备：国内使用要知道的事单独一行，前面是地球图标，含义在 title 和读屏文本里，不写在界面上。
  const cn = page.getByTestId('prereq-cn')
  await expect(cn).toHaveAttribute('title', '国内使用')
  await expect(cn.locator('svg')).toHaveAttribute('data-icon', 'globe')
  await expect(cn).toContainText('读飞书文档要先连飞书账号；直接贴正文不用连。')
  expect((await box(cn.locator('.bz-sr-only'))).width).toBeLessThanOrEqual(1)
  // 适合谁：对勾是适合、叉是不适合，没有小标题。
  await expect(page.getByTestId('fit-yes').locator('svg')).toHaveAttribute('data-icon', 'check')
  await expect(page.getByTestId('fit-yes')).toContainText('评审会前想先自查一遍的产品经理')
  await expect(page.getByTestId('fit-no').locator('svg')).toHaveAttribute('data-icon', 'x')
  await expect(page.getByTestId('fit-no')).toContainText('还没动笔、只有一个想法的人')
  expect((await box(page.getByTestId('fit-yes'))).y, '宽屏下适合和不适合左右并排').toBe((await box(page.getByTestId('fit-no'))).y)
  // 编辑点评：只有点评本身，前面一个引号图标。
  const editor = page.getByTestId('section-editor').locator('.editor-note')
  await expect(editor.locator('p')).toHaveText('示例点评：问题按严重程度排好了，先看前三条就够。')
  await expect(editor.locator('svg')).toHaveAttribute('data-icon', 'quote')
  // 区块标题下面没有说明句：标题后面紧跟的就是内容。
  for (const heading of await page.locator('.detail-main > section > h2').all()) {
    expect(await heading.evaluate((el) => [...el.children].every((child) => child.classList.contains('section-count')))).toBe(true)
  }
  // 整页只有一个实心主按钮。
  await expect(page.locator('.bot-detail .bz-btn.primary')).toHaveCount(1)
})

test('内容少的 Bot：没有数据的区块整块不出现；外部收录的技能和定时任务来自 about', async ({ page }) => {
  await page.goto(`/bots/${weekly}`)
  expect(await sections(page)).toEqual(['section-screenshots', 'section-skills', 'section-prereq', 'section-permissions', 'section-design', 'section-squads'])
  // 带「定时自动运行」权限但数不出几个任务：侧栏那一格是一个对勾。
  await expect(page.getByTestId('fact-routines').locator('svg[data-icon="check"]')).toHaveCount(1)
  await expect(page.getByTestId('fact-routines')).toHaveAttribute('title', '会按计划自己运行，不用你每次叫它')
  await page.goto(`/bots/${external}`)
  // 没有权限就没有「权限」这一块，不写「不需要额外权限」。
  expect(await sections(page)).toEqual(['section-about', 'section-skills', 'section-routines', 'section-prereq', 'section-squads'])
  await expect(page.getByTestId('bot-detail')).not.toContainText('不需要额外权限')
  await expect(page.getByTestId('skill-item').locator('.skill-name')).toHaveText(['fetch-notes', 'daily-check'])
  // 定时任务：时间、做什么、默认开还是关；「未说明」「照发」不出标记。
  const routines = page.getByTestId('routine-item')
  await expect(routines).toHaveCount(2)
  await expect(routines.nth(0).locator('.routine-when')).toHaveText('每天早上 9 点')
  await expect(routines.nth(0).locator('.routine-what')).toHaveText('检查资料有没有更新')
  await expect(routines.nth(0).locator('.routine-flag')).toHaveText(['默认关', '没事不打扰'])
  await expect(routines.nth(1).locator('.routine-what')).toHaveText('发一份本周汇总')
  await expect(routines.nth(1).locator('.routine-flag')).toHaveCount(0)
  await expect(page.getByTestId('section-routines').locator('.section-count')).toHaveText('2')
  await expect(page.getByTestId('fact-routines')).toHaveText('2 个')
  await expect(page.getByTestId('fact-account')).toHaveText('不用连')
})

test('侧栏：导入、四项属性、作者上架热度；宽屏两栏吸顶，窄屏排在头部下面', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`/bots/${reviewer}`)
  const rail = page.getByTestId('detail-rail'), header = page.locator('.detail-header'), main = page.locator('.detail-main')
  await expect(rail.locator('.rail-fact > dt')).toHaveText(['额度', '账号', '定时任务', '代发消息'])
  await expect(rail.locator('.rail-meta dt')).toHaveText(['作者', '上架', '热度'])
  await expect(rail.getByTestId('fact-account')).toHaveText('要连')
  await expect(rail.getByTestId('fact-account').locator('svg')).toHaveAttribute('data-icon', 'plug')
  await expect(rail.getByTestId('author-link')).toHaveAttribute('href', '/authors/example-user')
  await expect(rail).not.toContainText('作者投稿')
  await expect(rail.locator('time')).toHaveText('2026-11-01')
  await expect(rail.getByTestId('heat')).toHaveText('7')
  // 按钮下面没有说明小字：侧栏里没有成段的文字。
  await expect(rail.locator('p')).toHaveCount(0)
  // 两栏：侧栏 320 宽，在主栏右边，顶和头部对齐；两个按钮撑满、等高 44。
  const railBox = await box(rail), mainBox = await box(main), headerBox = await box(header)
  expect(railBox.width).toBe(320)
  expect(railBox.x).toBeGreaterThanOrEqual(mainBox.x + mainBox.width + 48)
  expect(Math.abs(railBox.y - headerBox.y)).toBeLessThanOrEqual(1)
  for (const id of ['btn-import', 'btn-prompt']) {
    const button = await box(rail.getByTestId(id))
    expect([button.width, button.height]).toEqual([278, 44])
  }
  // 往下滚：侧栏吸在导航条下面 16px，头部看不见以后，卡片上沿探出一只小的它。
  const peek = rail.getByTestId('rail-peek')
  await expect(peek).toHaveAttribute('data-show', 'false')
  await page.getByTestId('section-design').scrollIntoViewIfNeeded()
  // 不用 mouse.wheel：它触发的平滑滚动在返回后还会继续，和下面的回顶抢，偶发失败。这里测的是滚动位置，不是滚轮输入。
  await page.evaluate(() => window.scrollBy({ top: 600, behavior: 'instant' }))
  await expect(peek).toHaveAttribute('data-show', 'true')
  expect((await box(rail)).y).toBe(88 + 16)
  await expect(peek).toHaveAttribute('aria-hidden', 'true')
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(peek).toHaveAttribute('data-show', 'false')
  // 改编自：有才显示，链到原 Bot。
  await page.goto(`/bots/${weekly}`)
  await expect(rail.locator('.rail-meta dt')).toHaveText(['作者', '上架', '热度', '改编自'])
  await expect(rail.getByTestId('forked-from').locator('a')).toHaveAttribute('href', `/bots/${reviewer}`)
  // 999px：单栏，头部、侧栏、主栏依次往下，侧栏不吸顶，没有探头的小 Bot。
  await page.setViewportSize({ width: 999, height: 800 })
  await page.goto(`/bots/${reviewer}`)
  const stacked = { header: await box(header), rail: await box(rail), main: await box(main) }
  expect(stacked.rail.y).toBeGreaterThanOrEqual(stacked.header.y + stacked.header.height)
  expect(stacked.main.y).toBeGreaterThanOrEqual(stacked.rail.y + stacked.rail.height)
  expect(stacked.rail.width).toBe(stacked.main.width)
  await expect(rail).toHaveCSS('position', 'relative')
  await expect(peek).toBeHidden()
})

test('开场白点一下复制：反馈、读屏播报；键盘也能复制', async ({ page, context, baseURL }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL })
  await page.goto(`/bots/${reviewer}`)
  const starters = page.getByTestId('starter')
  await expect(starters).toHaveCount(2)
  const first = starters.nth(0), second = starters.nth(1)
  await expect(first.locator('svg')).toHaveAttribute('data-icon', 'copy')
  await first.click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('帮我评审这份 PRD：（贴正文或文档链接）')
  await expect(first).toHaveClass(/copied/)
  await expect(first.locator('.starter-done')).toHaveText('已复制')
  await expect(first.locator('svg')).toHaveAttribute('data-icon', 'check')
  await expect(page.locator('.shelf-page [aria-live]')).toHaveText('已复制')
  // （复制时头部的 Bot 会眨一下眼；示例里带开场白的这只用的是自定义头像图片，没有活体可看，这里不断言。）
  // 同一时间只有一条显示「已复制」；1.8 秒后恢复。
  await second.focus()
  await page.keyboard.press('Enter')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('只看验收标准这一节，哪些没法验收？')
  await expect(page.locator('.starter.copied')).toHaveCount(1)
  await expect(second).toHaveClass(/copied/)
  await expect(second).toBeFocused()
  await expect(page.locator('.starter.copied')).toHaveCount(0, { timeout: 3000 })
  await expect(second.locator('svg')).toHaveAttribute('data-icon', 'copy')
  // 再点第一条仍有反馈；上报开场白，但不能用点击响应里的 8 覆盖热度。
  const [request] = await Promise.all([page.waitForRequest('**/api/click'), first.click()])
  await expect(first).toHaveClass(/copied/)
  expect(request.postDataJSON()).toEqual({ slug: reviewer, kind: 'starter' })
  await expect(page.getByTestId('heat')).toHaveText('7')
})

test('剪贴板用不了时：把这句话选中，不报页面错误', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('模拟拒绝')) } })
    document.execCommand = () => false
  })
  await page.goto(`/bots/${reviewer}`)
  const first = page.getByTestId('starter').first()
  const [request] = await Promise.all([page.waitForRequest('**/api/click'), first.click()])
  expect(request.postDataJSON()).toEqual({ slug: reviewer, kind: 'starter' })
  await expect.poll(() => page.evaluate(() => String(getSelection()))).toBe('帮我评审这份 PRD：（贴正文或文档链接）')
  await expect(first).not.toHaveClass(/copied/)
  expect(errors).toEqual([])
})

test('所在小队：整行可点进小队页，只有一个链接，成员小头像只是装饰', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`/bots/${reviewer}`)
  const row = page.getByTestId('squad-link')
  await expect(row).toHaveCount(1)
  await expect(row.locator('a')).toHaveCount(1)
  await expect(row.locator('a')).toHaveAttribute('href', '/squads/demo-squad')
  await expect(row.locator('a')).toHaveText('示例·周会小队')
  // 队长是实心标签，别的岗位是中性标签。
  await expect(row.locator('.bz-tag')).toHaveText('队长')
  await expect(row.locator('.bz-tag')).toHaveClass(/solid/)
  // 三个成员的小头像，队长排最前；整组对读屏隐藏。
  await expect(row.locator('.squad-faces')).toHaveAttribute('aria-hidden', 'true')
  await expect(row.locator('.squad-faces .bot-mini')).toHaveCount(3)
  await expect(row.locator('.squad-faces .bot-mini').first().locator('img')).toHaveCount(1)
  // 行上随便一处（右边的箭头）都是这个链接。
  await row.scrollIntoViewIfNeeded()
  const hit = await row.locator('svg[data-icon="chevron-right"]').evaluate((el) => {
    const rect = el.getBoundingClientRect()
    const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    return { link: target.closest('a')?.getAttribute('href') ?? null, cursor: getComputedStyle(target).cursor }
  })
  expect(hit).toEqual({ link: '/squads/demo-squad', cursor: 'pointer' })
  // 键盘：Tab 走到小队链接，回车进小队页。
  await row.locator('a').focus()
  await expect(row.locator('a')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/squads\/demo-squad$/)
  await expect(page.getByTestId('squad-detail')).toBeVisible()
  // 别的岗位：中性标签。
  await page.goto(`/bots/${external}`)
  await expect(page.getByTestId('squad-link').locator('.bz-tag')).toHaveText('外援')
  await expect(page.getByTestId('squad-link').locator('.bz-tag')).not.toHaveClass(/solid/)
})

test('键盘顺序：返回 → 头像 → 导入 → 复制安装提示词 → 作者 → 开场白，焦点框都看得见', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`/bots/${reviewer}`)
  await page.locator('.back-link').focus()
  const order = []
  for (let step = 0; step < 6; step++) {
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => {
      const el = document.activeElement, css = getComputedStyle(el)
      return { id: el.dataset.testid, outline: css.outlineStyle, width: parseFloat(css.outlineWidth) }
    })
    order.push(focused.id)
    expect(focused.outline, focused.id).toBe('solid')
    expect(focused.width, focused.id).toBeGreaterThanOrEqual(2)
  }
  expect(order).toEqual(['avatar', 'btn-import', 'btn-prompt', 'author-link', 'starter', 'starter'])
})

for (const width of [1440, 1000, 999, 768, 390, 320]) {
  test(`${width}px：三个示例 Bot 的详情页都不横向滚动`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    for (const slug of [reviewer, weekly, external]) {
      await page.goto(`/bots/${slug}`)
      await expect(page.getByTestId('detail-rail')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth), slug).toBeLessThanOrEqual(width)
      // 主栏和侧栏都在视口里，没有被挤出去。
      for (const selector of ['.detail-main', '[data-testid="detail-rail"]']) {
        const rect = await box(page.locator(selector))
        expect(rect.x).toBeGreaterThanOrEqual(0)
        expect(rect.x + rect.width).toBeLessThanOrEqual(width)
      }
    }
  })
}

test('手机触摸：导入按钮和开场白的点按高度都不小于 44', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  try {
    const page = await context.newPage()
    await page.route('**/api/stats', (route) => route.fulfill({ json: { ok: true, heat: {}, byKind: {}, squads: {} } }))
    await page.goto(`/bots/${reviewer}`)
    for (const control of [...await page.getByTestId('starter').all(), page.getByTestId('btn-import'), page.getByTestId('btn-prompt')]) {
      expect((await box(control)).height).toBeGreaterThanOrEqual(44)
    }
    // 手机上开场白的气泡不超出主栏。
    const main = await box(page.locator('.detail-main'))
    for (const starter of await page.getByTestId('starter').all()) {
      const rect = await box(starter)
      expect(rect.x + rect.width).toBeLessThanOrEqual(main.x + main.width + .5)
    }
  } finally { await context.close() }
})

test('减少动效：探头的小 Bot 不做位移过渡，页面上没有在跑的动画；复制的反馈照常', async ({ page, context, baseURL }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`/bots/${reviewer}`)
  await page.getByTestId('section-design').scrollIntoViewIfNeeded()
  await page.mouse.wheel(0, 600)
  const peek = page.getByTestId('rail-peek')
  await expect(peek).toHaveAttribute('data-show', 'true')
  expect(await peek.locator('.bot-mini').evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s')
  expect(await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === 'running').length)).toBe(0)
  // 活体都停在静态帧。
  for (const bot of await page.locator('.bot-detail [data-testid="live-bot"]').all()) await expect(bot).toHaveAttribute('data-state', 'idle')
  await page.evaluate(() => window.scrollTo(0, 0))
  const first = page.getByTestId('starter').first()
  await first.click()
  await expect(first.locator('.starter-done')).toHaveText('已复制')
})
