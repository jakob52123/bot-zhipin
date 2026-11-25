# Bot 直聘

Bot 直聘是一个通用的 AI 资源货架，主要提供可以直接导入的 Grok Bot 模板，也收录 Prompt 和 Skills。欢迎投稿你做的 Bot。

- 网站：https://bot.jiachengbo.com
- 每个 Bot 是 [`bots/`](bots/) 下的一个文件夹，里面有岗位说明、技能、定时任务和作者的设计说明
- 几个 Bot 可以编成一支小队：[`squads/`](squads/) 下一支队一个文件，写清谁是队长、各管什么、怎么配合
- 任何人都可以通过 PR 投稿，合并后网站自动更新，投稿者成为项目贡献者，并有自己的作者主页（GitHub 头像、昵称和全部作品）

## 怎么用货架上的 Bot

- **一键导入**：点一下就会复制一段试跑用的开场白；电脑上会直接唤起 Grok Bot App（`grokbot://`），手机上则会打开 x.ai 模板页。没装 App 的话，页面会提供下载入口。
- **复制安装提示词**：只有作者投稿的 Bot 才有，外部收录的 Bot 没有。模板链接打不开时，可以把复制的提示词发给你自己的 Grok Bot。它会先告诉你这个 Bot 会做什么、需要哪些权限，等你确认后再安装。

导入前请看一眼详情页里的「会用到的权限」和「额度消耗」。

## 让你的 AI 来找

网站上的 Prompt、Skills 和 Bot 也能让 AI 助手直接搜：装上 `bot-zhipin` 这个 skill，跟它说「找个写小红书标题的 prompt」「有没有能做 PPT 的 skill」，它会在本站挑出合适的几条，Prompt 直接给原文，Skill 给出你这个助手的安装命令，确认后再装。

- Claude Code：在终端依次运行这两条
  ```
  claude plugin marketplace add jakob52123/bot-zhipin
  claude plugin install bot-zhipin@bot-zhipin
  ```
  装完新开一个会话。以后更新：`claude plugin marketplace update bot-zhipin`，再 `claude plugin update bot-zhipin@bot-zhipin`。
- Codex、Cursor 等其他助手：`npx skills add jakob52123/bot-zhipin --skill bot-zhipin -g`（`-g` 装到全局，所有项目都能用）
- 别的办法都不方便时：让你的 AI 下载 https://bot.jiachengbo.com/skill/bot-zhipin/SKILL.md 和 https://bot.jiachengbo.com/skill/bot-zhipin/scripts/find.py，按原来的目录结构放进它的 skills 目录

skill 的源文件在 [`integrations/bot-zhipin/`](integrations/bot-zhipin/)，它读的数据是网站构建时生成的 [`/data/index.json`](https://bot.jiachengbo.com/data/index.json)，说明见 [`llms.txt`](https://bot.jiachengbo.com/llms.txt)。

## 我要投稿

最快的方式：打开 **https://bot.jiachengbo.com/submit** ，点「复制投稿提示词」，发给你的 AI（你的 Grok Bot、Codex 或 Claude Code）。也可以直接复制下面这段：

```text
请帮我把我做的 Grok Bot 投稿到「Bot 直聘」：https://github.com/jakob52123/bot-zhipin
1. 先完整读一遍仓库根目录的 AGENTS.md，严格按它的步骤做。
2. 能从你自己（或我的 Bot 配置）里查到的信息直接用，查不到的再一次问清我；不要编造效果。
3. 不要向我要 GitHub 令牌或密码。
4. 最后给我一个 https://bot.jiachengbo.com/submit 开头的投稿链接。
```

AI 只会问你几件它查不到的事，然后给你一个链接：**点开 → 用 GitHub 登录 → 勾授权提交**。检查、开 PR、上线后通知你，全部自动。

想自己动手，看 [CONTRIBUTING.md](CONTRIBUTING.md)。

> **安全提醒**：不要把 GitHub 令牌放进 Grok Bot 的云电脑（第三方模板能读到那台电脑上的所有文件）；需要令牌时用权限最小、能随时撤销的，提交完就撤销；投稿里不要有任何 API 密钥、内部链接或个人数据。

## 开发

需要 Node.js 22 以上。

| 命令 | 作用 |
|---|---|
| `npm ci` | 安装全部依赖 |
| `npm run validate` | 校验所有 Bot、小队和策展文件 |
| `npm run dev` | 本地预览页面 |
| `npm run dev:full` | 本地预览 + 点击计数接口（Cloudflare Pages Functions + 本地 D1） |
| `npm test` | 单元测试 |
| `npm run e2e` | 真浏览器测试 |
| `npm run check` | 提交前检查：validate + test + build |

维护者文档在 [`docs/dev/`](docs/dev/)。

## 授权

- 网站代码：[MIT](LICENSE)
- `bots/` 下的投稿内容：[CC BY 4.0](bots/LICENSE)
- 本站写的 Bot 介绍、编辑点评、开场白（外部收录条目和 `curation/`）：[CC BY 4.0](bots/LICENSE)，署名「Bot 直聘」
- 第三方代码：见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
