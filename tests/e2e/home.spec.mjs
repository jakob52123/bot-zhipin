// 首页首屏以下：主推的编辑点评、专题、「全部 Bot」的工具栏、分组、专题筛选、地址栏还原。
// 用例只从页面上读数（有几个分组、每组几个、专题里有谁），所以示例货架和真实货架都能跑。
// 示例货架每个分组只有一个 Bot，折不起来：「展开 / 收起」那几条在它上面会跳过，要在真实货架的预览上跑
// （E2E_BASE_URL 指到真实数据的预览）。
import { test, expect } from '@playwright/test'

const NAV = 88 // 悬浮导航条让出来的高度：距顶 16 + 条高 64 + 8
const cards = (page) => page.getByTestId('bot-card')
const slugsOf = (locator) => locator.evaluateAll((nodes) => nodes.map((node) => node.dataset.slug))
const tab = (page, role) => page.locator(`[data-testid="role-tab"][data-role="${role}"]`)
const group = (page, role) => page.locator(`[data-testid="role-group"][data-role="${role}"]`)
const number = (text) => Number(text.match(/\d+/)[0])
const search = (page) => decodeURIComponent(new URL(page.url()).search)
const noHorizontalScroll = async (page, width) => expect(await page.evaluate(() => document.documentElement.scrollWidth), `${width}px 不横向滚动`).toBeLessThanOrEqual(width)

async function mockStats(page, heat = {}) {
  await page.route('**/api/stats', (route) => route.fulfill({ json: { ok: true, heat, byKind: {} } }))
}
/** 工具栏上的分组和数量：[{ role, count }]，不含「全部」。 */
const tabsOf = (page) => page.getByTestId('role-tab').evaluateAll((nodes) => nodes
  .filter((node) => node.dataset.role !== 'all')
  .map((node) => ({ role: node.dataset.role, count: Number(node.querySelector('.tab-count').textContent) })))
/** 第一个折起来的分组（带「展开 N 个」）；示例货架上没有。 */
const firstFolded = (page) => page.locator('[data-testid="role-group"][data-folded="true"]').first()

test.beforeEach(async ({ page, context }) => {
  await mockStats(page)
  await page.route('**/api/click', (route) => route.fulfill({ json: { ok: true, counted: true, heat: 1 } }))
  await context.route('https://x.ai/**', (route) => route.fulfill({ contentType: 'text/html', body: '<p>模拟导入页面</p>' }))
})

test('区块顺序：本周主推 → 小队的位置 → 专题 → 全部 Bot；接管页面时没有报错', async ({ page }) => {
  const problems = []
  page.on('console', (message) => { if (/hydration|mismatch/i.test(message.text())) problems.push(message.text()) })
  page.on('pageerror', (error) => problems.push(error.message))
  await page.goto('/')
  const order = await page.evaluate(() => ['featured-title', 'squads', 'collections-title', 'all-title'].map((id) => document.getElementById(id)?.getBoundingClientRect().top + window.scrollY))
  expect(order.every((top) => Number.isFinite(top)), '四个锚点都在').toBe(true)
  expect([...order].sort((a, b) => a - b)).toEqual(order)
  await expect(page.locator('#featured-title')).toHaveText('本周主推')
  await expect(page.locator('#collections-title')).toHaveText('专题')
  await expect(page.locator('#all-title')).toHaveText('全部 Bot')
  // 带着筛选打开也一样：服务端渲染的是默认状态，接管以后才按地址栏还原，不能有对不上的警告。
  const [first] = await tabsOf(page)
  await page.goto(`/?role=${encodeURIComponent(first.role)}`)
  await expect(tab(page, first.role)).toHaveAttribute('aria-pressed', 'true')
  expect(problems).toEqual([])
})

test('主推卡不带编辑点评（决策 79）：介绍下面就是底行，三张卡的底行落在同一条线上', async ({ page }) => {
  await page.goto('/')
  const featured = page.getByTestId('featured-card')
  expect(await featured.count()).toBeGreaterThan(0)
  for (const card of await featured.all()) {
    await expect(card.getByTestId('featured-note')).toHaveCount(0)
    await expect(card.locator('blockquote')).toHaveCount(0)
    const [tagline, foot] = await Promise.all(['.bot-tagline', '.featured-foot'].map((selector) => card.locator(selector).boundingBox()))
    expect(foot.y).toBeGreaterThanOrEqual(tagline.y + tagline.height)
  }
  const feet = await featured.locator('.featured-foot').evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().bottom)))
  if (await page.evaluate(() => innerWidth >= 900)) expect(new Set(feet).size).toBe(1)
})

test('专题：一叠小头像、+N、标题、数量；点一个滚到「全部 Bot」并按它筛选，清除还原', async ({ page }) => {
  await page.goto('/')
  const collection = page.getByTestId('collection-card')
  expect(await collection.count()).toBeGreaterThan(0)
  for (const card of await collection.all()) {
    const total = number(await card.locator('.collection-count').innerText())
    await expect(card.locator('.collection-count')).toHaveText(`${total} 个 Bot`)
    const faces = await card.locator('.collection-faces .bot-still').count()
    expect(faces).toBe(Math.min(4, total))
    if (total > 4) await expect(card.locator('.collection-more')).toHaveText(`+${total - 4}`)
    else await expect(card.locator('.collection-more')).toHaveCount(0)
    await expect(card).toHaveAttribute('aria-pressed', 'false')
    // 卡上只有标题和数量两行字（+N 在头像叠里），没有说明。
    expect(await card.evaluate((node) => [...node.children].map((child) => child.className))).toEqual(['collection-faces', 'collection-title', 'collection-count'])
  }
  const target = collection.last()
  const slug = await target.getAttribute('data-slug'), title = await target.locator('.collection-title').innerText()
  const total = number(await target.locator('.collection-count').innerText())
  await target.scrollIntoViewIfNeeded()
  await target.click()
  // 地址栏、筛选条、计数、分组切换回到「全部」。
  await expect.poll(() => search(page)).toBe(`?c=${slug}`)
  expect(new URL(page.url()).hash).toBe('#all')
  const bar = page.getByTestId('filter-bar')
  await expect(bar.locator('p')).toHaveText(`专题：${title} · ${total} 个`)
  await expect(bar.getByTestId('filter-clear')).toHaveText('清除')
  await expect(bar.getByTestId('filter-clear').locator('svg')).toHaveAttribute('data-icon', 'x')
  await expect(page.locator('.bot-count')).toHaveText(`共 ${total} 个`)
  await expect(tab(page, 'all')).toHaveAttribute('aria-pressed', 'true')
  await expect(target).toHaveAttribute('aria-pressed', 'true')
  // 不分组，每张卡带分组标签（前面一只小吉祥物）。
  await expect(page.getByTestId('role-group')).toHaveCount(0)
  await expect(cards(page)).toHaveCount(total)
  await expect(cards(page).locator('.category-tag')).toHaveCount(total)
  await expect(cards(page).first().locator('.category-tag [data-testid="still-bot"]')).toHaveCount(1)
  // 滚到了「全部 Bot」：标题在导航条下面、视口上半部分；焦点交给标题。
  await expect.poll(async () => (await page.locator('#all-title').boundingBox()).y).toBeLessThan(300)
  expect((await page.locator('#all-title').boundingBox()).y).toBeGreaterThanOrEqual(NAV)
  await expect(page.locator('#all-title')).toBeFocused()
  // 清除：回到按分组分段，地址栏干净。
  await bar.getByTestId('filter-clear').click()
  await expect(page.getByTestId('filter-bar')).toHaveCount(0)
  await expect.poll(() => new URL(page.url()).search + new URL(page.url()).hash).toBe('')
  expect(await page.getByTestId('role-group').count()).toBeGreaterThan(0)
  await expect(target).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('#all-title')).toBeFocused()
})

test('分组切换：带数量；选中一个只显示这一组并全部展开；写进地址栏，刷新还原', async ({ page }) => {
  await page.goto('/')
  const tabs = await tabsOf(page)
  const total = number(await tab(page, 'all').locator('.tab-count').innerText())
  expect(tabs.reduce((sum, item) => sum + item.count, 0), '各组数量加起来等于全部').toBe(total)
  await expect(page.locator('.bot-count')).toHaveText(`共 ${total} 个`)
  // 默认按分组分段：每个分组一段，顺序和工具栏一致；组头是吉祥物 + 分组名 + 数量。
  expect(await page.getByTestId('role-group').evaluateAll((nodes) => nodes.map((node) => node.dataset.role))).toEqual(tabs.map((item) => item.role))
  for (const item of tabs.slice(0, 3)) {
    const head = group(page, item.role).locator('.role-head')
    await expect(head.locator('h3')).toHaveText(item.role)
    await expect(head.locator('.bz-count')).toHaveText(`${item.count} 个`)
    await expect(head.getByTestId('live-bot')).toHaveCount(1)
    await expect(tab(page, item.role).getByTestId('still-bot')).toHaveCount(1)
    // 分组说明不显示在界面上，只在悬停提示里。
    await expect(head.locator('p')).toHaveCount(0)
    expect((await head.locator('h3').getAttribute('title'))?.length).toBeGreaterThan(3)
    expect(await tab(page, item.role).getAttribute('title')).toBe(await head.locator('h3').getAttribute('title'))
  }
  // 分组显示时卡片不带分组标签。
  await expect(cards(page).locator('.category-tag')).toHaveCount(0)
  const pick = tabs.reduce((best, item) => item.count > best.count ? item : best)
  await tab(page, pick.role).scrollIntoViewIfNeeded()
  await tab(page, pick.role).click()
  await expect(tab(page, pick.role)).toHaveAttribute('aria-pressed', 'true')
  await expect(tab(page, 'all')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('role-group')).toHaveCount(1)
  await expect(group(page, pick.role).getByTestId('bot-card')).toHaveCount(pick.count)
  await expect(page.getByTestId('group-more')).toHaveCount(0)
  await expect(page.locator('.bot-count')).toHaveText(`共 ${pick.count} 个`)
  expect(search(page)).toBe(`?role=${pick.role}`)
  // 刷新还原。
  await page.reload()
  await expect(tab(page, pick.role)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('role-group')).toHaveCount(1)
  await expect(cards(page)).toHaveCount(pick.count)
  // 回到「全部」：地址栏干净。
  await tab(page, 'all').click()
  await expect(page.getByTestId('role-group')).toHaveCount(tabs.length)
  expect(new URL(page.url()).search).toBe('')
})

test('地址栏：专题刷新还原；不认识的值清掉，别的参数留着', async ({ page }) => {
  await page.goto('/')
  const slug = await page.getByTestId('collection-card').first().getAttribute('data-slug')
  const expected = await (async () => {
    await page.getByTestId('collection-card').first().click()
    await expect(page.getByTestId('filter-bar')).toBeVisible()
    return slugsOf(cards(page))
  })()
  // 直接打开带专题的地址（没写锚点）：筛选还原，并且落在「全部 Bot」上。
  await page.goto(`/?c=${slug}`)
  await expect(page.getByTestId('filter-bar')).toBeVisible()
  expect(await slugsOf(cards(page))).toEqual(expected)
  expect(new URL(page.url()).hash).toBe('#all')
  await expect.poll(async () => (await page.locator('#all-title').boundingBox()).y).toBeLessThan(300)
  await page.reload()
  await expect(page.getByTestId('filter-bar')).toBeVisible()
  expect(await slugsOf(cards(page))).toEqual(expected)
  // 不认识的分组和专题：当没写，顺手从地址栏里清掉；别的参数原样留着。
  await page.goto('/?role=没有这个分组&c=no-such-collection&keep=1')
  await expect(tab(page, 'all')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('filter-bar')).toHaveCount(0)
  await expect.poll(() => search(page)).toBe('?keep=1')
})

test('筛选为空：分组里还没有 Bot 时，一只睡着的 Bot、一句话、一个按钮', async ({ page }) => {
  await page.goto('/')
  const present = (await tabsOf(page)).map((item) => item.role)
  // 九个分组的名字跟 schema 走；挑一个货架上还没有 Bot 的。真实货架九组都有，就没有这个状态。
  const { loadEnums } = await import('../../scripts/lib/load-bots.mjs')
  const empty = loadEnums().categories.find((category) => !present.includes(category))
  test.skip(!empty, '每个分组都有 Bot，出现不了空状态')
  await page.goto(`/?role=${encodeURIComponent(empty)}`)
  const state = page.getByTestId('empty-filter')
  await expect(state.locator('p')).toHaveText('这个分组还没有 Bot')
  await expect(state.getByTestId('live-bot')).toHaveAttribute('data-state', 'sleep')
  await expect(state.locator('.bz-btn')).toHaveText('看看全部')
  await expect(state.locator('.bz-btn svg')).toHaveAttribute('data-icon', 'grid')
  await expect(page.locator('.bot-count')).toHaveText('共 0 个')
  await expect(page.getByTestId('role-tab').and(page.locator('[aria-pressed="true"]'))).toHaveCount(0)
  await state.locator('.bz-btn').click()
  await expect(page.getByTestId('empty-filter')).toHaveCount(0)
  await expect(tab(page, 'all')).toHaveAttribute('aria-pressed', 'true')
  expect(new URL(page.url()).search).toBe('')
})

test('排序：推荐 / 最新 / 最热三项；专题里「推荐」是编辑排的顺序，「最热」按热度', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.sort-seg > button')).toHaveText(['推荐', '最新', '最热'])
  await expect(page.getByTestId('sort-rec')).toHaveAttribute('aria-pressed', 'true')
  const first = page.getByTestId('collection-card').first()
  const slug = await first.getAttribute('data-slug')
  await first.click()
  await expect(page.getByTestId('filter-bar')).toBeVisible()
  const curated = await slugsOf(cards(page))
  expect(curated.length).toBeGreaterThanOrEqual(2)
  // 给专题里最后一个 Bot 最高的热度：切到「最热」它排第一；切回「推荐」还是编辑的顺序。
  const last = curated.at(-1)
  await page.unroute('**/api/stats')
  await mockStats(page, { [last]: 99 })
  await page.goto(`/?c=${slug}`)
  await expect(cards(page).first()).toBeVisible()
  expect(await slugsOf(cards(page))).toEqual(curated)
  await page.getByTestId('sort-hot').click()
  await expect(page.getByTestId('sort-hot')).toHaveAttribute('aria-pressed', 'true')
  expect((await slugsOf(cards(page)))[0]).toBe(last)
  expect([...await slugsOf(cards(page))].sort()).toEqual([...curated].sort())
  await page.getByTestId('sort-rec').click()
  expect(await slugsOf(cards(page))).toEqual(curated)
})

test('展开 / 收起：每组先露两行，展开露出全部；收起以后组头还在屏幕里', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  const folded = firstFolded(page)
  test.skip(!(await folded.count()), '这份货架上没有折得起来的分组（示例货架每组只有一个 Bot）')
  const role = await folded.getAttribute('data-role')
  const section = group(page, role), more = section.getByTestId('group-more')
  const total = number(await section.locator('.role-head .bz-count').innerText())
  // 两列：先露 4 张。
  await expect(section.getByTestId('bot-card')).toHaveCount(4)
  await expect(more).toHaveText(`展开 ${total - 4} 个`)
  await expect(more).toHaveAttribute('aria-expanded', 'false')
  await expect(more.locator('svg')).toHaveAttribute('data-icon', 'chevron-down')
  expect(await more.getAttribute('aria-controls')).toBe(await section.locator('.bot-grid').getAttribute('id'))
  await more.scrollIntoViewIfNeeded()
  await more.click()
  await expect(section.getByTestId('bot-card')).toHaveCount(total)
  await expect(more).toHaveText('收起')
  await expect(more).toHaveAttribute('aria-expanded', 'true')
  // 别的分组不受影响。
  const others = page.locator(`[data-testid="role-group"][data-folded="true"]`)
  for (const other of await others.all()) await expect(other.getByTestId('bot-card')).toHaveCount(4)
  // 收起：按钮在屏幕下半时，它留在原地（上面收走多少，页面回滚多少）。
  await more.scrollIntoViewIfNeeded()
  await page.evaluate((y) => window.scrollBy(0, y - 700), (await more.boundingBox()).y)
  const before = (await more.boundingBox()).y
  await more.click()
  await expect(section.getByTestId('bot-card')).toHaveCount(4)
  expect(Math.abs((await more.boundingBox()).y - before), '收起后按钮留在手底下').toBeLessThanOrEqual(2)
  // 再展开，把按钮滚到屏幕顶上再收起：这回组头会被顶出去，所以退到组头。
  await more.click()
  await expect(section.getByTestId('bot-card')).toHaveCount(total)
  await page.evaluate((y) => window.scrollBy(0, y - 260), (await more.boundingBox()).y)
  await more.click()
  await expect(section.getByTestId('bot-card')).toHaveCount(4)
  const head = await section.locator('.role-head').boundingBox()
  expect(head.y, '组头在导航条和工具栏下面').toBeGreaterThanOrEqual(NAV)
  expect(head.y).toBeLessThan(400)
})

test('点进详情再退回来：分组、排序、滚动位置都还原（展开过的分组也还在）', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  // 先落在详情页上再走到首页，然后进详情、后退：这样首页前后两次用的是同一份页面代码还是两份，都要能还原。
  for (const entry of ['/', 'detail']) {
    if (entry === '/') await page.goto('/')
    else {
      await page.goto('/')
      const first = await cards(page).first().getAttribute('data-slug')
      await page.goto(`/bots/${first}`)
      await page.locator('.VPNavBarTitle a').click()
      await expect(cards(page).first()).toBeVisible()
    }
    const tabs = await tabsOf(page)
    const pick = tabs.reduce((best, item) => item.count > best.count ? item : best)
    await page.getByTestId('sort-new').click()
    await tab(page, pick.role).scrollIntoViewIfNeeded()
    await tab(page, pick.role).click()
    await expect(page.getByTestId('role-group')).toHaveCount(1)
    const target = cards(page).last()
    await target.scrollIntoViewIfNeeded()
    const scrolled = await page.evaluate(() => window.scrollY)
    await target.getByTestId('detail-link').click()
    await expect(page.getByTestId('bot-detail')).toBeVisible()
    await page.goBack()
    await expect(page.getByTestId('sort-new'), `从 ${entry} 进来：排序还在`).toHaveAttribute('aria-pressed', 'true')
    await expect(tab(page, pick.role)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('role-group')).toHaveCount(1)
    await expect(cards(page)).toHaveCount(pick.count)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrolled - 40)
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(scrolled + 40)
  }
  // 展开过的分组：示例货架折不起来，只在真实货架上验。
  await tab(page, 'all').click()
  const folded = firstFolded(page)
  if (!(await folded.count())) return
  const role = await folded.getAttribute('data-role')
  const section = group(page, role)
  const total = number(await section.locator('.role-head .bz-count').innerText())
  await section.getByTestId('group-more').scrollIntoViewIfNeeded()
  await section.getByTestId('group-more').click()
  await expect(section.getByTestId('bot-card')).toHaveCount(total)
  const target = section.getByTestId('bot-card').nth(total - 1)
  await target.scrollIntoViewIfNeeded()
  const scrolled = await page.evaluate(() => window.scrollY)
  await target.getByTestId('detail-link').click()
  await expect(page.getByTestId('bot-detail')).toBeVisible()
  await page.goBack()
  await expect(section.getByTestId('bot-card')).toHaveCount(total)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrolled - 40)
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(scrolled + 40)
})

test('工具栏吸在导航条下面：吸住以后是玻璃底，盖在卡片上面；切分组时列表回到开头', async ({ page }) => {
  // 视口矮一点，示例货架（只有三张卡）也滚得到吸顶的位置。
  await page.setViewportSize({ width: 1280, height: 560 })
  await page.goto('/')
  const bar = page.locator('.shelf-toolbar')
  await expect(bar).toHaveAttribute('data-stuck', 'false')
  await expect(bar).toHaveCSS('position', 'sticky')
  expect(await bar.evaluate((el) => getComputedStyle(el).backdropFilter)).toBe('none')
  // 分组的左边缘和内容对齐，排序贴右边。
  const content = await page.locator('#all .bz-section-head').boundingBox()
  expect(Math.abs((await page.locator('.role-tabs').boundingBox()).x - content.x)).toBeLessThanOrEqual(1)
  const sort = await page.locator('.sort-seg').boundingBox()
  expect(Math.abs(sort.x + sort.width - content.x - content.width)).toBeLessThanOrEqual(1)
  await page.evaluate(() => window.scrollTo(0, document.querySelector('.shelf-list').getBoundingClientRect().top + window.scrollY - 40))
  await expect(bar).toHaveAttribute('data-stuck', 'true')
  expect(Math.round((await bar.boundingBox()).y)).toBe(NAV)
  expect(await bar.evaluate((el) => getComputedStyle(el).backdropFilter)).toContain('blur')
  await expect(bar).toHaveCSS('border-radius', '12px')
  // 吸住的工具栏在卡片上面：它中心那一点点到的是工具栏自己。
  expect(await bar.evaluate((el) => {
    const box = el.getBoundingClientRect()
    return el.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2))
  })).toBe(true)
  // 吸着的时候切分组：工具栏不动，列表的开头回到工具栏下面。
  const last = (await tabsOf(page)).at(-1)
  await tab(page, last.role).click()
  await expect(page.getByTestId('role-group')).toHaveCount(1)
  const list = await page.locator('.shelf-list').boundingBox(), stuck = await bar.boundingBox()
  expect(list.y, '列表开头在工具栏下面').toBeGreaterThanOrEqual(stuck.y + stuck.height)
  expect(list.y).toBeLessThan(stuck.y + stuck.height + 40)
})

test('键盘：专题卡回车筛选，焦点到「全部 Bot」；接着 Tab 是分组、排序、清除、第一张卡', async ({ page }) => {
  await page.goto('/')
  const first = page.getByTestId('collection-card').first()
  await first.focus()
  await expect(first).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('filter-bar')).toBeVisible()
  await expect(page.locator('#all-title')).toBeFocused()
  const tabs = await page.getByTestId('role-tab').count()
  const focused = () => page.evaluate(() => document.activeElement?.dataset.testid ?? document.activeElement?.tagName)
  for (let index = 0; index < tabs; index++) {
    await page.keyboard.press('Tab')
    expect(await focused()).toBe('role-tab')
  }
  for (const id of ['sort-rec', 'sort-new', 'sort-hot', 'filter-clear', 'avatar']) {
    await page.keyboard.press('Tab')
    expect(await focused()).toBe(id)
  }
  // 焦点看得见：2px 实线。分组那一条自己会滚动，框画在按钮里面，不被裁掉。
  for (const control of [page.getByTestId('role-tab').nth(1), page.getByTestId('sort-new'), page.getByTestId('filter-clear'), first]) {
    await control.focus()
    const outline = await control.evaluate((el) => { const css = getComputedStyle(el); return { style: css.outlineStyle, width: parseFloat(css.outlineWidth), offset: parseFloat(css.outlineOffset) } })
    expect(outline.style).toBe('solid')
    expect(outline.width).toBeGreaterThanOrEqual(2)
  }
  // 空格选分组也能用。
  await page.getByTestId('role-tab').nth(1).focus()
  expect(await page.getByTestId('role-tab').nth(1).evaluate((el) => parseFloat(getComputedStyle(el).outlineOffset))).toBeLessThan(0)
  await page.keyboard.press('Space')
  await expect(page.getByTestId('role-tab').nth(1)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('filter-bar')).toHaveCount(0)
  await expect(page.getByTestId('role-group')).toHaveCount(1)
  // 读屏：两组控件都有名字；专题卡是带按下状态的按钮。
  await expect(page.locator('.role-tabs')).toHaveAttribute('role', 'group')
  await expect(page.locator('.role-tabs')).toHaveAttribute('aria-label', '按分组筛选')
  await expect(page.locator('.sort-seg')).toHaveAttribute('aria-label', '排序')
  expect(await first.evaluate((el) => el.tagName)).toBe('BUTTON')
})

for (const width of [1440, 1280, 1100, 1024, 900, 768, 680, 390, 320]) {
  test(`${width}px：首页三种状态都不横向滚动；专题和分组条放不下时自己滑`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(cards(page).first()).toBeVisible()
    await noHorizontalScroll(page, width)
    // 专题：≥1100 五列等宽排开；更窄是一条自己横向滑动的带子。
    const strip = page.locator('.collection-strip')
    const stripCss = await strip.evaluate((el) => { const css = getComputedStyle(el); return { overflow: css.overflowX, snap: css.scrollSnapType, columns: css.gridTemplateColumns.split(' ').length } })
    if (width >= 1100) expect(stripCss).toMatchObject({ overflow: 'visible', columns: 5 })
    else { expect(stripCss.overflow).toBe('auto'); expect(stripCss.snap).toMatch(/^x/) }
    // 分组条：内容比容器宽就能自己滑，还没滑到头的那一侧渐隐。
    const tabs = page.locator('.role-tabs')
    const overflow = await tabs.evaluate((el) => el.scrollWidth - el.clientWidth)
    await expect(tabs).toHaveAttribute('data-fade', overflow > 1 ? 'right' : 'none')
    if (overflow > 1) {
      await tabs.evaluate((el) => { el.scrollLeft = el.scrollWidth })
      await expect(tabs).toHaveAttribute('data-fade', 'left')
    }
    // 排序：≥680 和分组在同一行、贴右；更窄换到分组下面。
    const tabsBox = await tabs.boundingBox(), sortBox = await page.locator('.sort-seg').boundingBox()
    if (width >= 680) expect(Math.abs(sortBox.y - tabsBox.y)).toBeLessThanOrEqual(1)
    else expect(sortBox.y).toBeGreaterThanOrEqual(tabsBox.y + tabsBox.height)
    // 选中单个分组、专题筛选两种状态也不横向滚动。
    await page.getByTestId('role-tab').last().click()
    await expect(page.getByTestId('role-group')).toHaveCount(1)
    await noHorizontalScroll(page, width)
    // 选中的分组滑进了分组条里看得见的地方。
    const pressed = await page.getByTestId('role-tab').last().boundingBox(), track = await tabs.boundingBox()
    expect(pressed.x).toBeGreaterThanOrEqual(track.x - 1)
    expect(pressed.x + pressed.width).toBeLessThanOrEqual(track.x + track.width + 1)
    await page.getByTestId('collection-card').first().click()
    await expect(page.getByTestId('filter-bar')).toBeVisible()
    await noHorizontalScroll(page, width)
    const barBox = await page.getByTestId('filter-bar').boundingBox()
    expect(barBox.x).toBeGreaterThanOrEqual(0)
    expect(barBox.x + barBox.width).toBeLessThanOrEqual(width)
  })
}

test('手机 390：触摸目标够大；只有分组条吸顶；单列时每组先露两张', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  try {
    const page = await context.newPage()
    await mockStats(page)
    await page.goto('/')
    await expect(cards(page).first()).toBeVisible()
    await noHorizontalScroll(page, 390)
    for (const control of await page.locator('.role-tabs, .sort-seg, [data-testid="collection-card"], [data-testid="group-more"]').all()) {
      expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44)
    }
    // 工具栏在手机上不是一整条：只有分组条吸顶，排序跟着页面滚走。
    await expect(page.locator('.role-tabs')).toHaveCSS('position', 'sticky')
    await page.evaluate(() => window.scrollTo(0, document.querySelector('.shelf-list').getBoundingClientRect().top + window.scrollY + 120))
    await expect(page.locator('.shelf-toolbar')).toHaveAttribute('data-stuck', 'true')
    const tabs = await page.locator('.role-tabs').boundingBox()
    expect(Math.round(tabs.y)).toBe(80) // 窄屏正文仍让位 80px，不跟着页眉外观缩短。
    expect((await page.locator('.sort-seg').boundingBox()).y, '排序滚到分组条上面去了').toBeLessThan(tabs.y)
    // 点专题（触摸）：筛选并滚到列表。
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.getByTestId('collection-card').first().tap()
    await expect(page.getByTestId('filter-bar')).toBeVisible()
    await noHorizontalScroll(page, 390)
    await page.getByTestId('filter-clear').tap()
    await expect(page.getByTestId('filter-bar')).toHaveCount(0)
    // 单列：折起来的分组先露 2 张。
    const folded = firstFolded(page)
    if (await folded.count()) {
      const total = number(await folded.locator('.role-head .bz-count').innerText())
      await expect(folded.getByTestId('bot-card')).toHaveCount(2)
      await expect(folded.getByTestId('group-more')).toHaveText(`展开 ${total - 2} 个`)
    }
  } finally { await context.close() }
})

test('减少动效：切筛选不淡入、滚动不走动画、吉祥物不跳、箭头不转着过去', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  const running = () => page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === 'running' && animation.effect?.target?.closest?.('.shelf-section, .shelf-toolbar')).length)
  // 点专题：直接到位，不平滑滚动，列表不淡入。
  await page.getByTestId('collection-card').first().click()
  await expect(page.getByTestId('filter-bar')).toBeVisible()
  const settled = await page.evaluate(() => window.scrollY)
  await page.waitForTimeout(250)
  expect(await page.evaluate(() => window.scrollY)).toBe(settled)
  expect((await page.locator('#all-title').boundingBox()).y).toBeLessThan(300)
  await expect(page.locator('.shelf-list')).not.toHaveClass(/grid-enter/)
  expect(await running()).toBe(0)
  await page.getByTestId('filter-clear').click()
  await page.getByTestId('sort-new').click()
  await page.getByTestId('role-tab').nth(1).click()
  await expect(page.locator('.shelf-list')).not.toHaveClass(/grid-enter/)
  expect(await running()).toBe(0)
  // 排序滑块、工具栏换底都不过渡。
  expect(await page.locator('.sort-seg').evaluate((el) => parseFloat(getComputedStyle(el, '::after').transitionDuration))).toBe(0)
  // 组头的吉祥物：悬停不跳，也不变身。
  await page.getByTestId('role-tab').first().click()
  const tile = page.locator('.role-tile').first()
  await tile.scrollIntoViewIfNeeded()
  await tile.hover()
  await page.waitForTimeout(150)
  expect(await tile.locator('.role-hop').evaluate((el) => el.getAnimations().length)).toBe(0)
  await expect(tile.getByTestId('live-bot')).toHaveAttribute('data-running', 'false')
  // 展开 / 收起：新露出来的卡片不淡入，箭头不旋转着过去。
  const more = page.getByTestId('group-more').first()
  if (await more.count()) {
    await more.scrollIntoViewIfNeeded()
    await more.click()
    expect(await running()).toBe(0)
    expect(await more.locator('svg').evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration))).toBe(0)
  }
})

test('有动效时：切筛选列表淡入 200ms；组头吉祥物悬停睁大眼跳一下，点它是戳', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await page.getByTestId('role-tab').nth(1).scrollIntoViewIfNeeded()
  // 淡入只有 200ms，机器忙的时候事后去量已经播完了：在动画开始的那一刻记下来。
  await page.locator('.shelf-list').evaluate((el) => el.addEventListener('animationstart', (event) => {
    if (event.target === el) el.dataset.entered = `${event.animationName}:${getComputedStyle(el).animationDuration}`
  }))
  await page.getByTestId('role-tab').nth(1).click()
  await expect(page.locator('.shelf-list')).toHaveAttribute('data-entered', 'bz-grid-enter:0.2s')
  await expect(page.locator('.shelf-list')).not.toHaveClass(/grid-enter/)
  await page.getByTestId('role-tab').first().click()
  const tile = page.locator('.role-tile').first(), bot = tile.getByTestId('live-bot')
  await tile.scrollIntoViewIfNeeded()
  await page.mouse.move(4, 4)
  await tile.hover()
  await expect(bot).toHaveAttribute('data-state', 'wide')
  expect(await tile.locator('.role-hop').evaluate((el) => el.getAnimations().map((animation) => animation.animationName))).toContain('bz-bounce')
  // 砖本身不位移、不缩放。
  await expect(tile).toHaveCSS('transform', 'none')
  await tile.click()
  await expect(bot).not.toHaveAttribute('data-state', 'wide')
  await page.mouse.move(4, 4)
  await expect(bot).toHaveAttribute('data-state', 'idle', { timeout: 6000 })
})

for (const dark of [false, true]) {
  test(`${dark ? '深' : '浅'}色：新部件的文字对比度 ≥ 4.5，文字的祖先上没有背景图`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light' })
    await page.goto('/')
    await page.evaluate((dark) => document.documentElement.classList.toggle('dark', dark), dark)
    await page.getByTestId('collection-card').first().click()
    await expect(page.getByTestId('filter-bar')).toBeVisible()
    const selector = [
      '.collection-title', '.collection-count', '.collection-more',
      '[data-testid="role-tab"] > span', '.sort-seg > button', '.bot-count', '[data-testid="filter-bar"] p > *', '[data-testid="filter-clear"]',
    ].join(', ')
    const check = (selector) => page.locator(selector).evaluateAll((nodes) => {
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
      const rgba = (css) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1); const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data; return { c: [r, g, b], a: a / 255 } }
      const luminance = (rgb) => rgb.map((v) => v / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
      return nodes.filter((node) => node.textContent.trim()).map((node) => {
        const layers = []
        let image = false
        for (let at = node; at; at = at.parentElement) {
          const css = getComputedStyle(at)
          if (css.backgroundImage !== 'none') image = true
          const layer = rgba(css.backgroundColor)
          if (layer.a > 0) layers.push(layer)
          if (layer.a === 1) break
        }
        const bg = layers.reverse().reduce((under, layer) => under.map((v, i) => layer.c[i] * layer.a + v * (1 - layer.a)), [255, 255, 255])
        const ink = rgba(getComputedStyle(node).color)
        const fg = ink.c.map((v, i) => v * ink.a + bg[i] * (1 - ink.a))
        const a = luminance(fg), b = luminance(bg)
        return { text: node.textContent.trim().slice(0, 12), ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), image }
      })
    })
    const results = await check(selector)
    expect(results.length).toBeGreaterThan(10)
    for (const result of results) {
      expect(result.ratio, `「${result.text}」的对比度`).toBeGreaterThanOrEqual(4.5)
      expect(result.image, `「${result.text}」的祖先上没有背景图`).toBe(false)
    }
    // 组头和展开按钮在分组显示时才有。
    await page.getByTestId('filter-clear').click()
    for (const result of await check('.role-head h3, .role-head .bz-count, [data-testid="group-more"]')) {
      expect(result.ratio, `「${result.text}」的对比度`).toBeGreaterThanOrEqual(4.5)
      expect(result.image).toBe(false)
    }
  })
}
