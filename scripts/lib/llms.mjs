import { SITE } from '../../site/.vitepress/meta.mjs'
import { displayName, fullName } from './bot-name.mjs'
import { absoluteUrl } from './share.mjs'
import { INDEX_PATH, SKILL_DIR } from './agent-data.mjs'
import { schema as promptSchema } from './validate/generated/prompt-schema.mjs'
import { schema as skillSchema } from './validate/generated/skill-schema.mjs'

// Prompt、Skill 按 schema 里的分类顺序分节，组内保持传入顺序（网站的默认顺序）。
function categoryGroups(entries, schema) {
  return schema.properties.category.enum.map((name) => ({ name, entries: entries.filter((entry) => entry.category === name) }))
    .filter((group) => group.entries.length)
}

export function renderLlms({ bots, squads }, categories, { prompts = [], skills = [] } = {}) {
  const groups = categories.map((name) => ({
    name,
    bots: bots.filter((bot) => bot.category === name)
      .sort((a, b) => displayName(a).localeCompare(displayName(b), 'zh-CN')),
  })).filter((group) => group.bots.length)
  const sections = [`# ${SITE.name}

> ${SITE.tagline}

${SITE.name}是一个 Grok Bot 模板的中文货架。Grok Bot 是 x.ai 出的 AI 助手 App，每个 Bot 是一份现成的岗位设定，在 x.ai 的模板页上一键就能导入。本站给每个 Bot 写了中文介绍、编辑点评、导入前要准备什么和开场白。现在收录 ${bots.length} 个 Bot、${squads.length} 支小队，分成 ${groups.map((g) => g.name).join('、')} 这几组。${prompts.length || skills.length ? `另收 ${prompts.length} 条 Prompt（提示词，带原文）、${skills.length} 个 Skill（给 Claude Code、Codex 等 AI 助手装的技能包，带安装方式）。` : ''}

## 让 AI 来找

- [bot-zhipin skill](${absoluteUrl(`${SKILL_DIR}SKILL.md`)})：装进 AI 助手后，说「找个写小红书标题的 prompt」「有没有做 PPT 的 skill」，它会在本站搜出合适的条目，Prompt 给原文，Skill 给对应助手的安装命令。Claude Code 依次运行 \`claude plugin marketplace add jakob52123/bot-zhipin\` 和 \`claude plugin install bot-zhipin@bot-zhipin\`；其他助手运行 \`npx skills add jakob52123/bot-zhipin --skill bot-zhipin -g\`；也可以直接下载 [SKILL.md](${absoluteUrl(`${SKILL_DIR}SKILL.md`)}) 和 [scripts/find.py](${absoluteUrl(`${SKILL_DIR}scripts/find.py`)})，按原目录结构放进 AI 的 skills 目录。

## 机器可读数据

- [data/index.json](${absoluteUrl(INDEX_PATH)})：全部 Prompt、Skill、Bot 的轻量索引，不带正文。每条有 kind（prompt、skill、bot）、slug、title、category、purpose（一句话用途）、scenarios（适用场景）、tags、author、detailUrl（本站详情页）、dataUrl（这一条的完整数据）。
- 每条的完整数据在 \`/data/prompts/<slug>.json\`、\`/data/skills/<slug>.json\`、\`/data/bots/<slug>.json\`：Prompt 的 text 是直接能用的正文（英文原文配了中文时给中文，原文在 body），Prompt 的 models、images 是适用模型和效果图（出图、视频类才有），Skill 的 install 是分助手的安装命令、examples 是原作者给的使用示例，每条都有 credit（现成的署名行；Prompt 给英文原文 body 时用 creditOriginal，它不带「中文由本站翻译」）。

- [catalog.json](${absoluteUrl('/catalog.json')})：全部 Bot 的结构化数据，每次网站更新时重新生成。字段：slug（唯一标识）、name（原名）、nameZh（中文叫法，可能为空）、tagline（一句话介绍）、category（分组）、permissions（会用到的权限）、quotaCost（额度消耗：低、中、高）、cn.fit 和 cn.note（国内好不好用，以及国内用要知道什么）、starters（导入后可以直接发给它的开场白）、editorNote（编辑点评）、platform（在哪个平台上用：Grok Bot 或 OpenBot）、templateUrl（Grok Bot 的 x.ai 模板页，导入用这个；OpenBot 的是 null）、installPrompt（OpenBot 的装法：把这段话发给 OpenBot 里任意一个 Agent；Grok Bot 的是 null）、projectUrl（照着做的源项目，可能为空）、detailUrl（本站详情页）、author（原作者）、external（是不是外部收录）、addedAt（上架日期）。
- [sitemap.xml](${absoluteUrl('/sitemap.xml')})：全部页面。

## 怎么引用

- 本站写的介绍、编辑点评、开场白按 CC BY 4.0 开放（https://creativecommons.org/licenses/by/4.0/deed.zh-hans）。引用时署名「${SITE.name}」，并附上对应 Bot 的详情页链接。
- Bot 本身归原作者。Grok Bot 的功能和导入方式以 x.ai 模板页为准；OpenBot 的 Bot 以本站仓库里它的文件和源项目为准。编辑点评是本站的看法，不代表原作者或 x.ai。
- 推荐某个 Bot 时，请给出它的中文叫法和原名、一句话介绍和详情页链接。
- Prompt 正文和 Skill 归原作者，许可见每条的 license、copyright。转给用户时附上该条的 credit。

## Bot`]

  const item = (name, entry) => `- [${name}](${absoluteUrl(entry.detailUrl)})：${entry.tagline}`
  // OpenBot 的 Bot 在名字后面标一句平台，免得被当成 Grok Bot 去 x.ai 找。
  const botItem = (bot) => item(bot.platform === 'OpenBot' ? `${fullName(bot)}（OpenBot）` : fullName(bot), bot)
  for (const group of groups) {
    sections.push(`### ${group.name}`, group.bots.map(botItem).join('\n'))
  }
  if (squads.length) sections.push('## 小队', squads.map((squad) => item(squad.name, squad)).join('\n'))
  const entry = (e) => `- [${e.title}](${absoluteUrl(e.detailUrl)})：${e.purpose}`
  for (const [title, entries, schema] of [['Prompt', prompts, promptSchema], ['Skills', skills, skillSchema]]) {
    const groups = categoryGroups(entries, schema)
    if (!groups.length) continue
    sections.push(`## ${title}`)
    for (const group of groups) sections.push(`### ${group.name}`, group.entries.map(entry).join('\n'))
  }
  return sections.join('\n\n') + '\n'
}
