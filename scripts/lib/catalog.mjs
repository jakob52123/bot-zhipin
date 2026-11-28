import { SITE, installPrompt } from '../../site/.vitepress/meta.mjs'
import { absoluteUrl } from './share.mjs'

export function buildCatalog({ bots }) {
  const url = absoluteUrl('/')
  return {
    name: SITE.name,
    url,
    description: SITE.tagline,
    docs: absoluteUrl('/llms.txt'),
    license: {
      id: 'CC-BY-4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/deed.zh-hans',
      attribution: `${SITE.name}（${url}）`,
    },
    count: bots.length,
    bots: bots.map((bot) => ({
      slug: bot.slug,
      name: bot.name,
      nameZh: bot.nameZh ?? null,
      tagline: bot.tagline,
      category: bot.category,
      permissions: bot.permissions,
      quotaCost: bot.quotaCost,
      cn: { fit: bot.about?.cnFit ?? null, note: bot.about?.cnNote ?? null },
      starters: bot.about?.starters ?? [],
      editorNote: bot.editorNote ?? null,
      platform: bot.platform ?? 'Grok Bot',
      templateUrl: bot.templateUrl ?? null,
      installPrompt: bot.platform === 'OpenBot' ? installPrompt(bot.slug, bot.platform) : null,
      projectUrl: bot.projectUrl ?? null,
      detailUrl: absoluteUrl(bot.detailUrl),
      author: { name: bot.author.name, url: bot.author.link ?? null },
      external: bot.external,
      addedAt: bot.addedAt,
    })).sort((a, b) => a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
  }
}
