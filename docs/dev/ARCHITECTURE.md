# 架构

## 一句话

`bots/` 里一个 Bot 一个文件夹，`squads/` 里一支小队一个文件，`curation/shelf.yaml` 是维护者的策展 → 构建时读成静态网站（VitePress）→ Pages Functions 处理点击计数、网站投稿、GitHub 头像转发和下架兜底，计数和投稿用 D1。

## 目录

| 路径 | 是什么 | 谁会改 |
|---|---|---|
| `bots/<slug>/` | Bot 本体和卡片信息 | 投稿者 |
| `bots/_template/` | 投稿模板 | 维护者 |
| `squads/<slug>/squad.yaml` | 小队：成员（货架上的 Bot）、队长、分工、交接、接线步骤。一支队只有这一个文件 | 投稿者 |
| `curation/shelf.yaml` | 策展：首页主推、推荐排序、专题、编辑点评 | **只有维护者** |
| `prompts/<slug>.yaml`、`skills/<slug>.yaml` | Prompt、Skill 收录条目，格式与枚举取自 `schema/{prompt,skill}.schema.json` | **只有维护者** |
| `schema/bot.schema.json` | bot.yaml 的 JSON Schema，**分组（`category`）、权限、额度的枚举唯一真源** | 维护者 |
| `schema/squad.schema.json`、`schema/curation.schema.json` | squad.yaml 和 shelf.yaml 的 JSON Schema | 维护者 |
| `scripts/lib/load-bots.mjs` | 读取 bots/ 的共享代码（只读不校验） | 维护者，改了影响校验器和网站 |
| `scripts/lib/load-squads.mjs`、`load-curation.mjs` | 读取小队和策展（只读不校验，不跟随符号链接）；目录怎么定见下面「约定」 | 维护者 |
| `scripts/lib/bot-summary.mjs`、`squad-summary.mjs`、`curation-summary.mjs` | 网站用的数据形状，纯函数：Bot 摘要及其装饰、小队摘要、策展整理 | 维护者，改了影响所有页面 |
| `scripts/lib/bot-name.mjs` + `site/.vitepress/theme/components/BotName.vue` | Bot 怎么称呼：`name` 是原名，`nameZh` 是可选的中文叫法。`displayName` / `originalName` / `fullName` 三个纯函数定规矩（构建脚本和页面共用），`BotName.vue` 负责画（中文叫法为主、原名跟在后面）。页面上要写 Bot 名字一律用它，规格见 `INTERACTION.md` §3.4 | 维护者 |
| `scripts/lib/share.mjs` | 站内绝对地址、Bot 页面标题和描述、分享图地址及版本号的共享规则 | 维护者 |
| `scripts/lib/catalog.mjs` | 将完整货架摘要整理成按 slug 排序的 catalog.json | 维护者 |
| `scripts/lib/llms.mjs` | 将完整货架摘要按 schema 分组顺序排成 llms.txt，Prompt、Skills 按各自分类枚举分节 | 维护者 |
| `scripts/lib/agent-data.mjs` | 给 AI 用的数据：`/data/index.json` 轻量索引 + 每条一份完整数据，带现成署名行（决策 70） | 维护者 |
| `integrations/bot-zhipin/` + `.claude-plugin/marketplace.json` | `bot-zhipin` skill 正本（SKILL.md + `scripts/find.py`），同时是 Claude Code 插件；构建时拷到 `/skill/bot-zhipin/` | 维护者 |
| `scripts/validate.mjs` + `scripts/lib/validate/` | `npm run validate`：Bot、小队、策展及两个收录库的全量校验；`validate/squads.mjs` 是小队和策展的校验内核 | 维护者 |
| `scripts/gen-schema-validator.mjs` | `npm run gen:schema`：把五份 schema 各预编译成 `scripts/lib/validate/generated/<名字>-schema.mjs` | 维护者 |
| `scripts/og/` | 构建结束时用本地字体子集生成 Bot、小队和全站的 PNG 分享图 | 维护者 |
| `scripts/sync-assets.mjs` | 构建前把截图、头像复制到 `site/public/bot-assets/`，并生成 `site/public/api-data/slugs.json`、`squad-slugs.json`、`authors.json`（头像转发与作者页兜底共用） | 维护者 |
| `site/` | VitePress 站点根目录；`site/.vitepress/meta.mjs` 放站名、仓库地址、安装提示词、默认台词、每个分组的一句说明（`CATEGORY_COPY`） | 维护者 |
| `site/.vitepress/data/` | 数据加载器：`bots.data`（列表数据：Bot 摘要 + 装饰，不带 `about` 全文）、`squads.data`（小队摘要）、`curation.data`（策展）；三份都由 `bots.mjs` 的 `shelfData()` 一次算出，保证对得上 | 维护者 |
| `site/squads/[slug].md` + `[slug].paths.mjs` | 小队页的动态路由 `/squads/<slug>` | 维护者 |
| `site/authors/[login].md` + `[login].paths.mjs` | 作者主页的动态路由 `/authors/<login>`，按小写 GitHub 登录名汇集 Bot 和小队 | 维护者 |
| `site/.vitepress/theme/components/SquadDetail.vue` | 展示成员、分工和交接；支持逐个导入并在本机记录点过哪些成员，展示接线步骤、可复制的组队口令和组队后的第一句话 | 维护者 |
| `site/.vitepress/theme/vendor/bloub/` | 第三方 MIT 头像引擎，**不要改** | 只能整体升级 |
| `site/.vitepress/theme/live/` | 单 rAF 时钟 clock.ts、视线 gaze.ts、帧与反应接线；离屏/隐藏/减少动效暂停 | 维护者 |
| `site/.vitepress/theme/live/favicon.ts` | 标签页图标：随机 Bot、定时变身；纯函数出 SVG，`startFavicon` 在 `theme/index.ts` 里按需加载 | 维护者 |
| `scripts/gen-favicon.mjs` + `site/public/favicon.*`、`apple-touch-icon.png` | 静态兜底图标及其生成脚本（`npm run gen:favicon`，生成物提交进仓库） | 维护者 |
| `site/.vitepress/theme/components/LiveBot.vue` | SSR sample(0) + 客户端活体 SVG；bz-play 事件入口 | 维护者 |
| `site/.vitepress/theme/face.ts` | 官方形状映射、botFace / resolveFace、faceColors 和 seed 回退 | 维护者 |
| `site/.vitepress/theme/shapes-extra.ts` | 15 种原创径向轮廓，不复制 x.ai 路径 | 维护者 |
| `site/.vitepress/theme/color.ts` | contrast、darkSwap、buttonColors、botPalette 纯函数配色；分组的颜色和吉祥物（`CATEGORY_COLORS`、`CATEGORY_MASCOTS`） | 维护者 |
| `site/.vitepress/theme/styles/` | 全站视觉，按区域分十个文件：`tokens.css`（token）、`base.css`（基础部件：按钮、标签、头像砖、区块标题、分段控件、气泡、焦点）、`nav.css`（导航条）、`hero.css`（首屏）、`home.css`（首页区块和卡片）、`detail.css`（Bot 详情页）、`squad.css`（小队卡片和小队详情页）、`author.css`（作者主页的头像、资料和作品区）、`misc.css`（404、空状态、弹窗）、`library.css`（Prompt / Skills 的列表和详情页）；`theme/index.ts` 按这个顺序引入。规格见 `INTERACTION.md` §1、§1b | 维护者 |
| `site/.vitepress/theme/icons.ts` + `components/BzIcon.vue` | 全站唯一一套线性图标：路径数据 + 渲染组件 | 维护者 |
| `site/.vitepress/theme/enums.data.mjs` | 构建时用 `loadEnums()` 读 schema，把分组枚举（含顺序）给到浏览器；首页分组筛选用 | 维护者 |
| `site/.vitepress/theme/components/BotShelf.vue` | 首页骨架：读屏播报区、首屏（`HeroBallpit`）、首屏以下的区块（`HomeSections`） | 维护者 |
| `site/.vitepress/theme/components/HeroBallpit.vue` + `theme/ballpit-physics.ts` | 首屏球池：货架上的真 Bot 掉下来堆在地板上，站名和搜索框是碰撞体；名片点进详情。物理是不碰 DOM 的纯模块（规格见 INTERACTION.md §2.2） | 维护者 |
| `site/.vitepress/theme/components/FeaturedCard.vue` | 精选大卡：活 Bot、名字、介绍、作者、热度、导入；不带气泡 | 维护者 |
| `site/.vitepress/theme/components/SearchTrigger.vue` | 长得像输入框的按钮（首屏和工具栏各一个），只负责派发 `bz-search-open` | 维护者 |
| `site/.vitepress/theme/components/SearchPalette.vue` + `theme/search.ts` | 搜索命令面板和它的匹配、排序规则（Bot、小队、Prompt、Skills）；挂在 Layout 的 `layout-bottom` 插槽，全站可用。Prompt、Skills 的数据 `site/.vitepress/data/library-search.data.mjs` 在第一次打开面板时才 `import()`，单独成块（决策 71） | 维护者 |
| `site/.vitepress/theme/components/SiteFooter.vue` | 全站页脚：创建人、开源仓库、鸣谢（文字在 `meta.mjs` 的 `FOOTER`）；也挂在 `layout-bottom` | 维护者 |
| `site/.vitepress/theme/components/BotCard.vue`、`BotAvatar.vue`、`BotActions.vue` | 列表卡：article 是容器查询的容器，里面的 `.bot-card-body` 是版式网格；头像外层在卡片里 `display: contents`，玻璃砖和气泡各占一格。/submit 的投稿预览复用这几个组件 | 维护者 |
| `site/.vitepress/theme/components/BotDetail.vue` | 详情页（一份「简历」）：头部 + 吸顶侧栏（导入、三项属性、作者来源）+ 主栏的一块块内容；同样被投稿预览复用。配套 `DetailStarters.vue`（开场白，点一下复制）、`BotMini.vue`（小头像）；「同组的 Bot」和小队成员小头像由 `site/.vitepress/data/detail.mjs` 在构建时算好，经 `site/bots/[slug].paths.mjs` 放进路由参数。规格见 INTERACTION §9 | 维护者 |
| `site/.vitepress/data/faces.json` | slug → color / shape / fetchedAt 的离线真脸数据，静态 import | 维护者 |
| `scripts/sync-faces.mjs` | 手动抓 x.ai 模板页；--check 离线校验 | 维护者 |
| `functions/api/` | 点击计数接口；`events.ts` 是埋点接口（`TRACKING.md` 第 5 节） | 维护者 |
| `functions/_lib/events.ts` | **埋点事件名和字段的唯一真源**，前端 `theme/track.ts`、后端、`scripts/report.mjs` 共用；改了同步 `TRACKING.md` 第 3 节（单测核对） | 维护者 |
| `site/.vitepress/theme/track.ts` | 埋点前端：排队、批量发送、页面类型、站外链接分类；组件里调用 `track(事件名, 字段)` | 维护者 |
| `scripts/report.mjs` | `npm run report`：只读查 D1 的 `events`，打印中文埋点报告 | 维护者 |
| `functions/api/avatar/[login].ts` | GitHub 头像转发，只服务 `/api-data/authors.json` 白名单内的作者 | 维护者 |
| `functions/authors/[login].ts` | 作者页下架兜底：登录名不在作者清单内就返回 404 | 维护者 |
| `functions/bots/[slug].ts`、`functions/squads/[slug].ts` | 下架兜底：不在清单里的 Bot / 小队立即返回 404，不让边缘缓存继续给旧页面 | 维护者 |
| `functions/data/{prompts,skills,bots}/[slug].ts` + `functions/_lib/data-route.ts` | 给 AI 用的每条完整数据的下架兜底：不在清单里的立即返回 JSON 404（决策 70） | 维护者 |
| `migrations/` | D1 表结构 | 维护者 |
| `tests/unit/` | vitest 单元测试；`tests/fixtures/` 校验器样例；`tests/e2e/` Playwright 真浏览器 | 维护者 |
| `docs/dev/` | 维护者文档 | 维护者 |
| `docs/dev/INTERACTION-LIBRARY.md` | Prompt / Skills 的交互规格 | 维护者 |
| `library/` | 资源库原料：从开源仓库收的分享链接、岗位设定、提示词、技能、定时任务、团队、配方，混合许可（`library/LICENSES.md`）；**不进站点构建**，报告见 `INGEST.md` | 维护者跑 `scripts/ingest/run.mjs` 生成；`annotations/` 是写作模型产出 |
| `scripts/ingest/` | 入库管线：每个来源一个适配器（`adapters/`），`run.mjs` 去重、许可回溯、安全标记、国内适配、写盘；来源仓库和提交在 `sources.json` | 维护者 |

## 数据流

网站和 Issue 投稿读取 x.ai 公开模板的 activeVersion，写入 `bot.yaml` 的 `templateVersion`；Skill 的审阅提交直接取自 `source.url`。
定时任务逐项对照上游，将待复核项同步到一个 `upstream-watch` issue。只有人工复核后才更新条目，没有独立锁文件。

```
x.ai 模板页 →（维护者跑 sync-faces）→ site/.vitepress/data/faces.json → 构建

bots/*/bot.yaml, *.md, screenshots/        squads/*/squad.yaml        curation/shelf.yaml
   │  load-bots.mjs                           │  load-squads.mjs          │  load-curation.mjs
   ├──────────────────────────────────────────┴───────────────────────────┤
   ├──► scripts/validate.mjs（PR 时在 CI 里跑：Bot + 小队 + 策展，小队和策展引用的 slug 必须在货架上）
   └──► site/.vitepress/data/bots.mjs 的 shelfData() ──► bots.data（列表，不带 about）、squads.data、curation.data
            + 动态路由 /bots/<slug>（参数里是完整摘要，带 about）、/squads/<slug>、/authors/<login> ──► site/.vitepress/dist/
                                                                          │
浏览器 ── GET /api/stats、POST /api/click ──► functions/api/* ──► D1（DB） │
                                     └─ 读 /api-data/slugs.json（ASSETS）─┘
浏览器 theme/track.ts ── POST /api/events（批量）──► functions/api/events.ts ──► D1 events ──► npm run report（只读）
浏览器 ── GET /bots/<slug>、/squads/<slug> ──► functions/{bots,squads}/[slug].ts
                                     └─ 读 /api-data/slugs.json、squad-slugs.json，不在清单里就 404
浏览器 ── GET /authors/<login> ──► functions/authors/[login].ts ──► 读 /api-data/authors.json：名单外返回 404；名单内登录名含大写时先 308 到小写，否则交给静态页；清单读不到时不拦截
浏览器 ── GET /api/avatar/<login> ──► functions/api/avatar/[login].ts ──► 读 /api-data/authors.json：在清单内才查缓存或取 GitHub 头像，否则 404
```

### 网站拿到的数据长什么样

三份数据都在构建时算好，页面里 `import { data } from '…/data/<名字>.data.mjs'` 直接用。

**Bot 摘要**。`summarizeBot()` 是纯函数，出的是完整摘要：详情页的 `params.bot` 拿到的就是它。首页和搜索面板用的 `bots.data`（数组）是同一个形状**去掉 `about`**（`bots.mjs` 的 `listSummaries()`）：82 个 Bot 的完整摘要有 245KB，去掉 `about` 是 100KB，而这份数据每个页面都要加载。要在首页用 `about` 里的东西，先想清楚值不值得让每个页面多背这些字。V5 新增的字段：

| 字段 | 含义 |
|---|---|
| `category` | 分组，9 选 1（产品、市场、销售、内容、运营、学习、求职、管家、生活） |
| `name` / `nameZh` | `name` 始终是原名；`nameZh` 是中文叫法，没写是 `null`。界面上叫它什么用 `displayName(bot)`（`scripts/lib/bot-name.mjs`），不要自己拼 |
| `forkedFromName` / `forkedFromNameZh` | 「改编自」那个 Bot 的原名和中文叫法（没有是 `null`） |
| `pitches` | 台词数组（没写是 `[]`）；`pitch` 保留，取第一句或 `null` |
| `about` | **只在完整摘要里**，列表数据没有这个键。没写是 `null`；写了就是 `{ intro, does[], starters[], skills[{name, does}], routines[{what, when, default, quiet}], fit, notFit, cnFit, cnNote }`，缺的数组是 `[]`、缺的字符串是 `null` |
| `platform` | `Grok Bot` 或 `OpenBot`（`bot.yaml` 不写就是 Grok Bot；常量和归一在 `scripts/lib/platform.mjs`，决策 76） |
| `templateUrl` | Grok Bot 的 x.ai 模板链接；OpenBot 的是 `null` |
| `projectUrl` | 照着做的源项目，没写是 `null`；钉在 `tree/<提交号>` 上时，每天的上游核对会比对它 |
| `repoFiles` | 仓库里有这个 Bot 的 ROLE.md、技能这些文件（作者投稿的、OpenBot 的都有），「复制安装提示词」靠它们装 |
| `needsAccount` | 权限里有「外部账号」或「浏览器 Cookie」 |
| `selfRunning` | 权限里有「定时自动运行」 |

货架数据在摘要上再装饰三项（`decorateSummary()`；投稿预览没有策展和小队，取默认值，形状一样）：

| 字段 | 含义 |
|---|---|
| `editorNote` | 编辑点评，没有是 `null` |
| `pick` | 在 `curation.picks` 里的序号（从 0 起），不在里面是 `null` |
| `squads` | 它所在的小队：`[{ slug, name, title, lead, detailUrl }]`，`title` 是它的队内岗位 |

**小队摘要**（`squads.data`，数组；小队页的 `params.squad` 是同一个形状）：squad.yaml 的原字段（可选字段补默认值：`flow`、`setup`、`notes`、`missing` 是 `[]`，`kickoff`、`tryout` 是 `null`），加上：

| 字段 | 含义 |
|---|---|
| `detailUrl` | `/squads/<slug>` |
| `author.link` | GitHub 主页，没有就用 `author.url`，都没有是 `null` |
| `author.page` | 站内作者主页 `/authors/<小写登录名>`，没有 GitHub 是 `null`（Bot 摘要同理） |
| `members[]` | `{ bot, title, does, lead, optional }` 加上对应 Bot 摘要的 `name`、`nameZh`、`tagline`、`category`、`detailUrl`、`templateUrl`、`quotaCost`、`permissions`、`prerequisites`、`avatar`、`needsAccount`、`selfRunning`；`bot` 是 slug |
| `leader` | 队长的 slug，没有是 `null` |
| `quota` | `{ max, perMember: [{ bot, quotaCost }] }`，`max` 是成员里最高的一档 |
| `permissions` | 成员权限的并集：`[{ permission, bots: [slug] }]`，按 schema 枚举顺序 |
| `prerequisites` | `[{ bot, items: [...] }]`，内容是「无」的成员不列 |

`flow` 里的 `from`、`to` 是成员的 slug，或 `you`（代表用户本人）。

**策展**（`curation.data`，对象）：`{ featured: [{ bot, note }], picks: [slug], collections: [{ slug, title, blurb, bots: [slug] }], editorNotes: { slug: 一句话 } }`。里面的 `bot`、`bots` 都是 slug，Bot 的信息按 slug 去 `bots.data` 里取。没有策展文件时四项都是空的。首页的主推读的就是这里的 `featured`（没写主推时退回热度前三）。

### 作者路由与摘要

`site/authors/[login].paths.mjs` 用 `buildAuthors(shelfData())` 为公开 Bot 和小队的 GitHub 作者生成 `/authors/<小写登录名>`。跨作品按日期降序、同日 Bot 优先、slug 升序取首条昵称和登录名。摘要 `author.page` 是站内作者路径，无 GitHub 时为 `null`；`author.link` 仍是给目录和机读接口用的外链。

### Prompt / Skills 收录库

`prompts/<slug>.yaml`、`skills/<slug>.yaml` 是唯一条目源，分别对应 `schema/{prompt,skill}.schema.json`。`scripts/lib/load-prompts-skills.mjs` 读文件和 schema，`validate/library.mjs` 验证字段、来源、许可、版权行及原文与译文的对应关系。所有许可的 Prompt 都可写 `body`；英文原文没有 `bodyZh` 时提醒，不阻断构建。测试可用 `PROMPTS_DIR`、`SKILLS_DIR` 指定独立目录，默认跟随 Bot 目录的兄弟目录。

Prompt 的 `copyright` 是单行原版权行（1–200 字），有 `body` 必填，只投影到详情。Skill 的 `requires` 是有序依赖列表，最多 5 项、去重，每项 1–80 字。分类选项取自 schema；`theme/library-marks.ts` 只负责分类名到颜色和 SVG 路径的映射，单测逐库核对键集合。

`entry-summary.mjs` 在详情数据中保留 Prompt 原文和本站译文，精简列表两者都不带。详情有译文时默认显示和复制中文，原文折叠并可单独复制；没有译文就使用原文。`site/.vitepress/data/prompts-skills.mjs` → 列表 data loader / `[slug].paths.mjs` → `site/{prompts,skills}/` 列表和静态详情。浏览器只在本库列表字段上查询；不加载 SKILL.md、不发搜索请求、不接 Bot 热度接口。全站搜索面板另用一份更小的 `library-search.data`（不带正文，只带标题、原名、用途、分类、作者、场景、标签、agents、详情地址），第一次打开面板时动态 import，不进任何页面的首屏 JS（部署后旧标签页的数据块 404 时，生产环境退回读 `/data/index.json`）；它和 `prompts.data`、`skills.data` 一样用 `promptsWatch` / `skillsWatch` 监听，开发时改了条目会刷新。`sync-assets.mjs` 生成两份 slug 清单，`functions/{prompts,skills}/[slug].ts` 各按自己的清单处理下架地址。

## 构建与部署

- 本地：`npm run dev`（只有页面）、`npm run dev:full`（页面 + 计数接口 + 本地 D1）
- PR：GitHub Actions `.github/workflows/ci.yml`，跑 validate、test、build，不带密钥
- 上线：Cloudflare Pages 的 Git 集成，main 有新提交就自动构建部署。构建命令 `npm run build`，输出 `site/.vitepress/dist`，绑定以 `wrangler.toml` 为准
- 产物根目录还包含 sitemap.xml（页面索引）、catalog.json（结构化 Bot 数据）、llms.txt（分组目录及引用说明）、data/（给 AI 用的 Prompt、Skill、Bot 索引和每条完整数据）和 skill/bot-zhipin/（skill 文件，可直接下载）。
- **不要**在构建产物里放 `_worker.js`：有它时 Pages 会忽略 `functions/`

## 约定

- 面向用户的文案一律简体中文。
- **构建不联网**：真脸抓取是维护者独立操作，npm run build 不调用 sync-faces；页面静态导入 faces.json，不在运行时拉脸数据。抓取失败保留旧条目并警告，无数据用原 seed 算法。
- 活体/真脸/彩色模块的接口与状态标记见 INTERACTION（现为 v5）；版式和视觉规格也在那里，改样式前先读。
- **导航条不另写组件**：悬浮玻璃导航条是给 VitePress 默认顶栏（`.VPNavBar`）换肤，汉堡菜单、主题开关、社交链接都是默认主题的。默认主题的 scoped 样式特异性高，覆盖规则统一写成 `.Layout .VPNav …` 前缀；背景色通过 `--vp-nav-bg-color` 变量给，不和它的 `:not()` 选择器拼特异性。
- **文字的祖先不放背景图**：球池的光晕、柔光、悬停层都在独立元素或伪元素里，这样对比度可以按纯色底算（验收脚本会沿祖先链检查）。
- **版式跟着容器走**：列表卡用 `@container` 按卡片自身宽度切换宽/窄版式，所以同一张卡放进 /submit 的窄预览栏不用另写样式。
- 页面路径：首页 `/`，详情页 `/bots/<slug>`，小队页 `/squads/<slug>`（小队可以和 Bot 同名，路由不同）。
- **小队和策展放在哪**：默认是仓库里的 `squads/` 和 `curation/shelf.yaml`。规则是「跟着 Bot 目录取兄弟目录」：`<Bot 目录的上级>/squads`、`<上级>/curation/shelf.yaml`，所以只设 `BOTS_DIR=tests/fixtures/bots` 就会一起用 fixtures 的小队和策展；要单独指定用环境变量 `SQUADS_DIR`、`CURATION_FILE`。目录或文件不存在就当空，不报错。
- **引用必须落在货架上**：小队成员、策展里的 slug 都要是货架上的 Bot，`npm run validate` 会拦；下架一个被引用的 Bot 要同时改小队和策展。网站构建时再兜一层底：对不上的那一项丢掉并打印警告，成员不到 2 个的小队不出页面。
- **分组**：字段名是 `category`，界面和文档里叫「分组」，意思是「这个 Bot 干的是哪一行」。一共 9 个：产品、市场、销售、内容、运营、学习、求职、管家、生活（决策 38）。取值和顺序只在 `schema/bot.schema.json`；颜色和吉祥物在 `theme/color.ts`，一句说明在 `meta.mjs` 的 `CATEGORY_COPY`，单测保证它们和枚举一个不多、一个不少。
- **Bot 的名字**：`name` 是原名（和 x.ai 模板页上的一致，不翻译），`nameZh` 是可选的中文叫法（决策 41）。写了中文叫法的，全站以它称呼这个 Bot，原名跟在后面；排序、读屏、网页标题也按它来；搜索两个名字都认。规矩在 `scripts/lib/bot-name.mjs`，显示规格在 `INTERACTION.md` §3.4。新写页面时不要直接输出 `bot.name`，用 `BotName.vue` 或 `displayName()`。
- **开发热更新**：`bot-watch.mjs` 同时监听 Bot 目录、小队目录和策展文件，哪一处变了都重启 dev server 刷新数据和动态路由。
- 图片引用：`/bot-assets/<slug>/<文件名>`。
- 不复制原站（fork 来源）的任何文字、图片和组件代码。

## Issue 表单投稿（S2）

```text
AI 的本地 Bot 目录
  └─ scripts/make-submission-link.mjs（临时副本校验）
       └─ 预填 Issue 链接（过长时给明文投稿包）
            └─ 投稿人登录 GitHub → 勾 CC BY 4.0 → 提交（2026-11-15 起表单不再有截图栏，DECISIONS 第 43 条）
                 └─ .github/workflows/submission.yml（默认分支的可信代码）
                      ├─ 不通过：编辑/新发一条中文诊断评论
                      └─ 通过：submission/issue-<号>，默认分支之上的一个提交
                           └─ 创建/更新 PR → workflow_dispatch 派发 ci.yml
                                └─ validate-and-build → 人工批准 → 合并上线
```

### 代码分层

- `scripts/submission/bundle.mjs`：纯文本容器 `pack({ slug, files, screenshots })` / `unpack(text)`（`pack` 总写一个 screenshots 段，`unpack` 允许省略这一段，按零张处理，第 43 条）；`files` 的键是完整的 `bots/<slug>/...` 相对路径。`encode(text)` / `decode(token)` 在明文与 `BZB1:` + base64url(gzip) 之间转换，保留文本原有换行和中文。每个文本段尾多一个容器换行；正文不能使用独占一行的 `=== ... ===` 保留分隔符。
- `scripts/make-submission-link.mjs`：只读取文本；投稿包的 `screenshots` 段永远为空（第 43 条），本地 `screenshots/` 里有图也不进包，输出里提示「不会上传」。先在临时目录叠加默认 bots 数据进行 `validateBots` 校验，校验看到的就是网站会看到的样子：设计说明引用了本地截图会报「图片引用」。截图、头像二进制均不进包；头像会提示省略，改用网站默认头像。支持位置参数和 `--dir`。URL 长度超过 7500 就输出不含 bundle 的表单链接与完整明文。
- `scripts/submission/issue.mjs`：固定字段解析（不把代码围栏内的标题当表单标题）、授权与作者校验、slug 占用/addedAt 检查、提交及 PR 元数据生成，均为纯函数。
- `scripts/submission/screenshots.mjs`：只服务旧 Issue 表单的截图栏（新表单没有这一栏，提取结果为空时直接跳过）。Markdown / HTML 图片提取、受限下载；按文件头决定扩展名，生成文件计划并修正对应的简单本地 Markdown 图片引用。多出来的图片使用 `screenshot-<序号>.<ext>`；缺少已声明的图片或命名冲突会报错，不静默覆盖。
- `scripts/submission/from-issue.mjs`：注入适配器的流程编排。校验器及单 slug 范围检查均成功之前，不建分支、不创建 PR。
- `scripts/submission/adapters.mjs`：默认分支签出目录的文件系统操作、`validateBots`、git / gh 参数数组适配器。测试替换命令和 fetch，不联系 GitHub。
- `scripts/submission/errors.mjs`：统一中文「文件 / 位置 / 问题 / 改法」诊断，脱敏、代码块隔离和长度限制。只编辑 `github-actions[bot]` 发布且带 `<!-- bot-zhipin-submission -->` 的评论，不信任人类复制的标记。

### 工作流与发布

`submission.yml` 只处理带「投稿」标签、仍然 open 的 opened / edited / reopened 事件；同一个 Issue 的旧运行会被取消。签出仓库默认分支（完整历史），只安装生产依赖，Issue 正文、作者 login/id、编号都通过 env 传给 Node，不插入 shell。新增仅写一个 Bot 目录；更新需作者一致且原 addedAt 不变，才清空旧目录后重写。校验覆盖整个 bots 集合，可发现重复模板链接等跨 Bot 问题；范围检查覆盖删除、修改和未跟踪文件，并比普通贡献者规则更严格：只许本次 slug。

分支固定为 `submission/issue-<号>`，每次从本次签出的默认分支提交重建一个提交并 force push；只覆盖工作流独占分支。作者使用 Issue login 与 `<id>+<login>@users.noreply.github.com`，提交者使用 Actions bot，不改 git config。PR 绑定来源 Issue 并含 `Closes #<号>`；自动化只勾选能证实的校验/授权项，「实际效果」摘录的真实性、隐私和模板页匿名可访问仍需维护者复核。

GITHUB_TOKEN 创建的 PR 不会触发普通 PR 事件，因此显式执行 `gh workflow run ci.yml --repo <本仓库> --ref submission/issue-<号>`。CI 的 `validate-and-build` 跑在该分支 head 上，保留只读权限和两层历史；手动派发按 CONTRIBUTOR 严格检查范围。错误评论可随 Issue 编辑重试更新；发布后派发失败也不会误报成功，但先前已创建的分支/PR 可能保留，下次运行复用。

### 安全与运维边界

- 解包只接受同一个合法 slug 下的普通相对路径，拒绝绝对路径、反斜杠、`..`、隐藏段、大小写重名和文件/目录冲突；每段最长 255 字符、全路径最长 1024。文本扩展名白名单为 `.yaml .yml .md .txt .json`，不执行任何投稿内容。
- 最多 30 个文件（含截图），单文本最多 100KB、文本总量最多 400KB；gzip 输出由 zlib 的 `maxOutputLength` 硬限 512KB。只接收有效 UTF-8，不接受 NUL。写入前检查目录树，拒绝符号链接/特殊文件；运行开始要求干净签出目录。
- （旧表单兼容）初始截图地址必须在 `https://github.com/user-attachments/assets/`，每一跳在请求前检查 HTTPS 和主机（`github.com` 或 `*.githubusercontent.com`），最多五次重定向；不发送身份凭据。整张图片含重定向/读流共 20 秒，按声明和实际流量双重限制 2MB，并验证文件头，不能靠改后缀伪装。
- 写权限只供可信默认分支脚本建立受限 Bot 提交/PR/评论及派发 CI；无需用户令牌。仍依赖人工批准和分支保护，不自动合并。图片头校验不能证明截图真实性、无隐私或完整可解码，自动校验不是内容审核。
- 上线前维护者需确认「投稿」标签已存在、Actions 允许创建 PR，且这两个工作流已在默认分支；本任务不创建标签或操作真实 GitHub。新增标签本身不触发处理，之后需编辑或重新打开 Issue。
- 本轮按契约保留 CI 原有 concurrency 配置：手动派发没有 PR number，多个不同分支的手动 CI 仍可能互相取消；联调需验证并安排必要的重派发，后续单独调整分组。Issue 的原生正文/URL 限制也可能比包格式更小，特别大的明文包需先缩减内容。
- 校验失败不更新已有 PR，所以旧 PR 可能仍存在；维护者合并前要核对 Issue 最新评论与最新 head 的检查。并发不同 Issue 使用同一 slug 也需在审核/合并阶段复核，默认分支上已被他人占用时下一次处理会拒绝覆盖。

验证：`tests/unit/submission.test.mjs` 在临时目录测试完整链路，网络和 git/gh 都是假适配器；真实 GitHub 的预填、附件 CDN、令牌权限和保护分支检查关联仍需维护者联调。

## 网站直投（S3）

接口、cookie、回执、限流、错误码以 [`SUBMIT.md`](SUBMIT.md) 为准；页面状态和文案以 [`INTERACTION-SUBMIT.md`](INTERACTION-SUBMIT.md) 为准。

```text
AI：make-submission-link → https://bot.jiachengbo.com/submit#BZB1:…
 /submit（浏览器）：解包 → 预览卡片和详情页 → 校验内核即时报错
   → 用 GitHub 登录（/api/auth/*，零 scope OAuth App，取完身份即撤销令牌）
   →（2026-11-15 起不再上传截图，DECISIONS 第 43 条；/api/submit/screenshot 保留只为兼容旧页面）
   → 提交（/api/submit：服务端重新校验和密钥扫描 → 改写 author.github、addedAt
        → GitHub App 在 submission/web-<id>-<slug> 建单提交 → 建或更新 PR → 开启自动合并）
 pull_request CI（validate-and-build）→ 维护者 Approve → 自动合并
 push main → announce-live：等 build.json 到达本次合并提交 → 评论「已上线」→ 删投稿分支
```

### 代码分层

| 位置 | 职责 |
|---|---|
| `scripts/lib/bot-model.mjs`、`scripts/lib/validate/core.mjs` 等纯内核 | 不读盘、不依赖 node，CLI、浏览器、Function 共用；`load-bots.mjs` 和 `validate/index.mjs` 是 Node 适配器 |
| `scripts/lib/validate/generated/bot-schema.mjs` | Ajv standalone 预编译结果（`npm run gen:schema` 生成，提交进仓库）。小队和策展的两份（`squad-schema.mjs`、`curation-schema.mjs`）只在 Node 里用，不进浏览器和 Function 的包 |
| `scripts/lib/submit-fields.mjs` | `applyServerFields`：只改写 author 和 addedAt 两段原文 |
| `scripts/sync-assets.mjs` | 构建时另生成 `/api-data/submit-context.json`（已上架索引、模板原文、说明文案、限额）和 `/api-data/build.json` |
| `site/.vitepress/theme/submit/` | 投稿页的浏览器端逻辑；`site/submit.md` 和 `Submit*.vue` 是界面 |
| `functions/api/auth/*` | 登录、回调、me、退出 |
| `functions/api/submit/*` | 提交、状态；截图上传接口只为兼容旧页面保留 |
| `functions/_lib/github.ts` | 只暴露固定的几个 GitHub 操作，内部检查 URL 白名单和分支名，不导出通用请求方法 |
| `.github/workflows/announce-live.yml` | 上线通知 |

### 安全边界

- 投稿始终是数据：Markdown 用 `html:false` 渲染，外链图片只显示成链接，预览里没通过 schema 的字段不进任何链接。
- 校验和密钥扫描在任何 GitHub 写操作之前完成；tree 只放 `bots/<slug>/`，mode 只有 100644 和 040000。
- 会话 cookie `__Host-bz_s`：HttpOnly、Secure、SameSite=Strict，2 小时；写接口校验同源，只收 JSON 或图片类型，不发 CORS 头。
- D1 限流：按人、按 IP、全站三层；每人同时最多 3 个未合并的网站投稿 PR。
- 规则集：保留推送后旧批准作废、要求代码所有者批准；App 不在绕过名单。
