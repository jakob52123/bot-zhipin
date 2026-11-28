import { test, expect } from '@playwright/test'
import { CATEGORY_COLORS } from '../../site/.vitepress/theme/color.ts'

const weekly = 'demo-weekly-digest'
test.beforeEach(async ({ page }) => {
  await page.route('**/api/stats', (route) => route.fulfill({ json: { ok: true, heat: {}, byKind: {} } }))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

for (const scheme of ['light', 'dark']) {
  test(`${scheme}：活体头像黑眼睛、正脸，服务端输出的那些与 SSR 静态首帧一致`, async ({ page, request }) => {
    await page.emulateMedia({ colorScheme: scheme })
    const warnings = []
    page.on('console', (message) => { if (/hydration/i.test(message.text())) warnings.push(message.text()) })
    page.on('pageerror', (error) => warnings.push(error.message))
    await page.goto('/')
    const raw = await (await request.get('/')).text()
    const frames = await page.evaluate((html) => {
      // 球池里的 Bot 只在客户端渲染（要先量场景），不在服务端输出里，这里不比它们。
      const capture = (root) => [...root.querySelectorAll('[data-testid="live-bot"]')].filter((svg) => !svg.closest('[data-testid="ballpit"]')).map((svg) => ({
        shape: svg.dataset.shape, viewBox: svg.getAttribute('viewBox'),
        body: svg.querySelector('[data-part="body"]').getAttribute('d'),
        eyes: [...svg.querySelectorAll('[data-part="eye"]')].map((e) => [e.getAttribute('d'), e.getAttribute('transform')]),
      }))
      return { ssr: capture(new DOMParser().parseFromString(html, 'text/html')), client: capture(document) }
    }, raw)
    expect(frames.client).toEqual(frames.ssr)
    for (const frame of frames.client) expect(frame.viewBox).toBe('-112 -112 224 224')
    expect(frames.ssr.length).toBeGreaterThan(0)
    // 首屏的球池：服务端只输出站名和搜索框，Bot 挂载后才出现；它们和货架上的头像是同一套活体（下面的循环一起检查）。
    await expect(page.getByTestId('ballpit').locator('.pit-haze')).toHaveClass(/is-on/)
    expect(await page.getByTestId('pit-bot').count()).toBeGreaterThan(0)
    await expect(page.getByTestId('pit-bot').getByTestId('live-bot')).toHaveCount(await page.getByTestId('pit-bot').count())
    for (const svg of await page.getByTestId('live-bot').all()) {
      await expect(svg.locator('[data-part="body"]')).toHaveCSS('fill', 'rgb(22, 22, 27)')
      await expect(svg).toHaveCSS('overflow', 'visible')
      // 视口收紧，但变身用的 mask / fill 画布不跟着裁小。
      await expect(svg.locator('[data-part="fill"]')).toHaveAttribute('width', '316')
      const { ratio, x } = await svg.evaluate((el) => {
        const body = el.querySelector('[data-part="body"]').getBoundingClientRect()
        const eyes = [...el.querySelectorAll('[data-part="eye"]')]
        return {
          ratio: Math.max(body.width, body.height) / el.getBoundingClientRect().width,
          x: eyes.reduce((sum, e) => sum + new DOMMatrix(e.getAttribute('transform')).m41, 0) / eyes.length,
        }
      })
      expect(ratio).toBeGreaterThanOrEqual(.8)
      expect(Math.abs(x)).toBeLessThanOrEqual(30)
    }
    expect(warnings).toEqual([])
  })

  test(`${scheme}：九个分组的标签和来源标签实际 CSS 对比度 ≥4.5，首页/详情一致`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/')
    // 首页按分组分段时列表卡不带分组标签（组头已经说了），主推卡带。
    await expect(page.locator(`[data-testid="bot-card"][data-slug="${weekly}"] .category-tag`)).toHaveCount(0)
    const homeColor = await page.locator(`[data-testid="featured-card"][data-slug="${weekly}"] .category-tag`).evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor])
    await page.goto(`/bots/${weekly}`)
    expect(await page.locator('.category-tag').evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor])).toEqual(homeColor)
    await page.goto('/')
    const colors = await page.locator('.category-tag').first().evaluate((el, palette) => {
      const ctx = document.createElement('canvas').getContext('2d')
      const rgb = (css) => {
        ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1)
        return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3)
      }
      const luminance = (rgb) => rgb.map((v) => v / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
      // 半透明底（中性标签用的 --bz-surface-2）要叠到祖先的底色上再算。
      const parse = (css) => { const m = css.match(/[\d.]+(?:e-?\d+)?/g).map(Number); return { c: m.slice(0, 3).map((v) => css.startsWith('color(') ? v * 255 : v), a: m.length > 3 ? m[3] : 1 } }
      const backdrop = (node) => {
        const layers = []
        for (let at = node; at; at = at.parentElement) { const layer = parse(getComputedStyle(at).backgroundColor); if (layer.a > 0) layers.push(layer); if (layer.a === 1) break }
        return layers.reverse().reduce((under, layer) => under.map((v, i) => Math.round(layer.c[i] * layer.a + v * (1 - layer.a))), [255, 255, 255])
      }
      const sample = (node) => {
        const style = getComputedStyle(node), fg = rgb(style.color), bg = backdrop(node)
        const a = luminance(fg), b = luminance(bg)
        return { fg, bg, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) }
      }
      const categories = Object.entries(palette).map(([name, color]) => {
        const clone = el.cloneNode(true)
        clone.textContent = name
        clone.style.setProperty('--bz-category-color', color)
        el.parentElement.append(clone)
        const result = { name, ...sample(clone) }
        clone.remove()
        return result
      })
      return { categories, source: [...document.querySelectorAll('.source-tag')].map(sample) }
    }, CATEGORY_COLORS)
    expect(new Set(colors.categories.map((c) => c.bg.join(','))).size).toBe(Object.keys(CATEGORY_COLORS).length)
    expect(Object.keys(CATEGORY_COLORS)).toHaveLength(9)
    for (const color of [...colors.categories, ...colors.source]) {
      expect(color.ratio, `${color.name ?? '来源标签'} ${color.fg} / ${color.bg}`).toBeGreaterThanOrEqual(4.5)
    }
    // 来源标签只有「作者投稿」，和分类标签同一种混法；官方市场、社区收录不显示（决策 78），作者行里也没有。
    expect(colors.source.length).toBeGreaterThan(0)
    await expect(page.locator('.bz-tag', { hasText: /官方市场|社区收录/ })).toHaveCount(0)
    await expect(page.locator('[data-testid="bot-card"][data-slug="demo-external"] .bot-byline')).not.toContainText(/官方市场|社区收录|·/)
    await expect(page.locator('[data-testid="bot-card"][data-slug="demo-external"] .source-tag')).toHaveCount(0)
    await expect(page.locator(`[data-testid="bot-card"][data-slug="${weekly}"] .source-tag`)).toHaveText('作者投稿')
  })
}
