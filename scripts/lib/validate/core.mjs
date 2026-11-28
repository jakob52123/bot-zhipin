import { validateSchema } from './schema.mjs'
import { validateContent, validateTemplate } from './content.mjs'
import { validateImages } from './images.mjs'
import { redact, scanSecrets } from './secrets.mjs'
import { scanPersonalInfo } from './pii.mjs'
import { botYamlSizeError } from '../yaml-limits.mjs'
import { hasChinese } from '../bot-name.mjs'
import { CLOUD_FILES, LOCAL_FILES, OPENBOT, platformOf } from '../platform.mjs'

const DAY = 24 * 60 * 60 * 1000

/** addedAt 是真实日期且不晚于明天（北京时间）。Bot 和小队共用。 */
export function validateDate(bot, now, report) {
  const value = bot.data.addedAt
  // 非字符串或不符合 YYYY-MM-DD 的值由 schema 报告。
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return
  const timestamp = Date.parse(`${value}T00:00:00Z`)
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    report(bot.yamlPath, 'addedAt', `addedAt 当前值 ${value} 不是有效日期`, '填写真实存在的 YYYY-MM-DD 日期，检查月份、天数和闰年。')
    return
  }
  const today = new Date(new Date(now).getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
  if (timestamp > Date.parse(`${today}T00:00:00Z`) + DAY) {
    report(bot.yamlPath, 'addedAt', `addedAt ${value} 不能晚于今天（北京时间 ${today}，允许多 1 天容差）`, `把 addedAt 改成真实上架日期，不能超过北京时间 ${today} 的次日。`)
  }
}

/** 只校验 models；others 仅参与查重和改编来源检查。 */
export function validateModels(bots, { template, now = new Date(), others = [], policy = {} }) {
  const errors = [], warnings = []
  const duplicates = { slug: new Map(), templateUrl: new Map() }
  for (const other of others) {
    for (const field of Object.keys(duplicates)) {
      if (typeof other[field] === 'string' && !duplicates[field].has(other[field])) duplicates[field].set(other[field], other.slug)
    }
  }
  const slugs = new Set([...bots.map((bot) => bot.data?.slug), ...others.map((bot) => bot.slug)].filter((slug) => typeof slug === 'string'))
  for (const bot of bots) {
    const errorMap = new Map(), warningMap = new Map()
    let omitted = 0
    const report = (path, where, problem, fix, warning = false) => {
      const file = redact(`bots/${bot.slug}/${path}`)
      where = redact(where)
      const target = warning ? warnings : errors, seen = warning ? warningMap : errorMap
      const key = `${file}|${where}`
      if (!warning && !seen.has(key) && seen.size >= 50) {
        seen.set(key, null)
        omitted++
        return
      }
      if (seen.has(key) && seen.get(key) === null) return
      const item = { file, where, problem: redact(problem), fix: redact(fix) }
      const previous = seen.get(key)
      if (previous) {
        if (!previous.problem.includes(item.problem)) previous.problem += `；${item.problem}`
        if (!previous.fix.includes(item.fix)) previous.fix += ` ${item.fix}`
      } else {
        seen.set(key, item)
        target.push(item)
      }
    }
    for (const link of bot.symlinks) {
      report(link, '文件类型', '不允许符号链接（文件或目录）', '删除符号链接，改为此 Bot 文件夹内的真实文件或目录；不要引用文件夹外的内容。')
    }
    // 即使 YAML 坏了也继续检查其他文件和密钥，不回显解析器的原文片段。
    if (bot.yamlTooLarge) {
      report(bot.yamlPath, botYamlSizeError.where, botYamlSizeError.problem, botYamlSizeError.fix)
    } else if (bot.yamlError) {
      const line = Number(/at line (\d+)/.exec(bot.yamlError)?.[1] || 1)
      report(bot.yamlPath, `第 ${line} 行`, `YAML 格式错误（第 ${line} 行）：${bot.raw === null ? '找不到 bot.yaml' : '无法解析为合法的「键: 值」映射'}`, bot.raw === null ? '在这个 Bot 文件夹内创建 bot.yaml，可参考 bots/_template/bot.yaml，填写真实信息。' : '检查这一行及上一行的缩进、冒号、引号、括号和重复字段；顶层必须是「键: 值」映射。')
    } else {
      validateSchema(bot, report)
      const data = bot.data
      if (typeof data.slug === 'string' && data.slug !== bot.slug) report(bot.yamlPath, 'slug', `slug ${data.slug} 和文件夹名不一致（文件夹是 ${bot.slug}）`, `将 slug 改为 ${bot.slug}，或把文件夹改成与 slug 一致的合法名称。`)
      validateDate(bot, now, report)
      // 中文叫法里得有汉字；长度、类型、禁用字符由 schema 报告。
      if (typeof data.nameZh === 'string' && data.nameZh && !hasChinese(data.nameZh)) {
        report(bot.yamlPath, 'nameZh', `nameZh 当前值 ${JSON.stringify(data.nameZh)} 里没有中文`, 'nameZh 填中文叫法，比如「点子拆解员」；不需要中文叫法就删掉这一行，页面会直接用 name。')
      }
      // 平台：OpenBot 没有模板链接；两种「文件」权限各归各的平台（枚举和类型由 schema 报告）。
      const openbot = platformOf(data) === OPENBOT
      if (openbot) {
        for (const field of ['templateUrl', 'templateVersion']) {
          if (data[field] !== undefined) report(bot.yamlPath, field, `OpenBot 的 Bot 不写 ${field}`, `删掉 ${field} 这一行；OpenBot 没有模板链接，别人用页面上的「复制安装提示词」来装。`)
        }
      }
      // 源项目：GitHub 上的要钉在审过的那次提交上，每天的上游核对才比得了；别处的核对管不到，提醒一声。
      if (openbot && typeof data.projectUrl === 'string' && /^https:\/\//.test(data.projectUrl)) {
        if (data.projectUrl.startsWith('https://github.com/')) {
          if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/tree\/[a-f\d]{40}(?:\/[^?#\s]*)?$/i.test(data.projectUrl)) {
            report(bot.yamlPath, 'projectUrl', 'GitHub 上的源项目要钉在审过的那次提交上', '写成 https://github.com/<作者>/<仓库>/tree/<40 位提交号>，提交号用你审过的那一次；每天的上游核对按它比对。')
          }
        } else {
          report(bot.yamlPath, 'projectUrl', '源项目不在 GitHub 上，每天的上游核对管不到它', '收录前自己记好审过的版本，定期回去看看有没有改；能换成 GitHub 地址就换。', true)
        }
      }
      const permissions = Array.isArray(data.permissions) ? data.permissions : []
      if (openbot && permissions.includes(CLOUD_FILES)) {
        report(bot.yamlPath, 'permissions', `OpenBot 跑在用户自己的电脑上，权限里不能有「${CLOUD_FILES}」`, `把「${CLOUD_FILES}」换成「${LOCAL_FILES}」。`)
      }
      if (!openbot && permissions.includes(LOCAL_FILES)) {
        report(bot.yamlPath, 'permissions', `「${LOCAL_FILES}」只给 OpenBot 的 Bot 用，Grok Bot 读写的是云电脑里的文件`, `把「${LOCAL_FILES}」换成「${CLOUD_FILES}」；这是 OpenBot 的 Bot 的话，加一行 platform: ${OPENBOT}。`)
      }
      if (policy.submission) {
        if (openbot) report(bot.yamlPath, 'platform', '网站投稿暂时只收 Grok Bot', '投 Grok Bot 就删掉 platform 这一行；OpenBot 的 Bot 暂时只由维护者收录，想上架就在主仓库开一个普通 Issue，贴上 Bot 的地址。')
        if (data.external === true) report(bot.yamlPath, 'external', '网站投稿不允许 external: true', '删除 external 字段；外部收录只能由维护者处理。')
        if (typeof data.author?.github !== 'string' || data.author.github.toLowerCase() !== String(policy.submission.login).toLowerCase()) {
          report(bot.yamlPath, 'author.github', 'author.github 必须等于当前登录的 GitHub 用户名（忽略大小写）', '使用实际作者的 GitHub 账号登录，并将 author.github 改为该账号。')
        }
      }
      for (const field of Object.keys(duplicates)) {
        const value = data[field]
        if (typeof value !== 'string') continue
        const first = duplicates[field].get(value)
        if (first) report(bot.yamlPath, field, `${field} 重复，与 bots/${first}/bot.yaml 相同`, `修改当前 Bot 的 ${field} 为独有值；同一个模板不要重复投稿。`)
        else duplicates[field].set(value, bot.slug)
      }
      if (typeof data.forkedFrom === 'string') {
        if (data.forkedFrom === data.slug || data.forkedFrom === bot.slug) report(bot.yamlPath, 'forkedFrom', 'forkedFrom 不能是自己', '填写原 Bot 的 slug；不是改编作品就删除 forkedFrom。')
        else if (!slugs.has(data.forkedFrom)) report(bot.yamlPath, 'forkedFrom', `forkedFrom 找不到 Bot ${data.forkedFrom}`, '填写当前 bots/ 中已存在的原 Bot 的 slug；不是改编作品就删除此字段。')
      }
    }
    validateContent(bot, template, report)
    validateImages(bot, report)
    validateTemplate(bot, template, report)
    scanSecrets(bot, report)
    scanPersonalInfo(bot, report)
    if (omitted) errors.push({ file: `bots/${bot.slug}/`, where: '错误汇总',
      problem: `还有 ${omitted} 处问题没列出，先改完上面这些再校验`, fix: '先改完上面这些，再运行 npm run validate。' })
  }
  return { errors, warnings }
}

/** squads 只有全量校验（Bot + 小队 + 策展）才会带；只校验 Bot 时不打印小队数。 */
export function formatResult({ bots, squads, prompts, skills, errors, warnings }) {
  const lines = []
  for (const [items, mark, label, advice] of [[errors, '✗', '问题', '改法'], [warnings, '!', '提醒', '建议']]) {
    for (const item of items) lines.push(`${mark} ${item.file}\n  位置：${item.where}\n  ${label}：${item.problem}\n  ${advice}：${item.fix}\n`)
  }
  if (errors.length) {
    const failed = (prefix) => new Set(errors.filter((item) => item.file.startsWith(prefix)).map((item) => item.file.split('/')[1])).size
    const failedBots = failed('bots/'), failedSquads = failed('squads/')
    const failedPrompts = failed('prompts/'), failedSkills = failed('skills/')
    const curation = errors.some((item) => item.file.startsWith('curation/'))
    const others = failedSquads || curation || failedPrompts || failedSkills
    // 只有 Bot 出错时写法和以前一样；小队、策展、Prompt、Skill 出错才追加在后面。
    const scope = [
      (failedBots || !others) && `${failedBots} 个 Bot`, failedSquads && `${failedSquads} 支小队`, curation && '策展文件',
      failedPrompts && `${failedPrompts} 条 Prompt`, failedSkills && `${failedSkills} 个 Skill`,
    ].filter(Boolean).join('、')
    lines.push(`校验未通过：${scope} 共 ${errors.length} 处错误${warnings.length ? `（另有 ${warnings.length} 条提醒）` : ''}。按上面的「改法」逐条修改后，重新运行 npm run validate。`)
  } else {
    lines.push(`✓ 校验通过：${bots.length} 个 Bot（其中 ${bots.filter((bot) => bot.data?.external === true).length} 个外部收录）${squads ? `，${squads.length} 支小队` : ''}${prompts ? `，${prompts.length} 条 Prompt` : ''}${skills ? `，${skills.length} 个 Skill` : ''}`)
  }
  return lines.join('\n')
}
