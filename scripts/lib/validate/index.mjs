// Node 适配器：保留 CLI 返回的原始磁盘模型；纯内核只看到相对路径。
import { join, relative, resolve } from 'node:path'
import { BOTS_DIR, ROOT, loadAllBots, loadBot } from '../load-bots.mjs'
import { loadAllSquads, squadsDirFor } from '../load-squads.mjs'
import { curationFileFor, loadCuration } from '../load-curation.mjs'
import { isPublicBot } from '../public-bot.mjs'
import { validateModels } from './core.mjs'
import { validateCuration, validateSquads } from './squads.mjs'
import { OPENBOT, platformOf } from '../platform.mjs'
import { loadEntries, libraryDirFor } from '../load-prompts-skills.mjs'
import { validateLibrary } from './library.mjs'
export { formatResult } from './core.mjs'

function portable(bot) {
  const rel = (path) => relative(bot.dir, path).split('\\').join('/')
  const entry = (file) => ({ ...file, rel: rel(file.path), path: rel(file.path) })
  return {
    ...bot, rel: '', yamlPath: 'bot.yaml', yamlRel: 'bot.yaml',
    skills: bot.skills.map(entry), screenshots: bot.screenshots.map(entry), files: bot.files.map(entry),
    avatar: bot.avatar ? entry(bot.avatar) : null,
    // 保持旧 index 的 resolve/relative 规则，包括非标准 botsDir 名称和根目录链接。
    symlinks: bot.symlinks.map((link) => rel(resolve(bot.dir, '../..', link))),
  }
}

/** 只校验 Bot。投稿链路（Issue 表单、生成投稿链接）用它：一次投稿只动一个 Bot，碰不到小队和策展。 */
export function validateBots({ botsDir = BOTS_DIR, now = new Date() } = {}) {
  const bots = loadAllBots(resolve(botsDir))
  const template = portable(loadBot('_template', join(ROOT, 'bots')))
  return { bots, ...validateModels(bots.map(portable), { template, now }) }
}

/**
 * 全量校验：Bot + 小队 + 策展 + 收录的 Prompt 和 Skill，`npm run validate` 用它。
 * 小队和策展引用的 slug 必须在货架上；「在货架上」的口径和网站一致（isPublicBot）。
 * 不传 squadsDir / curationFile / promptsDir / skillsDir 时，跟着 botsDir 取兄弟目录
 * （见 load-squads.mjs、load-curation.mjs、load-prompts-skills.mjs）。
 */
export function validateAll({ botsDir = BOTS_DIR, squadsDir, curationFile, promptsDir, skillsDir, now = new Date() } = {}) {
  const result = validateBots({ botsDir, now })
  const squads = loadAllSquads(squadsDir ? resolve(squadsDir) : squadsDirFor(botsDir))
  const curation = loadCuration(curationFile ? resolve(curationFile) : curationFileFor(botsDir))
  const prompts = loadEntries('prompt', promptsDir ? resolve(promptsDir) : libraryDirFor('prompt', botsDir))
  const skills = loadEntries('skill', skillsDir ? resolve(skillsDir) : libraryDirFor('skill', botsDir))
  const botSlugs = result.bots.filter(isPublicBot).map((bot) => bot.slug)
  const openbotSlugs = result.bots.filter((bot) => isPublicBot(bot) && platformOf(bot.data) === OPENBOT).map((bot) => bot.slug)
  const parts = [
    validateSquads(squads, { botSlugs, openbotSlugs, now }), validateCuration(curation, { botSlugs }),
    validateLibrary('prompt', prompts, { now }), validateLibrary('skill', skills, { now }),
  ]
  return {
    ...result, squads, curation, prompts, skills,
    errors: [...result.errors, ...parts.flatMap((part) => part.errors)],
    warnings: [...result.warnings, ...parts.flatMap((part) => part.warnings)],
  }
}
