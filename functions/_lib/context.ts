import { buildBotModel } from '../../scripts/lib/bot-model.mjs'
import { LIMITS } from '../../scripts/submission/bundle-core.mjs'
import { SCHEMA_SHA256 } from '../../scripts/lib/validate/generated/bot-schema.mjs'
import { fail } from './respond'
import type { Env } from './types'

export interface SubmitContext {
  v: 1
  // OpenBot 的 Bot 没有模板链接，这一项不在。
  index: { slug: string; templateUrl?: string; [key: string]: unknown }[]
  template: { files: Record<string, string> }
  templateModel: ReturnType<typeof buildBotModel>
}
const cache = new WeakMap<Env['ASSETS'], Map<string, { expiresAt: number; data: SubmitContext }>>()
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export async function loadSubmitContext(assets: Env['ASSETS'], requestUrl: string, now: number): Promise<SubmitContext> {
  const url = new URL('/api-data/submit-context.json', requestUrl)
  const cached = cache.get(assets)?.get(url.origin)
  if (cached && now < cached.expiresAt) return cached.data
  try {
    const response = await assets.fetch(url)
    if (!response.ok) fail('server_error')
    const data = await response.json() as Record<string, any>
    if (!record(data) || data.v !== 1 || typeof data.commit !== 'string' || data.schemaSha256 !== SCHEMA_SHA256
      || !Array.isArray(data.index) || !data.index.every((item: any) => record(item)
        && typeof item.slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)
        && item.slug.length >= 2 && item.slug.length <= 40 && (item.templateUrl === undefined || typeof item.templateUrl === 'string'))
      || !record(data.template) || !record(data.template.files)
      || !['bot.yaml', 'ROLE.md', 'DESIGN.md', 'skills/example-skill/SKILL.md'].every((key) => typeof data.template.files[key] === 'string')
      || !Object.values(data.template.files).every((value) => typeof value === 'string')
      || !record(data.copy) || ![data.copy.permissions, data.copy.quota].every((map) => record(map) && Object.values(map).every((v) => typeof v === 'string'))
      || !record(data.limits) || data.limits.files !== LIMITS.files || data.limits.fileBytes !== LIMITS.fileBytes
      || data.limits.totalBytes !== LIMITS.totalBytes || data.limits.imageBytes !== 2097152) fail('server_error')
    const templateModel = buildBotModel('_template', { files: Object.entries(data.template.files).map(([rel, text]) => ({
      rel, text, size: new TextEncoder().encode(text as string).length,
    })) })
    if (templateModel.yamlError) fail('server_error')
    const result = { ...data, templateModel } as SubmitContext
    const entries = cache.get(assets) ?? new Map()
    entries.set(url.origin, { expiresAt: now + 60_000, data: result })
    cache.set(assets, entries)
    return result
  } catch {
    // A broken fresh build must not be masked by an expired cached context.
    fail('server_error')
  }
}
