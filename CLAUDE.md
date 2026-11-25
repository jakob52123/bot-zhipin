# 维护者说明（给 Claude Code）

这是「Bot 直聘」：一个尽量通用的 AI 资源货架，给所有用 AI 干活、学习、创作的中文用户。主体是 Grok Bot 模板货架，任何人通过 PR 往 `bots/` 投稿；另有 Prompt、Skills 两个收录库，只由维护者收录。

受众不限职业：学生、写作者、开发者、上班族、创业者都算，产品经理只是其中一类（用户 2026-11-20 定）。选品、分类、介绍和示例都按这个写：分类按用途分，不按职业分；本来就是产品工具的照实写，通用的东西不硬套产品经理的场景。

## 先读

- `docs/dev/ARCHITECTURE.md`：目录、数据流、约定
- `docs/dev/API.md`：点击计数、头像转发和作者页兜底的接口约定（前后端共用）
- `docs/dev/TRACKING.md`：埋点设计（事件表、接口、隐私、报告口径）；事件名和字段只在 `functions/_lib/events.ts` 定义
- `docs/dev/DECISIONS.md`：已经定下的决策，改之前先问
- `docs/dev/TASKS.md`：任务看板
- `docs/dev/MAINTAINING.md`：审核投稿、下架、清计数的操作步骤
- 根目录 `AGENTS.md` 是**给投稿者的 AI** 看的投稿指南，不是维护说明

## 命令

| 命令 | 作用 |
|---|---|
| `npm run check` | 提交前必须通过：validate + test + build |
| `npm run validate` | 校验所有 Bot、小队和策展 |
| `npm test` | vitest 单元测试 |
| `npm run dev` | 只看页面（没有计数后端，热度显示「—」） |
| `npm run dev:full` | 页面 + 计数接口 + 本地 D1，端口 8788 |
| `npm run e2e` | Playwright 真浏览器验收（自动起 dev:full） |
| `npm run report` | 埋点报告：只读查线上库，最近 7 天（`--days`、`--local`、`--json`） |
| `npm run new-bot -- <slug>` | 从模板新建 Bot |

## 规则

- 面向用户的文案一律简体中文；报错要写清文件、位置、改法。
- 不复制 fork 来源（原 Grok Bot 教程站）的任何文字、图片、组件代码。
- `site/.vitepress/theme/vendor/bloub/` 是第三方 MIT 代码，不改。
- 不提交任何密钥。线上变量在 Cloudflare 后台，本地在 `.dev.vars`（gitignore）。
- 分组（字段名 `category`，9 个：产品、市场、销售、内容、运营、学习、求职、管家、生活）、权限、额度的取值只在 `schema/bot.schema.json` 里定义，代码里通过 `loadEnums()` 读取，不写死。每个分组的颜色和吉祥物在 `theme/color.ts`，一句说明在 `meta.mjs` 的 `CATEGORY_COPY`，改枚举时一起改，单测会核对。
- 本仓库本地还有 `upstream` 远端（原仓库）。`gh pr create` 一律带 `--repo jakob52123/bot-zhipin`，绝不推送或提 PR 到 upstream。
- 构建产物里不能有 `_worker.js`（会让 Pages 忽略 `functions/`）。
- 改了 `schema/` 下任何一份 schema（`bot`、`squad`、`curation`、`prompt`、`skill`）都要运行 `npm run gen:schema`；`scripts/lib/validate/generated/` 是派生物，不算第二份枚举。
- 改了标签页图标的画法（`theme/live/favicon.ts` 的 `FAVICON_DEFAULT`、`FAVICON_FACE`、`faviconSvg`）要运行 `npm run gen:favicon`，把 `site/public/` 下重新生成的三个图标一起提交。
