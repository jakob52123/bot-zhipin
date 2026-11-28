import { expect, it } from 'vitest'
import { buildCatalog } from '../../scripts/lib/catalog.mjs'
import { SITE } from '../../site/.vitepress/meta.mjs'

it('catalog 只导出约定字段，按 slug 而不是显示名字或输入顺序排序', () => {
  const first = {
    slug: 'ab', detailUrl: '/bots/ab', name: 'Zoo', nameZh: '示例', tagline: '一句话', category: '产品',
    permissions: ['联网'], quotaCost: '低', about: { cnFit: '好', cnNote: '备注', starters: ['你好'] },
    editorNote: '点评', templateUrl: 'https://x.ai/bot/123', author: { name: '作者', link: 'https://example.org' },
    external: false, addedAt: '2026-01-01', pick: 1,
  }
  const second = { ...first, slug: 'za', detailUrl: '/bots/za', name: 'Ace', nameZh: null, about: null, editorNote: null, author: { name: '投稿人' } }
  const bots = [second, first]
  const result = buildCatalog({ bots })
  expect(result).toEqual({
    name: SITE.name, url: `${SITE.url}/`, description: SITE.tagline, docs: `${SITE.url}/llms.txt`,
    license: { id: 'CC-BY-4.0', url: 'https://creativecommons.org/licenses/by/4.0/deed.zh-hans', attribution: `${SITE.name}（${SITE.url}/）` },
    count: 2, bots: [
      { slug: 'ab', name: 'Zoo', nameZh: '示例', tagline: '一句话', category: '产品', permissions: ['联网'], quotaCost: '低', cn: { fit: '好', note: '备注' }, starters: ['你好'], editorNote: '点评', platform: 'Grok Bot', templateUrl: first.templateUrl, installPrompt: null, projectUrl: null, detailUrl: `${SITE.url}/bots/ab`, author: { name: '作者', url: 'https://example.org' }, external: false, addedAt: '2026-01-01' },
      expect.objectContaining({ slug: 'za', nameZh: null, cn: { fit: null, note: null }, starters: [], editorNote: null, author: { name: '投稿人', url: null } }),
    ],
  })
  expect(bots[0]).toBe(second)
})
