// 小队：首页的「小队」区块、小队详情页、搜索面板里的小队。测试数据是 tests/fixtures/squads/demo-squad。
import { test, expect } from '@playwright/test'
import { SQUAD_COPY, SQUAD_CONTRIBUTE_URL } from '../../site/.vitepress/meta.mjs'

const squad = 'demo-squad'
const lead = 'demo-prd-reviewer'
const weekly = 'demo-weekly-digest'
const external = 'demo-external'
const kickoff = '你是这支小队的队长。记录员负责整理周报，外援负责补外部资料；有活先分给他们，再把结果汇总给我。'
const card = (page) => page.locator(`[data-testid="squad-card"][data-slug="${squad}"]`)
const member = (page, slug) => page.locator(`[data-testid="squad-member"][data-slug="${slug}"]`)
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
/** 页面上正在跑的 CSS 动画数（过渡不算）。 */
const running = (page) => page.evaluate(() => document.getAnimations().filter((item) => item instanceof CSSAnimation && item.playState === 'running').length)

test.beforeEach(async ({ context, page }) => {
  await context.route('https://x.ai/**', (route) => route.fulfill({ contentType: 'text/html', body: '<p>模拟导入页面</p>' }))
  await page.route('**/api/stats', (route) => route.fulfill({ json: { ok: true, heat: {}, byKind: {}, squads: {} } }))
  await page.route('**/api/click', (route) => route.fulfill({ json: { ok: true, counted: true, heat: route.request().postDataJSON().kind === 'kickoff' ? 0 : 1 } }))
})

test.describe('首页的小队区块', () => {
  test('排在本周主推后面、全部 Bot 前面；小队卡有合影、标签、名字、介绍和一行名单，没有按钮', async ({ page }) => {
    await page.goto('/')
    const section = page.locator('#squads')
    await expect(section.locator('h2')).toHaveText(SQUAD_COPY.title)
    // 区块只有标题和卡片，没有说明句。
    await expect(section.locator('.bz-section-head p')).toHaveCount(0)
    const order = await page.evaluate(() => {
      const top = (selector) => document.querySelector(selector).getBoundingClientRect().top
      return [top('[data-testid="featured-card"]'), top('#squads'), top('#all')]
    })
    expect(order[0]).toBeLessThan(order[1])
    expect(order[1]).toBeLessThan(order[2])

    await expect(page.getByTestId('squad-card')).toHaveCount(1)
    const item = card(page)
    await expect(item.locator('.squad-tag')).toHaveText(SQUAD_COPY.tag)
    await expect(item.getByTestId('squad-card-formation')).toHaveText('带队')
    await expect(item.getByTestId('squad-card-count')).toHaveText('3 个 Bot')
    await expect(item.locator('h3')).toHaveText('示例·周会小队')
    await expect(item.locator('.squad-card-tagline')).toHaveText('一个评审员带两个帮手，把周会前后的事包了')
    await expect(item.getByTestId('squad-card-roster')).toHaveText('队长 示例·PRD 评审员 · 专员 2 个')
    // 整卡可点：DOM 里只有一个链接，没有按钮；合影是装饰。
    await expect(item.locator('a')).toHaveCount(1)
    await expect(item.locator('button')).toHaveCount(0)
    await expect(item.locator('a')).toHaveAttribute('href', `/squads/${squad}`)
    await expect(item.locator('.squad-photo')).toHaveAttribute('aria-hidden', 'true')
    // 三个成员都在合影里：两只活的 Bot，队长用的是自己上传的头像图片。
    await expect(item.locator('.squad-photo .photo-member')).toHaveCount(3)
    await expect(item.locator('.squad-photo [data-testid="live-bot"]')).toHaveCount(2)
    await expect(item.locator(`.photo-member[data-slug="${lead}"] img`)).toHaveCount(1)
    // 队长站在最前面、最大。
    const sizes = await item.locator('.photo-member').evaluateAll((nodes) => nodes.map((node) => ({ slug: node.dataset.slug, width: node.getBoundingClientRect().width, z: Number(getComputedStyle(node).zIndex) })))
    const boss = sizes.find((entry) => entry.slug === lead)
    for (const entry of sizes.filter((entry) => entry.slug !== lead)) {
      expect(boss.width).toBeGreaterThan(entry.width)
      expect(boss.z).toBeGreaterThan(entry.z)
    }
  })

  test('点合影也进小队页；键盘 Tab 能走到卡片并用回车进入，焦点看得见', async ({ page }) => {
    await page.goto('/')
    await card(page).scrollIntoViewIfNeeded()
    const photo = await card(page).locator('.squad-photo').boundingBox()
    await page.mouse.click(photo.x + photo.width / 2, photo.y + 20)
    await expect(page).toHaveURL(new RegExp(`/squads/${squad}$`))
    await expect(page.getByTestId('squad-detail')).toBeVisible()

    await page.goto('/')
    const link = card(page).locator('a')
    await link.focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(link).toBeFocused()
    expect(await link.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`/squads/${squad}$`))
  })

  test('悬停小队卡：全员睁大眼并依次跳一下，离开后回到平常', async ({ page }) => {
    await page.goto('/')
    await card(page).scrollIntoViewIfNeeded()
    const bots = card(page).locator('[data-testid="live-bot"]')
    await expect(bots).toHaveCount(2)
    await card(page).hover()
    for (const index of [0, 1]) await expect(bots.nth(index)).toHaveAttribute('data-state', 'wide')
    await expect(card(page).locator('.photo-hop.is-hopping').first()).toBeVisible()
    const delays = await card(page).locator('.photo-hop').evaluateAll((nodes) => nodes.map((node) => node.style.animationDelay))
    expect(delays).toEqual(['0ms', '80ms', '160ms'])
    await page.mouse.move(5, 5)
    for (const index of [0, 1]) await expect(bots.nth(index)).toHaveAttribute('data-state', 'idle')
  })

  test('招募卡：虚线边、三只空位、只有一个「投稿小队」按钮', async ({ page }) => {
    await page.goto('/')
    const recruit = page.getByTestId('squad-recruit')
    await expect(recruit).toHaveCSS('border-top-style', 'dashed')
    await expect(recruit.locator('.squad-still.is-ghost')).toHaveCount(3)
    await expect(recruit.locator('a, button')).toHaveCount(1)
    const link = recruit.locator('a')
    await expect(link).toHaveAttribute('href', SQUAD_CONTRIBUTE_URL)
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link.locator('svg')).toHaveAttribute('data-icon', 'plus')
    // 和站里其他外链一样：后面一个对读屏隐藏的「↗」，外加一句读屏文本。
    await expect(link.locator('.external-icon[aria-hidden="true"]')).toHaveCount(1)
    await expect(link).toContainText('（在新标签页打开）')
    // 卡上没有别的字（外链的「↗」小箭头和给读屏的那句「在新标签页打开」不算）。
    const visible = await recruit.evaluate((el) => {
      const copy = el.cloneNode(true)
      copy.querySelectorAll('.bz-sr-only, .external-icon').forEach((node) => node.remove())
      return copy.textContent.trim()
    })
    expect(visible).toBe(SQUAD_COPY.recruit)
  })
})

test.describe('小队详情页', () => {
  test('头部和各区块：合影、标签、阵容、步骤、代价、要知道的事；全页只有一个实心主按钮', async ({ page }) => {
    const errors = []
    await page.route('**/api/events', r => r.fulfill({ status: 204 }))
    // 作者行的小头像走同源的 /api/avatar（决策 77）；静态预览没有函数，给一张小图，不让 404 记成控制台错误。
    await page.route('**/api/avatar/**', r => r.fulfill({ path: 'site/public/apple-touch-icon.png', contentType: 'image/png' }))
    page.on('console', (message) => { if (message.type() === 'error' || /hydration/i.test(message.text())) errors.push(message.text()) })
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`/squads/${squad}`)
    const detail = page.getByTestId('squad-detail')
    await expect(detail.locator('h1')).toHaveText('示例·周会小队')
    await expect(page).toHaveTitle(/示例·周会小队/)
    await expect(page.getByTestId('squad-tagline')).toHaveText('一个评审员带两个帮手，把周会前后的事包了')
    await expect(page.getByTestId('squad-formation')).toHaveText('带队')
    await expect(page.getByTestId('squad-count')).toHaveText('3 个 Bot')
    await expect(page.getByTestId('squad-author')).toHaveAttribute('href', '/authors/example-user')
    await expect(page.getByTestId('squad-origin')).toContainText('本站编队')
    await expect(detail.locator('.bz-btn.primary')).toHaveCount(1)
    await expect(page.getByTestId('squad-start')).toHaveText(SQUAD_COPY.start)

    // 合影舞台：三个成员（队长是头像图片，另外两只是活的 Bot），每只脚下一块名牌写着队内岗位，队长那块是实心的。
    const stage = page.getByTestId('squad-stage')
    await expect(stage.locator('.photo-member')).toHaveCount(3)
    await expect(stage.locator('[data-testid="live-bot"]')).toHaveCount(2)
    await expect(stage.locator('.photo-plate')).toHaveText(['记录员', '队长', '外援'])
    const plates = await stage.locator('.photo-member').evaluateAll((nodes) => nodes.map((node) => ({ lead: node.classList.contains('lead'), background: getComputedStyle(node.querySelector('.photo-plate')).backgroundColor })))
    expect(plates.filter((plate) => plate.lead)).toHaveLength(1)
    expect(new Set(plates.map((plate) => plate.background)).size).toBe(2)

    // 区块标题只有这五个，没有说明句。
    await expect(detail.locator('.squad-section-head h2')).toHaveText([SQUAD_COPY.roster, SQUAD_COPY.flow, SQUAD_COPY.setup, SQUAD_COPY.cost, SQUAD_COPY.notes])
    await expect(detail.locator('.squad-section-head p')).toHaveCount(0)

    // 阵容：队长第一行、实心标签；可选的标「可选」；没收录的排最后、标「未收录」、没有导入。
    await expect(page.getByTestId('squad-member')).toHaveCount(3)
    await expect(member(page, lead)).toHaveAttribute('data-lead', 'true')
    await expect(member(page, lead).getByTestId('member-title')).toHaveClass(/solid/)
    await expect(member(page, lead).getByTestId('member-title')).toHaveText('队长')
    await expect(member(page, lead).getByTestId('member-does')).toHaveText('评审会前把 PRD 挑一遍，把活分给另外两位')
    await expect(member(page, lead).getByTestId('member-link')).toHaveAttribute('href', `/bots/${lead}`)
    await expect(member(page, external).getByTestId('member-optional')).toHaveText(SQUAD_COPY.optional)
    await expect(member(page, weekly).getByTestId('member-optional')).toHaveCount(0)
    for (const slug of [lead, weekly, external]) {
      const button = member(page, slug).getByTestId('member-import')
      await expect(button).toHaveAttribute('href', `https://x.ai/bot/${slug}-000`)
      await expect(button).toHaveAttribute('target', '_blank')
      await expect(button).toHaveAttribute('rel', 'noopener noreferrer')
    }
    const missing = page.getByTestId('squad-missing')
    await expect(missing).toHaveCount(1)
    await expect(missing.locator('.bz-tag')).toHaveText(SQUAD_COPY.missing)
    await expect(missing.locator('a')).toHaveCount(0)
    expect(await page.locator('.roster > li').last().getAttribute('data-testid')).toBe('squad-missing')

    // 组队步骤：编号 1…N，先导入，再是数据里的接线步骤，然后口令，最后试一句。
    const steps = page.locator('.setup-step')
    await expect(steps).toHaveCount(5)
    expect(await steps.evaluateAll((nodes) => nodes.map((node) => node.dataset.step))).toEqual(['import', 'setup', 'setup', 'kickoff', 'tryout'])
    await expect(steps.locator('.step-no')).toHaveText(['1', '2', '3', '4', '5'])
    await expect(page.getByTestId('setup-progress')).toHaveText('已导入 0 / 3')
    await expect(steps.nth(1).locator('.step-title')).toHaveText('放进同一个分区')
    await expect(page.getByTestId('squad-kickoff').locator('.message-text')).toHaveText(kickoff)
    await expect(page.getByTestId('squad-kickoff').locator('.message-to')).toContainText('示例·PRD 评审员')
    await expect(page.getByTestId('squad-tryout').locator('.message-text')).toHaveText('帮我看看这份 PRD，评审意见顺手记进本周周报。')

    // 整队的代价：三块的小标题；含义放在 title 和读屏文本里。
    const cost = page.getByTestId('squad-cost')
    await expect(cost.locator('.cost-col > h3')).toHaveText([SQUAD_COPY.quota, SQUAD_COPY.permissions, SQUAD_COPY.prerequisites])
    await expect(page.getByTestId('squad-quota').locator('.cost-row')).toHaveCount(3)
    await expect(page.getByTestId('squad-quota').locator('.cost-row').first()).toHaveAttribute('title', /.+/)
    await expect(page.getByTestId('squad-notes').locator('li')).toHaveCount(2)
    expect(errors).toEqual([])
  })

  test('导入一个成员：照常上报、打开模板页、进度加一，刷新后还记得；打勾可以自己取消', async ({ page, context }) => {
    const clicks = []
    await page.route('**/api/click', (route) => {
      clicks.push(route.request().postDataJSON())
      return route.fulfill({ json: { ok: true, counted: true, heat: 1 } })
    })
    await page.goto(`/squads/${squad}`)
    const [popup] = await Promise.all([context.waitForEvent('page'), member(page, weekly).getByTestId('member-import').click()])
    await expect(popup).toHaveURL(`https://x.ai/bot/${weekly}-000`)
    await popup.close()
    expect(clicks).toContainEqual({ slug: weekly, kind: 'import' })
    await expect(page.getByTestId('setup-progress')).toHaveText('已导入 1 / 3')
    await expect(member(page, weekly).getByTestId('member-import')).toHaveAttribute('data-done', 'true')
    await expect(member(page, weekly).getByTestId('member-import').locator('svg')).toHaveAttribute('data-icon', 'check')
    const check = page.locator(`[data-testid="setup-member"][data-slug="${weekly}"]`).getByTestId('member-check')
    await expect(check).toHaveAttribute('aria-pressed', 'true')
    expect(await page.evaluate((key) => localStorage.getItem(key), `bz-squad-${squad}`)).toBe(JSON.stringify([weekly]))

    await page.reload()
    await expect(page.getByTestId('setup-progress')).toHaveText('已导入 1 / 3')
    await expect(check).toHaveAttribute('aria-pressed', 'true')

    // 步骤里的「导入」同样算数；全部导完，第一步的编号变成对勾。
    for (const slug of [lead, external]) {
      const [tab] = await Promise.all([context.waitForEvent('page'), page.locator(`[data-testid="setup-member"][data-slug="${slug}"]`).getByTestId('setup-import').click()])
      await tab.close()
    }
    await expect(page.getByTestId('setup-progress')).toHaveText('已导入 3 / 3')
    await expect(page.locator('.setup-step').first()).toHaveClass(/is-complete/)
    await expect(page.locator('.setup-step').first().locator('.step-no svg')).toHaveAttribute('data-icon', 'check')

    // 键盘：打勾按钮能聚焦，空格取消。
    await check.focus()
    await expect(check).toBeFocused()
    await page.keyboard.press('Space')
    await expect(check).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByTestId('setup-progress')).toHaveText('已导入 2 / 3')
    await expect(page.locator('.setup-step').first()).not.toHaveClass(/is-complete/)
  })

  test('「开始组队」滚到组队步骤；口令一键复制，反馈「已复制」', async ({ page, context, baseURL }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL })
    await page.goto(`/squads/${squad}`)
    await page.getByTestId('squad-start').click()
    await expect(page.getByTestId('squad-setup')).toBeInViewport()
    await expect.poll(() => page.getByTestId('squad-setup').evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBeLessThan(200)
    await expect(page).toHaveURL(/#setup$/)

    const clicks = []
    await page.route('**/api/click', (route) => {
      clicks.push(route.request().postDataJSON())
      return route.fulfill({ json: { ok: true, counted: true, heat: 0 } })
    })
    const button = page.getByTestId('copy-kickoff')
    await expect(button).toHaveText(SQUAD_COPY.copy)
    await button.click()
    await expect(button).toHaveText(SQUAD_COPY.copied)
    await expect(button.locator('svg')).toHaveAttribute('data-icon', 'check')
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(kickoff)
    await expect.poll(() => clicks).toEqual([{ slug: squad, kind: 'kickoff' }])
    await page.getByTestId('copy-tryout').click()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('帮我看看这份 PRD，评审意见顺手记进本周周报。')
    expect(clicks).toEqual([{ slug: squad, kind: 'kickoff' }])
  })

  test('剪贴板被拒时选中口令，仍按小队 slug 上报', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('模拟拒绝') } } })
    })
    await page.goto(`/squads/${squad}`)
    const [request] = await Promise.all([page.waitForRequest('**/api/click'), page.getByTestId('copy-kickoff').click()])
    expect(request.postDataJSON()).toEqual({ slug: squad, kind: 'kickoff' })
    await expect.poll(() => page.evaluate(() => String(getSelection()))).toBe(kickoff)
  })

  test('点舞台和阵容里的 Bot 是戳；整行点进这个成员的详情页', async ({ page }) => {
    await page.goto(`/squads/${squad}`)
    const actor = page.getByTestId('squad-stage').locator(`.photo-member[data-slug="${weekly}"]`)
    await actor.click()
    await expect(actor.locator('[data-testid="live-bot"]')).not.toHaveAttribute('data-state', 'idle')
    await expect(page).toHaveURL(new RegExp(`/squads/${squad}$`))
    const row = member(page, external)
    await row.locator('.roster-tile').click()
    await expect(row.locator('[data-testid="live-bot"]')).not.toHaveAttribute('data-state', 'idle')
    await expect(page).toHaveURL(new RegExp(`/squads/${squad}$`))
    // 点这一行的介绍文字：上面铺着名字的链接，所以进的是这个成员的详情页。
    const does = await row.getByTestId('member-does').boundingBox()
    await page.mouse.click(does.x + does.width / 2, does.y + does.height / 2)
    await expect(page).toHaveURL(new RegExp(`/bots/${external}$`))
  })

  test('合影里的队员看向队长：左边的往右看，右边的往左看（减少动效下的静态帧）', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`/squads/${squad}`)
    // 站位从左到右：记录员、队长、外援。队长在测试数据里是一张头像图片，这里只量两只活的。
    const gaze = await page.getByTestId('squad-stage').locator('.photo-member:has([data-testid="live-bot"])').evaluateAll((nodes) => nodes.map((node) => {
      // 眼睛是蒙版里的洞，不参与排版：用它自己的包围盒和变换矩阵算出在画布里的横坐标（画布中心是 0，身体半径约 100）。
      const eyes = [...node.querySelectorAll('[data-part="eye"]')].map((eye) => {
        const box = eye.getBBox(), matrix = eye.transform.baseVal.consolidate().matrix
        return matrix.a * (box.x + box.width / 2) + matrix.c * (box.y + box.height / 2) + matrix.e
      })
      return { slug: node.dataset.slug, shift: eyes.reduce((sum, x) => sum + x, 0) / eyes.length / 200 }
    }))
    const shift = (slug) => gaze.find((entry) => entry.slug === slug).shift
    expect(shift(weekly)).toBeGreaterThan(.03)
    expect(shift(external)).toBeLessThan(-.03)
  })
})

test.describe('流程图', () => {
  test('宽屏画图：每条交接一条线，带标签；文字版只给读屏', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`/squads/${squad}`)
    const chart = page.getByTestId('squad-flow-chart')
    await expect(chart).toBeVisible()
    await expect(chart).toHaveAttribute('aria-hidden', 'true')
    await expect(chart.locator('.flow-edge')).toHaveCount(3)
    await expect(chart.locator('.flow-label')).toHaveText(['写好的 PRD', '评审意见', '本周周报'])
    // 节点：上面的「你」、队长、两个队员、下面的「你」。
    await expect(chart.locator('.flow-node.you')).toHaveText([SQUAD_COPY.you, SQUAD_COPY.you])
    await expect(chart.locator('.flow-node.member')).toHaveCount(3)
    // 画布不超出容器，标签都在画布里面。
    const fit = await chart.evaluate((el) => {
      const box = el.getBoundingClientRect()
      const inside = [...el.querySelectorAll('.flow-label, .flow-node')].every((node) => {
        const rect = node.getBoundingClientRect()
        return rect.left >= box.left - 1 && rect.right <= box.right + 1 && rect.top >= box.top - 1
      })
      return { inside, wider: el.querySelector('.flow-canvas').getBoundingClientRect().width - box.width }
    })
    expect(fit.inside).toBe(true)
    expect(fit.wider).toBeLessThanOrEqual(1)
    // 自上而下：你 → 队长 → 队员 → 你。
    const tops = await chart.locator('.flow-node').evaluateAll((nodes) => Object.fromEntries(nodes.map((node) => [node.dataset.node, node.getBoundingClientRect().top])))
    expect(tops['you:in']).toBeLessThan(tops[lead])
    expect(tops[lead]).toBeLessThan(tops[weekly])
    expect(tops[weekly]).toBeLessThan(tops['you:out'])
    // 文字版：视觉上收起，读屏照读。
    const list = page.getByTestId('squad-flow-list')
    await expect(list.locator('li')).toHaveCount(3)
    await expect(list.locator('li').first()).toContainText('写好的 PRD')
    await expect(list.locator('li').nth(1)).toContainText('示例·PRD 评审员')
    await expect(list.locator('li').nth(1)).toContainText('交给')
    expect((await list.boundingBox()).width).toBeLessThanOrEqual(1)
  })

  test('悬停一个成员：和它相连的线亮成它的颜色，其余变淡；移开恢复', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`/squads/${squad}`)
    const chart = page.getByTestId('squad-flow-chart')
    await chart.scrollIntoViewIfNeeded()
    const edge = (key) => chart.locator(`.flow-edge[data-edge="${key}"]`)
    const neutral = await edge(`${lead}>${weekly}`).locator('.flow-line').evaluate((el) => getComputedStyle(el).stroke)
    await chart.locator(`.flow-node[data-node="${weekly}"]`).hover()
    await expect(edge(`${lead}>${weekly}`)).toHaveAttribute('data-state', 'on')
    await expect(edge(`${weekly}>you:out`)).toHaveAttribute('data-state', 'on')
    await expect(edge(`you:in>${lead}`)).toHaveAttribute('data-state', 'dim')
    await expect(chart.locator(`.flow-node[data-node="${external}"]`)).toHaveAttribute('data-state', 'dim')
    await expect.poll(() => edge(`${lead}>${weekly}`).locator('.flow-line').evaluate((el) => getComputedStyle(el).stroke)).not.toBe(neutral)
    await page.mouse.move(5, 5)
    await expect(edge(`you:in>${lead}`)).toHaveAttribute('data-state', 'rest')
  })

  test('手机宽度：不画图，直接显示文字版', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/squads/${squad}`)
    await expect(page.getByTestId('squad-flow-chart')).toBeHidden()
    const list = page.getByTestId('squad-flow-list')
    await expect(list).toBeVisible()
    await expect(list.locator('li')).toHaveCount(3)
    await expect(list.locator('.flow-what')).toHaveText(['写好的 PRD', '评审意见', '本周周报'])
  })

  test('窄一点的桌面：按容器宽度重排，不横向溢出', async ({ page }) => {
    await page.setViewportSize({ width: 760, height: 900 })
    await page.goto(`/squads/${squad}`)
    const chart = page.getByTestId('squad-flow-chart')
    await expect(chart).toHaveClass(/is-ready/)
    const widths = await chart.evaluate((el) => [el.getBoundingClientRect().width, el.querySelector('.flow-canvas').getBoundingClientRect().width])
    expect(Math.abs(widths[0] - widths[1])).toBeLessThanOrEqual(1)
    expect(await overflow(page)).toBeLessThanOrEqual(0)
  })
})

test.describe('各种宽度和减少动效', () => {
  for (const width of [1440, 1000, 900, 680, 390, 320]) {
    test(`${width}px：首页小队区块和小队页都不横向滚动`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')
      await expect(card(page)).toBeVisible()
      expect(await overflow(page)).toBeLessThanOrEqual(0)
      // 合影里的 Bot 都在面板里面。
      const inside = await card(page).locator('.squad-photo').evaluate((el) => {
        const box = el.getBoundingClientRect()
        return [...el.querySelectorAll('.photo-member')].every((node) => {
          const rect = node.getBoundingClientRect()
          return rect.left >= box.left && rect.right <= box.right && rect.top >= box.top && rect.bottom <= box.bottom
        })
      })
      expect(inside).toBe(true)
      await page.goto(`/squads/${squad}`)
      await expect(page.getByTestId('squad-stage')).toBeVisible()
      expect(await overflow(page)).toBeLessThanOrEqual(0)
    })
  }

  test('手机：小队卡上下排，触摸目标够大', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    const boxes = await card(page).evaluate((el) => {
      const photo = el.querySelector('.squad-photo').getBoundingClientRect(), body = el.querySelector('.squad-card-body').getBoundingClientRect()
      return { photoBottom: photo.bottom, bodyTop: body.top }
    })
    expect(boxes.photoBottom).toBeLessThanOrEqual(boxes.bodyTop)
    await page.goto(`/squads/${squad}`)
    // 手机上不画名牌。
    await expect(page.getByTestId('squad-stage').locator('.photo-plate').first()).toBeHidden()
    const start = await page.getByTestId('squad-start').boundingBox()
    expect(start.height).toBeGreaterThanOrEqual(44)
  })

  test('减少动效：合影不跳、光点不走、页面上没有在跑的动画，Bot 停在静态帧', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await card(page).scrollIntoViewIfNeeded()
    await card(page).hover()
    await page.waitForTimeout(300)
    await expect(card(page).locator('.photo-hop.is-hopping')).toHaveCount(0)
    await expect(card(page).locator('[data-testid="live-bot"]').first()).toHaveAttribute('data-running', 'false')
    expect(await running(page)).toBe(0)

    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`/squads/${squad}`)
    await page.getByTestId('squad-flow-chart').scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    expect(await running(page)).toBe(0)
    await expect(page.getByTestId('squad-flow-chart').locator('.flow-dot').first()).toBeHidden()
    await expect(page.getByTestId('squad-stage').locator('[data-testid="live-bot"]').first()).toHaveAttribute('data-running', 'false')
    // 功能照常：开始组队仍然能到组队步骤。
    await page.getByTestId('squad-start').click()
    await expect(page.getByTestId('squad-setup')).toBeInViewport()
  })

  test('不减少动效时：光点沿线走，6 秒一趟', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`/squads/${squad}`)
    const dot = page.getByTestId('squad-flow-chart').locator('.flow-dot').first()
    expect(await dot.evaluate((el) => getComputedStyle(el).animationDuration)).toBe('6s')
    expect(await dot.evaluate((el) => el.getAnimations().length)).toBe(1)
  })
})

test.describe('搜索面板里的小队', () => {
  const open = async (page) => {
    await page.goto('/')
    await page.getByTestId('search-trigger').click()
    await expect(page.getByTestId('search-panel')).toBeVisible()
  }

  test('没输入时：Bot 后面单独一组「小队」', async ({ page }) => {
    await open(page)
    await expect(page.getByTestId('search-item')).toHaveCount(3)
    const item = page.getByTestId('search-squad')
    await expect(item).toHaveCount(1)
    await expect(item.locator('[data-part="name"]')).toHaveText('示例·周会小队')
    await expect(item.locator('[data-part="tagline"]')).toHaveText('一个评审员带两个帮手，把周会前后的事包了')
    await expect(item.locator('.sp-tag')).toHaveText(SQUAD_COPY.tag)
    await expect(item.locator('.squad-still')).toHaveCount(3)
    await expect(page.getByTestId('search-panel').locator('.sp-group[data-group="squad"] .sp-heading')).toHaveText(SQUAD_COPY.title)
    // 排在所有 Bot 后面。
    const tops = await page.locator('[data-testid="search-item"], [data-testid="search-squad"]').evaluateAll((nodes) => nodes.map((node) => node.dataset.testid))
    expect(tops).toEqual(['search-item', 'search-item', 'search-item', 'search-squad'])
  })

  test('按名字搜到小队，回车进小队页；上下键能从 Bot 走到小队', async ({ page }) => {
    await open(page)
    await page.getByTestId('search-input').fill('周会')
    await expect(page.getByTestId('search-item')).toHaveCount(0)
    await expect(page.getByTestId('search-squad')).toHaveCount(1)
    await expect(page.getByTestId('search-squad')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('search-input')).toHaveAttribute('aria-activedescendant', `bz-search-squad-${squad}`)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`/squads/${squad}$`))
    await expect(page.getByTestId('search-palette')).toHaveCount(0)

    await open(page)
    // 三个 Bot 之后是小队；从第一个往上翻一格，绕到最后的小队。
    await page.keyboard.press('ArrowUp')
    await expect(page.getByTestId('search-squad')).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowDown')
    await expect(page.getByTestId('search-item').first()).toHaveAttribute('aria-selected', 'true')
  })

  test('搜「小队」、队形、成员名字都能找到；点一下也能进', async ({ page }) => {
    await open(page)
    for (const query of ['小队', '带队', '记录员']) {
      await page.getByTestId('search-input').fill(query)
      await expect(page.getByTestId('search-squad')).toHaveCount(1)
    }
    await page.getByTestId('search-input').fill('完全不存在的词')
    await expect(page.getByTestId('search-squad')).toHaveCount(0)
    await expect(page.getByTestId('search-empty')).toBeVisible()
    await page.getByTestId('search-input').fill('周会')
    await page.getByTestId('search-squad').click()
    await expect(page).toHaveURL(new RegExp(`/squads/${squad}$`))
  })
})
