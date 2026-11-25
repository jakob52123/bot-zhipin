# 第一期任务看板

状态：⬜ 未开始 · 🟡 进行中 · ✅ 已验收。每个任务的完整契约和验收命令在维护者本地的派活目录，这里只记摘要。

| # | 任务 | 执行 | 前置 | 写入范围 | 状态 |
|---|---|---|---|---|---|
| H1 | 清场 + 骨架：目录、依赖、schema、模板、共享读取代码、接口约定、CI、许可证 | 维护者 | — | 全仓 | ✅ |
| M1 | 4 个外部收录 Bot 的数据与文案、默认台词、首页文案 | 维护者 | H1 | `bots/<外部>/`、`site/.vitepress/meta.mjs` | ✅ |
| M2 | 投稿文档：AGENTS.md、CONTRIBUTING.md、README、PR 模板、安全提醒 | 维护者 | H1 | 根目录文档 | ✅ |
| M3 | 交互规格 `docs/dev/INTERACTION.md`（实测旧页面 + 补齐缺失状态） | 维护者 | — | `docs/dev/INTERACTION.md` | ✅ |
| P1 | `npm run validate` 全部规则 + 中文报错 + 样例测试 | 编码 agent | H1 | `scripts/validate.mjs`、`scripts/lib/validate/`、`tests/unit/validate*`、`tests/fixtures/` | ✅ |
| P2 | 站点功能：首页货架、排序、详情页、两个按钮、复制提示词、默认头像 | 编码 agent | H1 | `site/`（除 vendor）、`tests/e2e/site*` | ✅ |
| P3 | 计数后端：Functions + D1 迁移 + 去重 + 测试 | 编码 agent | H1 | `functions/`、`migrations/`、`tests/unit/api*`、`scripts/accept-click.sh` | ✅ |
| P4 | 交互实现（按 M3），单独成任务 | 编码 agent | P2、M3 | `site/.vitepress/theme/`、`tests/e2e/interaction*` | ✅ |
| P5 | 投稿流程实测：零上下文 agent 只拿 README 提示词，照 AGENTS.md 做示例 Bot | 编码 agent | P1、M2 | `bots/<示例>/`（验收后删除） | ✅ |
| P6 | 集成验收 1–3 + 独立代码审查 + 交付清单 | 维护者 | 全部 | — | ✅ |
| S1 | 安全加固（独立代码审查的 12 条） | 编码 agent | P1–P3 | 见 PR #1 | ✅ |
| S2 | 一链接投稿：Issue 表单自动转 PR，详情页下架兜底 | 编码 agent + 维护者 | P7 | 见 PR #4、#6 | ✅ |
| P7 | 真实用户测试：上线后用真实 Grok Bot 走完「从货架导入 / 复制提示词安装」和「让 Bot 替我投稿上架」两条路径 | 维护者 | P6、上线 | — | ✅ |

## 交互改版（会动的真脸 + 活泼彩色）

本组记录目标和依赖，不将文档完成等同实现验收；详细契约及验收脚本在 `2026-11-14-bot-zhipin-living/contracts/`、`verify/`。

| ID | 任务 | 前置 | 状态 |
|---|---|---|---|
| LB0 | 交互规格 v2、决策 19–21、架构与维护流程更新，并写知识库草稿供 Claude 验收后搬入。 | 无 | ✅ |
| LB1 | 单时钟活体渲染、视线跟随、SSR 首帧与 bz-play 事件接口。 | 无 | ✅ |
| LB2 | sync-faces 抓取官方颜色/形状、25 形状映射及主题配色。 | 无 | ✅ |
| LB4 | 活泼彩色 token、配色函数、舞台与 Hero 版式和可访问性回归。 | 无 | ✅ |
| LM1 | 将 LB0/1/2/4 合入 feat/living-bots，解决冲突并跑全量检查。 | 前四线验收通过 | ✅ |
| LB3 | 接真脸、全卡悬停、戳、睡醒、Hero 入场、空货架与 404 互动。 | LM1 | ✅ |
| LB5 | 验收全过且用户看过成品后，提交推送并向 main 开 PR。 | LB3、总验收、用户点头 | ✅ |

## 隐私加固（2026-11-25，决策 74）

契约和验收脚本在维护者本地的 `2026-11-25-bot-zhipin-privacy/`。

| ID | 任务 | 状态 |
|---|---|---|
| PV-WATCH | Bot 记 `templateVersion`，投稿自动填；每天核对 Bot 模板和 Skill 来源，结果进 `upstream-watch` issue | ✅ |
| PV-RET | 搜索词原文只留 90 天，事件照常留 400 天 | ✅ |
| PV-PAGE | 隐私说明页 `/privacy` 和页脚入口，页面数字由单测锁住 | ✅ |
| PV-UI | 卡片、精选卡、详情页侧栏露出「会代你发消息」 | ✅ |
| PV-PII | 投稿里疑似手机号、邮箱、身份证号打码提醒；示例邮箱换保留域名 | ✅ |
| PV-REVIEW | 复核 `ai-claim-checker`、`ai-daily-radar`、`wechat-article-catcher` 的新版模板，复核后改 `templateVersion` | ⬜ |

## 第一期验收（来自需求）

1. `npm run validate` 和 `npm run build` 本地通过。
2. 用 `_template` 做示例 Bot，本地能看到卡片和详情页；删掉一个必填字段，validate 给出清楚的中文错误；验收完删掉示例。
3. 本地 `npm run dev:full` 下点按钮热度增加、刷新后排序跟着变；同一 IP 重复点击不重复计数。

## 第一期不做

AI 自动审核、贴链接自动填信息、线上版本比对、点赞评论、作者主页、贡献者榜、需求板、分类筛选、多语言、登录系统，以及除点击计数以外的任何后端。

# 第二期 S3：网站直投

目标：投稿人在本站中文页面完成投稿（预览 → GitHub 登录 → 提交；「拖截图」一步已按 DECISIONS 第 43 条去掉），维护者只点一次 Approve，上线后自动通知投稿人。契约 `SUBMIT.md`，交互 `INTERACTION-SUBMIT.md`。

| # | 任务 | 执行 | 前置 | 写入范围 | 状态 |
|---|---|---|---|---|---|
| M1 | 接口契约 `SUBMIT.md`、ARCHITECTURE、DECISIONS 22–29 | 维护者 | — | `docs/dev/` | ✅ |
| M2 | 交互规格与文案 `INTERACTION-SUBMIT.md` | 维护者 | — | `docs/dev/` | ✅ |
| L1 | 校验内核可移植：纯内核 + fs 适配器、Ajv 预编译、浏览器解包、投稿上下文 | 编码 agent | M1 | `scripts/` | ✅ |
| L2a | GitHub 登录、会话、限流、GitHub 客户端 | 编码 agent | M1 | `functions/`、`migrations/0002` | ✅ |
| L2b | 截图上传、提交、状态接口 | 编码 agent | L1、L2a | `functions/api/submit/` | ✅ |
| L3 | 投稿页浏览器端逻辑 | 编码 agent | L1 | `site/.vitepress/theme/submit/`、`scripts/lib/` | ✅ |
| L4 | 投稿页界面（独立交互任务，真浏览器截图验收） | 编码 agent | M2、L3、界面改版合入 | `site/submit.md`、`Submit*.vue` | ✅ |
| L5 | 命令行改出网站链接、Issue 链路自动补作者、站点配置 | 编码 agent | L1 | `scripts/make-submission-link.mjs`、`meta.mjs` | ✅ |
| L6 | 上线通知工作流、范围检查禁止改作者、CODEOWNERS | 编码 agent | M1 | `.github/`、`scripts/announce-live.mjs` | ✅ |
| M3 | GitHub App、OAuth App、Cloudflare 加密变量 | 维护者 | — | 后台 | ✅ |
| M4 | 投稿文档：AGENTS、README、CONTRIBUTING、MAINTAINING | 维护者 | L5 | 根目录文档 | ✅ |
| SEC | 上线前加固（独立安全审查必修项）：状态缓存、服务端只收明文、校验防超时、额度后扣、按数字 id 绑定归属 | 编码 agent | L2b | `functions/`、`scripts/lib/`、`migrations/0003` | ✅ |
| M5 | 联调：仓库设置（自动合并、规则集）、线上真实全程（新增 + 更新）、CPU 实测 | 维护者 | 全部 | — | ✅ |
| M6 | 待办：真实 Grok Bot 按新版 AGENTS.md 走一遍；投稿人实测；Workers 套餐决定；安全审查「上线后跟进」各项 | 维护者 | M5 | — | ⬜ |
| NS | 去掉截图（DECISIONS 第 43 条）：校验不再要求截图、DESIGN 引用不存在的截图报错；投稿页去掉「放截图」一步；后端接受空回执；Issue 表单去掉截图栏；AGENTS.md 改为摘 Bot 真实输出；文档同步。遗留：`submit.css` 里截图槽位的样式没删（改版线 `feat/shelf-v5` 重写了这个文件，等它合并后一起清）；改版线合并时，`INTERACTION.md` §9.5 里「截图 1（待放入）」「暂无截图。」两处要去掉 | Claude | — | `scripts/`、`functions/`、`site/.vitepress/theme/`、`.github/`、根目录与 `docs/dev/` 文档 | ✅ |

# 资源库 library/（给 Prompt、Skills 板块补原料）

决策 49–55，报告 `INGEST.md`，竞品交互 `COMPETITOR-UX.md`。契约和验收脚本在维护者本地 `2026-11-20-bot-zhipin-library/`。

| # | 任务 | 执行 | 写入范围 | 状态 |
|---|---|---|---|---|
| LI1 | 7 个来源的适配器 + 单测（含 kydlikebtc 照抄分享页摘要的过滤、GrokBotDev 策展署名） | 编码 agent | `scripts/ingest/adapters/`、`tests/unit/ingest-adapter-*`、`tests/fixtures/ingest/` | ✅ |
| LI2 | 管线：去重、许可回溯、跨来源剔除分享页原文、已上架、needsReview、cnFit、注释合并、前 50、写盘 | 编码 agent | `scripts/ingest/`、`tests/unit/ingest-pipeline*`、`ingest-review*` | ✅ |
| LI3 | 中文三项、严格五项评分、前 50 首个任务 | 写作模型 | `library/annotations/` | ✅ |
| LI4 | 许可落实：`library/LICENSES.md`、`THIRD_PARTY_NOTICES.md`；INGEST 报告；COMPETITOR-UX | 维护者 | 文档 | ✅ |
| LI5 | 用户看 INGEST.md 点头 → 推送开 PR | 维护者 | — | ✅ |
| LI6 | 页面（Prompt、Skills 板块从 library 挑条目；交互单独做） | — | — | ✅ |

# 被搜到、被转发、被机器读到（2026-11-21）

目标：sitemap、Bot 详情页标题和描述、分享卡片（og 标签 + 构建时出图）、`/catalog.json` 和 `/llms.txt`、点击接口加 `starter` / `kickoff`。决策 56–60。任务书和验收脚本在维护者本地的派活目录。

| # | 任务 | 执行 | 前置 | 写入范围 | 状态 |
|---|---|---|---|---|---|
| A | 标题和描述、canonical 和分享标签、sitemap、robots、catalog.json、llms.txt | 编码 agent | — | `site/.vitepress/config.mts`、`scripts/lib/{share,catalog,llms}.mjs`、`site/public/robots.txt` | ✅ |
| B | 构建时出分享图：Bot、小队、全站各一张，Noto Sans SC 子集；换行标点优先、行宽均衡 | 编码 agent | — | `scripts/og/`、`scripts/gen-og-fonts.mjs`、依赖 | ✅ |
| C | 计数加 starter / kickoff：迁移 0004、接口、前端、测试、文档 | 编码 agent | — | `functions/`、`migrations/0004`、`heat.ts`、三个组件 | ✅ |
| M | 集成、复跑验收、目视分享图；线上 D1 先备份再迁移，然后合并 | 维护者 | A、B、C | — | ✅ |

# 搜索面板也搜 Prompt 和 Skills（2026-11-22）

决策 71。

| # | 任务 | 执行 | 写入范围 | 状态 |
|---|---|---|---|---|
| SP1 | ⌘K 面板输入后加 Prompt、Skills 两组：`searchLibrary`、按需加载的 `library-search.data`（失败退回 `/data/index.json`）、分类砖条目、吸顶组名、读屏播报；中英文交界拆词（库页同用）、原名按词头匹配、场景最低档；单测、样例站 e2e、对比度 e2e、浅深色和 390 手机截图 | 编码 agent | `SearchPalette.vue`、`LibraryPage.vue`、`theme/search.ts`、`data/library-search.data.mjs`、`tests/unit/search*`、`tests/e2e/search-library*` | ✅ |

# 埋点（2026-11-22）

目标：全站埋点自建，存 D1，命令出中文报告。决策 72，设计 `TRACKING.md`。任务书和验收脚本在维护者本地的派活目录 `2026-11-22-bot-zhipin-tracking/`。

| # | 任务 | 执行 | 前置 | 写入范围 | 状态 |
|---|---|---|---|---|---|
| TR-API | `POST /api/events`、迁移 0005、单测（真实本地 D1） | 编码 agent | — | `functions/api/events.ts`、`functions/_lib/events-store.ts`、`migrations/0005` | ✅ |
| TR-RPT | `npm run report` 只读报告、单测 | 编码 agent | — | `scripts/report.mjs`、`scripts/lib/report.mjs` | ✅ |
| TR-WEB-CORE | `theme/track.ts` 模块和单测，不接组件 | 编码 agent | — | `site/.vitepress/theme/track.ts` | ✅ |
| TR-WEB-HOOK | 接进主题入口和各组件、e2e 核对每个事件 | 编码 agent | #34、#35、#36 已合进 main；TR-WEB-CORE 已完成。全站搜索面板见 TR-SEARCH | `theme/index.ts`、各组件、`theme/submit/`、`tests/e2e/tracking*` | ✅ |
| TR-SEARCH | 全站搜索面板接 `search`：记录打开方式、完整命中数及是否选中，e2e 核对 | 编码 agent | SP1（#38）、TR-WEB-HOOK | `SearchPalette.vue`、`tests/e2e/tracking.spec.mjs`、埋点文档 | ✅ |
| TR-INT | 集成、文档、开 PR；线上先备份再迁移，然后合并 | 维护者 | 全部 | — | ✅ |

# 让 AI 来找：bot-zhipin skill（2026-11-22）

目标：任何人的 AI 助手装上 `bot-zhipin` skill 后能搜本站的 Prompt、Skills 和 Bot，Prompt 给原文，Skill 给安装命令。决策 70。

| # | 任务 | 执行 | 前置 | 写入范围 | 状态 |
|---|---|---|---|---|---|
| FS1 | 构建时输出 `/data/index.json` 和每条完整数据，llms.txt 补 Prompt、Skills | 维护者 | — | `scripts/lib/{agent-data,llms}.mjs`、`site/.vitepress/config.mts`、单测 | ✅ |
| FS2 | skill 本体：SKILL.md、`find.py`、Claude Code 插件清单 | 编码 agent | FS1 的数据格式 | `integrations/bot-zhipin/`、`.claude-plugin/` | ✅ |
| FS3 | README、架构、决策；验收后推送开 PR，上线后线上核对 | 维护者 | FS1、FS2 | 文档 | ✅ |

# 投稿人的作者主页（2026-11-22）

目标：有 GitHub 的作者都有 `/authors/<登录名>`，头像由本站转发 GitHub 头像，作者链接改到站内。决策 73。任务书和验收脚本在维护者本地的派活目录。

| # | 任务 | 执行 | 前置 | 写入范围 | 状态 |
|---|---|---|---|---|---|
| P | 头像转发 `/api/avatar/<登录名>`、作者白名单 `authors.json`、作者页下架兜底 | 编码 agent | — | `functions/api/avatar/`、`functions/authors/`、`functions/_lib/{authors,slugs,types}.ts`、`scripts/sync-assets.mjs` | ✅ |
| A | 作者主页（数据、路由、页面、头像兜底）和四处作者链接改向 | 编码 agent | — | `scripts/lib/authors.mjs`、`site/authors/`、`AuthorPage.vue`、`AuthorAvatar.vue`、`author.css`、四个组件 | ✅ |
| R1 | 审查修正·后端：大写地址 308、空正文 502、类型防护、白名单复用 `buildAuthors`、单测补强 | 编码 agent | P、A | `functions/authors/`、`functions/api/avatar/`、`scripts/lib/authors.mjs`、`scripts/sync-assets.mjs` | ✅ |
| R2 | 审查修正·前端：作者页归 Bot 模块、拉热度、本页卡片署名改纯文字、首字按字形且图片态透明、e2e 确定测水合两条分支 | 编码 agent | P、A | 四个组件、`author.css`、`tests/e2e/` | ✅ |
| R3 | 审查修正·冒名：fork PR 新增条目的 `author.github` 必须是 PR 作者；投稿文档写明作者主页 | 编码 agent | P、A | `scripts/check-pr-scope.mjs`、`ci.yml`、文档 | ✅ |
| R4 | 第二轮审查收尾：缓存键小写测试、⚠ 改 Actions 注释、撤主页只限外部收录、fork PR 改越界文件一律不合、首字大写按长度、Symbol 注入键 | 编码 agent | R1、R2、R3 | 见 PR | ✅ |
| M | 集成到最新 main，多 agent 对抗审查三轮，真后端加真 GitHub 头像实测，截图目视，然后合并 | 维护者 | R1–R4 | — | ✅ |
