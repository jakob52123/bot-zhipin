import MarkdownIt from 'markdown-it'
import { prepareDesignSource, installSafeDesignRules } from '../../../../scripts/lib/design-markdown.mjs'
import { summarizeBot, decorateSummary } from '../../../../scripts/lib/bot-summary.mjs'
import { validate } from '../../../../scripts/lib/validate/generated/bot-schema.mjs'
import { submissionModel } from './model'
export { summarizeBot }

export function renderDesign(markdown: string, {
  slug, assetUrl = () => null, screenshotNames, blockedUrl,
}: { slug: string; assetUrl?: (name: string) => string | null; screenshotNames?: string[]; blockedUrl?: string }) {
  const md = new MarkdownIt({
    html: false, linkify: true,
    highlight: (code: string) => `<pre><code>${md.utils.escapeHtml(code)}</code></pre>`,
  })
  // 与 VitePress 一致：只自动识别带协议的链接，不猜测裸域名。
  md.linkify.set({ fuzzyLink: false })
  // 不安装 attrs、snippet、frontmatter、Vue 等插件；HTML 仅供 v-html，不可编译。
  installSafeDesignRules(md, { assetUrl })
  // 仅投稿预览传入 screenshotNames 时启用 UI 规则；共享渲染 API 的默认输出不变。
  if (!screenshotNames) return md.render(prepareDesignSource(markdown), { slug })
  const image = md.renderer.rules.image!
  const hint = '<span class="external-icon" aria-hidden="true">↗</span><span class="bz-sr-only">（在新标签页打开）</span>'
  md.renderer.rules.image = (tokens, index, options, env, self) => {
    const src = tokens[index].attrGet('src') || ''
    if (blockedUrl && src === blockedUrl) return md.utils.escapeHtml(self.renderInlineAsText(tokens[index].children || [], options, env))
    const match = /^(?:\.\/)?screenshots\/([A-Za-z0-9_.-]+)$/.exec(src)
    // 投稿不收截图：缺图的本地引用只留说明文字，不给「待放入」这种已经没处放的提示；校验会让删掉这行。
    if (match && !assetUrl(match[1])) return md.utils.escapeHtml(self.renderInlineAsText(tokens[index].children || [], options, env))
    return image(tokens, index, options, env, self).replace('rel="noreferrer"', 'rel="noopener noreferrer"').replace('</a>', hint + '</a>')
  }
  const links: string[] = []
  md.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const href = tokens[index].attrGet('href') || ''
    if (blockedUrl && href === blockedUrl) { links.push('</span>'); return '<span>' }
    const external = /^https?:\/\//i.test(href)
    links.push((external ? hint : '') + '</a>')
    if (external) { tokens[index].attrSet('target', '_blank'); tokens[index].attrSet('rel', 'noopener noreferrer') }
    return self.renderToken(tokens, index, options)
  }
  md.renderer.rules.link_close = () => links.pop() || '</a>'
  // 投稿 Markdown 不能再制造页面级 h1；仍然只作为 HTML 数据插入。
  for (const type of ['heading_open', 'heading_close']) md.renderer.rules[type] = (tokens, index, options, env, self) => {
    tokens[index].tag = `h${Math.min(6, Number(tokens[index].tag.slice(1)) + 2)}`
    return self.renderToken(tokens, index, options)
  }
  return md.render(prepareDesignSource(markdown), { slug })
}

export function previewModel(plaintext: string, {
  login, addedAt, names = new Map(), namesZh = new Map(), now,
}: {
  login?: string | null; addedAt?: string
  names?: Map<string, string>; namesZh?: Map<string, string>; now?: Date | string | number
} = {}) {
  const { model, slug } = submissionModel(plaintext, { login, addedAt, now })
  // 投稿页不收截图：设计说明里的本地图片引用一律按缺图显示，校验会提示删掉。
  const asset = () => null
  // 预览没有策展和小队：装饰字段取默认值（editorNote、pick 为 null，squads 为空），形状和货架上的一致。
  const summary = decorateSummary(summarizeBot(model, { asset, names, namesZh }))
  validate(model.data)
  const invalid = [...(validate.errors || [])]
  const bad = (path: string) => !model.data || invalid.some((error) =>
    error.instancePath === '' || error.instancePath === path || error.instancePath.startsWith(path + '/'))
  if (bad('/templateUrl') || typeof summary.templateUrl !== 'string') summary.templateUrl = null
  if (bad('/projectUrl') || typeof summary.projectUrl !== 'string') summary.projectUrl = null
  if (bad('/author')) {
    summary.author.url = null
    summary.author.link = null
  } else {
    summary.author.link = summary.author.github
      ? `https://github.com/${summary.author.github}`
      : summary.author.url || summary.templateUrl || summary.projectUrl || null
  }
  if (bad('/forkedFrom')) { summary.forkedFrom = null; summary.forkedFromName = null; summary.forkedFromNameZh = null }
  return { model, summary, designHtml: renderDesign(model.design || '', { slug, assetUrl: asset, screenshotNames: [], blockedUrl: typeof model.data?.templateUrl === 'string' ? model.data.templateUrl : undefined }), slug }
}
