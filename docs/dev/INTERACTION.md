# 交互与视觉规格（v5：设计系统 + Raycast 版式 + Grok 灵动）

累计规格的真源为 2026-11-14 已批准计划及 LB1、LB2、LB3、LB4、LB6、2026-11-15 LB8、LB9 契约，以及 2026-11-15 的 V5-DESIGN 契约；冲突以 V5-DESIGN 为准。v4 把首页和详情页整体换成「Raycast Store 的结构和质感 + Grok Bot 的灵动和颜色」（决策 31）；v5 在这个方向上补一套成体系的设计系统：token 阶梯、基础部件、中性的界面（决策 36）。活体头像、真脸、互动行为（LB1–LB3、LB6）不变。验收容差由批次目录 `verify/` 的脚本定义。

**v5 分批落地**：第一批是设计系统（§0、§1、§1b）、导航条和首屏（§2.1、§2.2）、首页区块和卡片（§2.3–§2.5、§3）、详情页（§9）、404 和空状态（§10）。第二批也已落地：首页的 9 个分组、专题和主推的编辑点评（§2.3–§2.5、§3.2、§7、§10），详情页两栏和 Bot 介绍加厚（§9），小队（§14）。本文这些小节写的就是现在的实现。

**界面上不放解释性的句子**（用户 2026-11-15 定，决策 37）：区块只有标题和数据，没有说明、提示、引导语；功能靠设计表达，按钮一律「图标 + 动词」，卡片整张可点进详情。详见 §0 第 6 条。

实测的 Raycast Store 规格只用来对齐结构、尺寸和质感；不复制它的代码、图标、文案和红色光束背景。

## 0. 原则

1. **界面是中性的，颜色只来自 Bot**：页面是一家干净、有层次的商店（细边、内高光、玻璃、大留白）。按钮、标签、筛选、边框都是黑白灰；彩色只出现在 Bot 身体、砖底的柔光、悬停时透出来的 Bot 色、按钮的淡染。这样彩色才显眼。首屏是一池五颜六色、会动的真 Bot（球池，§2.2）。货架保持官方色，不给灰色 Bot 换色（决策 30）。深色是主打。
   - **每个数都落在阶梯上**：字号、间距、圆角只用 §1 的取值。任意两个相邻元素的间距都要说得出是阶梯上的哪一档。
   - **先让人看懂它干什么**：信息比装饰重要，卡片和详情页宁可多一行有用的字，不留一块没用的空白。
   - 交付前每页过一遍自检四问：缩到 25% 看层级还清楚吗；灰度下主次分得清吗；和 Raycast 截图并排哪边更像成品；颜色是不是一眼够多（来自 Bot，而不是来自按钮）。
2. **Bot 是活的**：呼吸、眨眼、视线漂移；全卡悬停有反应，首屏球池、主推卡也能互动。变形只作短暂彩蛋，常驻反应优先保留自身轮廓。
3. **真脸**：读取官方公开的颜色和形状名；复用 MIT bloub 或原创轮廓，不复制 x.ai 路径、眼睛坐标或代码。
4. **文字背后是纯色**：所有装饰光效（球池的光晕、砖里的柔光、卡片悬停层、详情页光晕）都放在独立的装饰元素或伪元素里，文字的祖先元素自己不放 `background-image`。名字、介绍、作者、热度、标签、筛选、排序、计数、按钮文字在两个主题下对比度都 ≥ 4.5。
5. **可用性底线不降**：键盘、触摸、读屏、焦点、对比度、减少动效全部保留；全页只开一个气泡，气泡不压头像和按钮。字体不联网，新增 token 统一 `--bz-`。按钮高 36px（触摸 44px）；触摸目标 ≥ 44px；320–1440 任何宽度不横向滚动。
6. **界面上不放解释性的句子，功能靠动线和直觉表达**（决策 37）。
   - 不显示：副标题、区块说明、页尾引导语、额度和权限后面的说明句、来源说明、「暂无……」这类空提示、404 的说明句。没有内容的区块整块不渲染。
   - 照常显示：Bot 自己的内容（名字、一句话介绍、导入前准备、台词）；属性数据（额度、要不要连账号、会不会自己跑、热度、计数）；状态反馈（已复制、筛选为空的一句话）；`/submit` 的全部文字和流程（含投稿预览里「还缺什么」的提示）。
   - 有用的解释（额度档位、每项权限的含义）放 `title` 悬停提示和读屏文本（`.bz-sr-only`），不直接显示。
   - 按钮一律「图标 + 动词」（`BzIcon`）：导入、一键导入（`arrow-up-right`）、我要投稿（`plus`）、返回货架（`arrow-left`）、复制安装提示词（`copy`，复制后变 `check`）。每个按钮不靠旁边的句子也要看得懂。
   - 列表卡和主推卡整张可点进详情（§3.2）。主次靠位置和样式区分：一屏只有一个实心主按钮。
   - 要加界面文案，先问用户。

### Prompt / Skills：找条目、判定授权、复制或去出处

- Skill 详情在安装之后、运行依赖之前显示 1～3 个作者示例，没有则整节隐藏。块间距 24px，以中文 caption 起头；请求靠右、分类淡底、宽至多 88%（820px 以下 100%）；文字在左自然换行，复制按钮贴右上、与第一行顶对齐，不另占一行。手机布局相同，单行气泡只占一行文字加内边距的高度；产出用纸面，节选在右上角标明。请求超过 6 行、产出超过 8 行才可展开、收起。英文默认读和复制译文，用「英文原文」披露原文。请求或产出只有独占一行的斜杠命令时无需译文，直接显示和复制原文；含其他文字仍须提供译文。图片从 `/media/skills/` 加载，满宽、预留尺寸、懒加载，原图、视频和示例文件均在新标签打开；块末列出处链接与版权原话。

- 「Bot / Prompt / Skills」是品牌后的普通链接，详情与所属库共用唯一 `aria-current`。手机只折叠工具，不藏三个入口；320–359px 保留站标和可访问名。
- 左栏刊头依次放库名、总数、48px 搜索框和按 schema 顺序的分类列表。只省略整库没有的类；查询使计数降到 0 时分类仍可点。先按 NFKC、trim、小写和空白分词（汉字和两个字符以上的英文、数字段交界处也断开，「做PPT」等于「做 PPT」；单个字母不断开，「B站」整个比，也认「B 站」）匹配标题、原名、类、用途、场景、标签、作者和 agents（每词命中任一字段即可），再交当前类；计数是可见卡数。IME 组合结束后生效。按日期倒序、同日按 slug 的 FNV-1a 32 位散列升序，无排序开关。
- `q` 和 `cat` 用 replaceState，详情和返回链接带有效条件；清空恢复裸列表。桌面搜索框共用 `/` 键帽；不在输入、菜单、面板或 IME 中时，`/` 聚焦本库搜索。Esc 只清词；⌘K 仍开全站搜索。未命中在条目区显示搜索砖和空态，「看看全部」清条件并还焦。
- 1280px 时版心 1140px：280px 刊头、100px 间距、760px 内容。条目不装框，48px 分类砖、标题和一句用途、行尾作者（Prompt 和 Skills 均显示作者名）；每行上下留 28px，发丝线从文字列开始，行高随内容。Skills 整行可进详情；Prompt 的「仅摘要」描边标签保留独立原文外链。分类用同色吉祥物砖；选类和详情才在左上角加淡色光（浅 12%、深 13%），全部时透明。
- Prompt 标题进详情，正文可以选词。有效果图时，第一张缩略图也链到相同详情：≥820px 在正文右侧，宽 168px、最高 168px；窄屏在正文下方，占满宽、最高 220px。缩略图 cover 裁切；没有图的条目不预留位置。用途下默认露出四行，超出才显示「展开」，也可原地收起；【】和 {} 占位符用分类色标出。标题右侧直接复制完整纯文本，有 `bodyZh` 优先用译文，库内搜索也匹配这份正文。手机复制按钮只显示图标；仅摘要条目不放正文和复制按钮。
- 820–1023px 缩为 232px 刊头、56px 间距。小于 820px 刊头在上，分类横滑，24px 页边、40px 行砖、上下留 24px。详情桌面左栏粘住返回、96px 砖、动作和属性，右栏读内容；手机依次返回、96px 砖、标题、动作、正文、属性。有适用模型的 Prompt 在作者前显示「能用在」，模型用顿号连接。正文前的「效果图」仅在有图时显示，原图取自 `/media/prompts/`：最高 560px，宽度随原比例自适应，居中不裁切，边框贴合图片；点击新标签打开原图，每张下方以小号三级灰标署名和许可。效果图与缩略图均为 12px 圆角、细边，延迟加载且标注真实宽高与中文替代文字。许可证值下只在有数据时显示小号三级灰原版权行。仅摘要以虚线框替代正文，有原文外链，无复制；Skill 先安装和依赖，不展示全文。
- 正文与命令保留空白、软折行；复制原字段字符串。每个按钮独立反馈、播报，1800ms 后复原；失败选中原文并显示「未复制」。样式见 `styles/library.css`，复用 §1b 的部件。

## 1. 设计 token 与配色

浅色写在 `:root`，深色写在 `.dark`；主题跟随系统（`appearance: true`）。**深色是主打**，浅色用同一套结构换一组暖色 token。颜色混合一律用 `color-mix(in srgb, …)`。

| token | 浅色 | 深色 |
|---|---|---|
| `--bz-page` / `--vp-c-bg` | `#f6f5f1` | `#07080a` |
| `--bz-card` / `--bz-paper` | `#ffffff` | `#0c0d0f`（气泡、搜索框、面板、键帽等需要实底的地方用） |
| `--bz-eye` | `#16161b` | `#16161b`（恒定，不随主题切换） |
| `--bz-ink` | `#141418` | `#ffffff` |
| `--bz-ink-hover` | `#2c2c33` | `#e4e4e7` |
| `--bz-text-2` | `#4a4a52` | `#9c9c9d` |
| `--bz-text-3` | `#62626b` | `#8b8c8f`（Raycast 的 `#6a6b6c` 对比度不够，不用） |
| `--bz-border` | `#e6e2d9` | `rgba(255,255,255,.08)` |
| `--bz-hairline`（细边） | `rgba(20,20,24,.08)` | `rgba(255,255,255,.06)` |
| `--bz-highlight`（内高光） | `inset 0 1px 0 rgba(255,255,255,.7)` | `inset 0 1px 0 rgba(255,255,255,.05)` |
| `--bz-glass`（玻璃底） | `rgba(255,255,255,.7)` | `rgba(255,255,255,.04)` |
| `--bz-surface-soft` | `#efede7` | `#17181b` |
| `--bz-flame` | `#f97316` | `#fb923c` |
| `--bz-success`（保留） | `#16a34a` | `#4ade80` |
| `--bz-quota-low/mid/high`（保留） | `#15803d` / `#b45309` / `#b91c1c` | `#4ade80` / `#fbbf24` / `#f87171` |

- `--bz-radius-card` 现在是 `--bz-r-card`（12px）的别名。`--bz-shadow-card`、`--bz-shadow-float` 只给浮层用（搜索面板、手机菜单、弹窗）；**卡片不用投影**，靠细边 + 内高光分层。气泡保留漫画式的硬投影。
- `--bz-shadow-hover` 为 Bot 染色阴影（保留给 /submit），颜色用 `color-mix(in srgb, var(--bz-bot-color) 55%, transparent)`。
- `--bz-ease-spring: cubic-bezier(.34,1.56,.64,1)`；旧 `--bz-ease-pop` 继续可用。
- `--bz-font-display: ui-rounded, "SF Pro Rounded", "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", system-ui, sans-serif`：**只用于**站名、各级标题、卡片上的 Bot 名、气泡台词。`--bz-font-text: system-ui, -apple-system, "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", sans-serif`：其余全部（正文、按钮、标签、筛选、元信息）；VitePress 的 `--vp-font-family-base` 也指向它。按钮和标签不再用圆体。不加载网络字体或外部样式。
- 兼容 /submit：不得删除或改名 `--bz-ink`、`--bz-ink-hover`、`--bz-paper`、`--bz-card`、`--bz-border`、`--bz-text-2`、`--bz-text-3`、`--bz-surface-soft`、`--bz-success`、`--bz-quota-*`、`--bz-radius-card`、`--bz-shadow-hover`、`--bz-font-display`、`--bz-ease-spring`、`--bz-ease-pop`。额度背景仍用同色 12% 混合。
- 只在 `theme/styles/` 内部使用的派生量（`--bz-card-bg`、`--bz-tile-*`、`--bz-pit-*`、`--bz-nav-*`、`--bz-seg-*`、`--bz-hover-*`、`--bz-featured-glow`、`--bz-btn-fill*`、`--bz-btn-edge*`）不算对外 token，可以随视觉调整。
- Grok 调色板：橙 `#ff6a13`、紫 `#8b5cf6`、青绿 `#14b8a6`、琥珀 `#f5a623`、棕 `#9a6a3a`、粉 `#ff2e93`、薄荷绿 `#34d399`、蓝 `#3b82f6`、玫红 `#f43f5e`。

`theme/color.ts` 是纯函数配色层：

| 接口 | 规则 |
|---|---|
| `contrast(a, b)` | WCAG 对比度 |
| `darkSwap(hex)` | 相对亮度 L < 0.04 时换 `#f1efe9`，否则原色；返回小写 |
| `buttonColors(hex)` | fg 从 `#ffffff`、`#141418` 选对比度较高者；仍 < 4.5 时，白字的 bg 每次向黑混 4%，深字的 bg 每次向白混 4%，直到 ≥ 4.5；返回小写 hex `{ bg, fg }` |
| `botPalette(hex)` | 返回 `--bz-bot-light`、`--bz-bot-dark`、`--bz-btn-bg-light`、`--bz-btn-fg-light`、`--bz-btn-bg-dark`、`--bz-btn-fg-dark`；dark 按 darkSwap 后的颜色计算 |

列表卡 article、主推卡、详情页根节点和头部、球池里的每只 Bot、404 页均加 `bz-bot-scope` 并绑定 `botPalette`。CSS 将 `--bz-bot-color` 指向 light 或 dark 组，不用 JS 监听主题；同一个范围里还会把次级按钮的底和边（`--bz-btn-fill`、`--bz-btn-edge` 及悬停值）换成染了这只 Bot 颜色的版本。`--bz-btn-bg`、`--bz-btn-fg`（Bot 色实底按钮）v5 不再使用，变量留着。货架颜色来自 `avatarColor(slug)`，自定义头像用中性灰 `#8a8a93`；球池里的 Bot 就是货架上的 Bot，颜色同样来自 `avatarColor(slug)`。

**眼睛**：所有活体用恒定深色眼睛 `--bz-eye`。唯一例外是官方色近乎纯黑的 Bot（`darkSwap` 会换色的那些，L < 0.04）：浅色主题下身体是黑的，黑眼睛看不见，`DefaultAvatar` 给它加 `bz-live-ink` 类，CSS 把 `--bz-eye` 换成奶白 `#f1efe9`；深色主题下身体已换成奶白，眼睛照旧是深色（决策 32）。

分组映射唯一位于 `theme/color.ts` 的 `CATEGORY_MASCOTS`（`CATEGORY_COLORS` 由它派生）：产品橙 `#ff6a13` blob、市场粉 `#ff2e93` sparkle、销售青绿 `#14b8a6` star、内容紫 `#8b5cf6` tablet、运营琥珀 `#f5a623` hex、学习棕 `#9a6a3a` pebble、求职玫红 `#f43f5e` heart、管家蓝 `#3b82f6` cloud、生活薄荷绿 `#34d399` teardrop，每只和 `meta.mjs` 的 `HERO_MASCOTS` 里对应那只同色同形，9 个分组正好用完这 9 只（决策 38；这 9 只原先站在首屏的砖墙上，首屏换成球池后只出现在组头和标签页图标里）。分组名来自现有 Bot 数据，schema 仍是合法枚举真源；单测验证映射完整覆盖枚举。`categoryStyle(category)` 仅提供 `--bz-category-color`，分组标签和筛选胶囊的小圆点共用；未知分组回退中性灰。分组的**顺序**由 `theme/enums.data.mjs`（构建时 `loadEnums()`）给到浏览器，不在页面代码里另写一份。

### 1.1 v5 阶梯（写在 `theme/styles/tokens.css` 最前面）

**字号（只许用这 8 档）**

| token | 字号 | 行高 | 字重 | 用在哪 |
|---|---|---|---|---|
| `--bz-fs-display` | `clamp(44px, 5.6vw, 72px)` | 1.05 | 700 | 首屏站名 |
| `--bz-fs-h1` | 32px（<680px 28px） | 1.15 | 700 | 详情页、小队页的名字，404 标题 |
| `--bz-fs-h2` | 24px（<680px 22px） | 1.25 | 650 | 首页各区块标题 |
| `--bz-fs-h3` | 20px（<680px 18px） | 1.3 | 600 | 详情页区块标题、分组组头 |
| `--bz-fs-title` | 16px | 1.35 | 600 | 卡片上的 Bot 名、小标题、导航条站名 |
| `--bz-fs-body` | 15px | 1.6 | 400 | 正文、介绍（`.shelf-page` 的默认字号） |
| `--bz-fs-sm` | 13px | 1.5 | 400（强调 500） | 元信息、说明、小号按钮、分段控件 |
| `--bz-fs-xs` | 12px | 1.3 | 600 | 标签、键帽、计数 |

行高有同名的 `--bz-lh-*`。唯一例外是 14px（`--bz-fs-btn`）：只给按钮文字和气泡台词。中英文混排的标题加 `letter-spacing: -0.01em`（首屏站名 −0.02em）。新写的界面可以直接挂工具类 `.bz-h1`、`.bz-h2`、`.bz-h3`、`.bz-title`、`.bz-body`、`.bz-sm`、`.bz-xs`（字号、行高、字重一次给齐，前四个带圆体），颜色用 `.bz-muted`（`--bz-text-2`）、`.bz-faint`（`--bz-text-3`）。

**间距**：4、8、12、16、24、32、48、64、96，对应 `--bz-sp-1` … `--bz-sp-9`。首页区块之间用 `--bz-sp-section`（96，<680px 64）；区块标题到内容 24；标题到它的说明 4；网格间距 16；列表卡内边距 20×24；面板内边距 24。按钮左右 14、图标和文字间距 6 是部件自己的数，不算破例。

**圆角（三档）**：`--bz-r-control: 8px`（按钮、筛选、输入、标签、键帽）；`--bz-r-card: 12px`（卡片、搜索框、面板、气泡）；`--bz-r-panel: 16px`（导航条、弹层、小队大卡、详情页舞台面板）。两个例外：头像砖用比例圆角 `--bz-r-tile: 24%`；分段控件是唯一的胶囊（`--bz-r-pill`）。其他地方不许出现 999px。圆点、圆头像这类正圆不算。

**颜色角色**（深色 / 浅色）

| token | 深色 | 浅色 | 用在哪 |
|---|---|---|---|
| `--bz-surface-1` | 透明 | `#ffffff` | 卡片底 |
| `--bz-surface-2` | `rgba(255,255,255,.04)` | `rgba(20,20,24,.03)` | 玻璃、输入、中性标签、头像砖 |
| `--bz-surface-3` | `rgba(255,255,255,.07)` | `rgba(20,20,24,.06)` | 悬停 |
| `--bz-border-strong` | `rgba(255,255,255,.14)` | `rgba(20,20,24,.16)` | 按钮边、搜索框边、虚线框 |
| `--bz-border-hover` | `rgba(255,255,255,.26)` | `rgba(20,20,24,.3)` | 上面这些悬停时 |
| `--bz-primary-bg` / `-hover` / `--bz-primary-fg` | `#ffffff` / `#ebebeb` / `#0b0b0d` | `--bz-ink` / `--bz-ink-hover` / `#ffffff` | 实心按钮 |
| `--bz-source-community` / `--bz-source-author` | `#34d399` / `#ff6a13` | 同左 | 来源标签 |

实底 `--bz-card`（气泡、面板、搜索框）、细边 `--bz-hairline`、字三级 `--bz-ink` / `--bz-text-2` / `--bz-text-3` 沿用上表。Bot 色 `--bz-bot-color` 只出现在：身体、砖底柔光、卡片悬停层、按钮的淡染、列表圆点、连线高亮。

**动效**：`--bz-dur-fast: 120ms`、`--bz-dur: 180ms`、`--bz-dur-slow: 280ms`；`--bz-ease: cubic-bezier(.2,.8,.2,1)`；弹簧沿用 `--bz-ease-spring`。悬停只做淡入和染色，卡片不位移、不缩放。`prefers-reduced-motion: reduce` 时循环动画全部静止。

**层次**：卡片不用投影，靠细边 + 内高光分层；只有浮层（搜索面板、手机菜单、弹窗、气泡）有投影。

### 1.2 样式表怎么分

`theme/styles/` 下八个文件，`theme/index.ts` 按这个顺序引入；改哪一块就只动那一个文件：

| 文件 | 管什么 |
|---|---|
| `tokens.css` | 全部 token、`.bz-bot-scope` 的 Bot 色、活体头像的身体色和眼睛 |
| `base.css` | 页面骨架 `.shelf-page`、文字档位工具类、焦点、图标、§1b 的全部基础部件、头像按钮和跳动、气泡 |
| `nav.css` | 悬浮导航条和手机菜单 |
| `hero.css` | 首屏球池（站名、Bot、地板、名片）和搜索框本身 |
| `home.css` | 首页区块、主推卡、专题、工具栏、分组、筛选条、列表卡、页尾；静止小 Bot（`StaticBot`）的样式 |
| `detail.css` | Bot 详情页 |
| `squad.css` | 小队：静态小 Bot、合影、首页的小队区块、小队详情页、流程图（§14） |
| `misc.css` | 手动复制弹窗、空状态、404、投稿预览对卡片和详情的修正 |

## 1b. 基础部件（全站共用，类名固定）

都在 `theme/styles/base.css`。新界面直接用这些类，不要另写一套按钮或标签。

**按钮 `.bz-btn`**：高 36px（触摸设备 44px），左右内边距 14px，圆角 8，14px/600，系统字体，图标 16px、和文字间距 6（按钮是 `inline-flex`，把 `<BzIcon>` 和文字并排放进去就行）。

| 写法 | 样子 | 用在哪 |
|---|---|---|
| `.bz-btn` | 次级，玻璃：底 `--bz-surface-2`、边 `--bz-border-strong`、内高光、字 `--bz-ink`；悬停底 `--bz-surface-3`、边 `--bz-border-hover`。放进 `.bz-bot-scope` 就染上这只 Bot 的颜色：底 Bot 色 10% 混 `--bz-surface-2`、边 Bot 色 34% 混 `--bz-border-strong`，悬停 18% / 60%。字始终是墨色，灰白黑的 Bot 也不会像禁用 | 默认都用它 |
| `.bz-btn.primary` | 实心：深色主题白底 `#ffffff` 配 `#0b0b0d` 字，浅色主题 `--bz-ink` 底配白字；悬停深色压到 `#ebebeb`、浅色换 `--bz-ink-hover`；按下 `scale(.98)` | **一屏最多一个**：详情页的「一键导入」、小队页的「开始组队」 |
| `.bz-btn.ghost` | 无边无底，字 `--bz-text-2`；悬停底 `--bz-surface-3`、字 `--bz-ink` | 「返回货架」「展开其余 N 个」「清除」 |
| `.bz-btn.sm` | 高 32、左右 12、13px；可以和上面三种叠用 | 卡片里的「导入」 |
| `.bz-btn.block` | 撑满一行 | 侧栏、窄卡片 |

状态：`.copied`（字和边变 `--bz-success`）；`aria-disabled="true"` 或 `disabled` 时不透明度 0.45。Bot 色实底按钮全部取消（决策 36）。`.shelf-button` 是 `.bz-btn` 的别名，只留给 /submit 和还没迁移的组件，新代码不要用。

**标签 `.bz-tag`**：高 22、左右 8、圆角 8、12px/600、系统字体。

| 写法 | 样子 |
|---|---|
| `.bz-tag` | 中性款：底 `--bz-surface-2`、字 `--bz-text-2` |
| `.bz-tag.role` | 分组款：读元素上的 `--bz-category-color`（`color.ts` 的 `categoryStyle(分组)` 给），底是分组色 14% 混 `--bz-card`，字是分组色 40% 混 `--bz-ink`。标签里文字前面放一只 12px 的分组吉祥物：`<RoleMascot :category="分组" :size="12" />`（静止，和首屏砖墙里对应那只同色同形；不认识的分组不画） |
| `.bz-tag.community` / `.bz-tag.author` | 来源款「社区收录」（薄荷绿 `#34d399`）/「作者投稿」（橙 `#ff6a13`），同样的混法 |
| `.bz-tag.solid` | 实心小标签（墨底），给「队长」这类 |

「官方市场」不做标签，写进作者行：`by Anoop Baliga · 官方市场`。旧类名 `.bot-tag`、`.category-tag` 仍然有效（别名）。

**Bot 的名字 `BotName.vue`**：凡是要写 Bot 名字的地方都用它（`<BotName :bot="bot" />`），不要直接写 `bot.name`。写了中文叫法（`nameZh`）的 Bot 输出「中文叫法 + 原名」，没写的只输出原名这段文字。三种用法：默认（一行，原名可截断）、`wrap`（详情页大标题，可换行）、`short`（只写中文叫法，原名在 `title` 里）；名字本身只有 13–14px 的地方再加 `small`。规则和取值见 §3.4。读屏文本、替代文字、排序这些不画出来的地方用 `scripts/lib/bot-name.mjs` 的 `displayName(bot)`。

**头像砖 `.bz-tile`**：圆角 24%，底 `--bz-surface-2` + 细边 + 内高光，砖底一团 Bot 色柔光（深色 42%、浅色 30% 混透明，`::before`），不带投影。**Bot 占砖的 68%**：砖的直接子元素（`svg`、`img`、头像按钮）自动是 68%，不用自己写尺寸。尺寸只用 28、40、48、64、72、96、120：加 `.s28` … `.s120`，或者在外层设 `--bz-tile-size`（默认 48）。Bot 色来自最近的 `.bz-bot-scope`。首屏砖墙的砖尺寸跟着视口走，是唯一不在这七档里的。

**图标**：全站一套，`theme/icons.ts`（路径数据）+ `components/BzIcon.vue`：`<BzIcon name="bolt" />`，`size` 默认 16。24 网格，`stroke-width: 1.5`，圆头圆角，`currentColor`，不填充，`aria-hidden`。现有：flame、bolt、shield、clock、plug（要连账号）、plug-off（不用连账号）、users、arrow-up-right、arrow-left、arrow-right、arrow-down、send（发给某个 Bot）、search、plus、check、copy、chevron-right、chevron-down、quote（前引号，两枚「6」字形）、x、grid（「全部」）、globe（国内使用的说明）。要新图标就往 `icons.ts` 里加一条 path，不要在组件里再写内联 SVG。

**静止的小 Bot**（数量多、尺寸小的地方用，不占每帧的计算）：`StaticBot.vue` 画的是活体头像首帧（t=0、idle）的轮廓和眼睛，不注册时钟、不跟随、不变身，`data-testid="still-bot"`；镜头和 `LiveBot` 一样，两种放在一起大小一致。上面包了两层：`RoleMascot`（按分组名画那只吉祥物，用在分组切换和分组标签里）、`BotStill`（按 slug 画货架上某个 Bot，有自定义头像就用图片，用在专题卡的头像叠里）。加 `ring` 会在身体外面垫一圈 2px 的底色（颜色读 `--bz-still-ring`），叠在一起时互相分得开。样式在 `home.css`。

**区块标题 `.bz-section-head`**：左对齐。结构是 `<header class="bz-section-head"><div><h2>标题</h2></div><span class="bot-count">共 82 个</span></header>`：`h2` 用 h2 档圆体；右侧可以放计数（12px/600，`--bz-text-3`，tabular-nums）或一个 ghost 按钮，和左边底对齐；到内容 24。**标题下面不放说明**（§0 第 6 条；`.bz-section-head p` 的样式留着，现在没有地方用）。

**分段控件 `.bz-seg`**：胶囊容器 + 滑块，高 40（触摸 44），13px/600。容器里直接放 2–4 个带 `aria-pressed` 的 `<button>`，各项等宽，选中滑块自己跟着 `aria-pressed="true"` 滑过去（`:has()` 算位置，不用再写 `data-sort`）；容器要自己加 `role="group"` 和 `aria-label`。项数多、要横向滑动的（分组）用 `.bz-seg.free`：各项按文字宽度排，没有滑块，选中项自己亮。每一项的点按范围撑满整条的高度。旧类名 `.sort-controls` 是别名。

**气泡**：样子不变（漫画风：实底、2px 墨色描边、Bot 色硬投影），圆角 12，圆体 14px/700。详见 §3.3。

**焦点**：`focus-visible` 一律 2px `--bz-ink` 外框、偏移 2px。

## 2. 首页布局

内容区最大宽 1140px，左右留白 32px（<680px 时 16px）；`.shelf-page` 自己铺满视口宽，用内边距把内容收进 1140，所以球池这类铺满视口的层可以出血到视口边缘而不产生横向滚动（`overflow-x: clip`）。自上而下：悬浮导航条 → 首屏（球池：站名、搜索框、掉下来的 Bot）→ 「本周主推」→ 「小队」→ 「专题」→ 「全部 Bot」（工具栏 + 按分组分段的列表）→ 页尾的「我要投稿」→ 全站页脚。区块之间 96px（<680px 64px）。

组件怎么分：`BotShelf.vue` 只管页面骨架；首屏是 `HeroBallpit.vue`（§2.2）；首屏以下全部在 `HomeSections.vue` 里（主推、`HomeSquads`、`HomeCollections`、工具栏 `ShelfToolbar`、分组 `RoleGroup`、页尾）。全站页脚 `SiteFooter` 挂在主题 Layout 的 `layout-bottom` 插槽里（§2.6）。排序、分组、地址栏读写是纯函数，在 `theme/shelf.ts`（有单测）。

### 2.1 三岛分离页眉

VitePress 默认顶栏（`.VPNavBar`）换肤，不另写导航组件，汉堡菜单、主题切换、GitHub 图标照常可用。

- 固定距顶 16px，高 44px，最大宽 1140px 居中，外框透明、无边无影。根 `--vp-nav-height` 保留原来的 88px（窄屏 80px），正文、球池、投稿预览不挪位。
- 左：28px 吉祥物 + 站名，胶囊内边距 6px 12px 6px 6px，悬停歪头。右：「我要投稿」带 plus，无边框、高 32px、水平内边距 12px、`--bz-fs-sm`/600；主题和 GitHub 是 32px 幽灵按钮。按钮平时用 `--bz-text-2`，悬停变墨色和 `--bz-surface-3` 底。
- 左右两块在顶部透明；滚动超过 8px 才浮出 `--bz-nav-bg` 底、16px 模糊、160% 饱和度、细边阴影，过渡 240ms。
- 中间是常驻 40px 玻璃胶囊：内边距 4px、`--bz-hairline` 边、`--bz-nav-bg` 底、20px 模糊、180% 饱和度。三个链接高 32px、水平内边距 16px、`--bz-fs-sm`/550，当前项墨色/650；滑块用 `--bz-seg-active` 和 `--bz-seg-shadow`，280ms 弹性移动和变宽，减弱动态时不动效过渡。无当前模块就隐藏。
- <768px：收紧模块链接，右侧改汉堡，下拉圆角面板距页眉 8px。粗指针的点击区至少 44px；≤359px 左侧只显示吉祥物，保留站名供读屏。
- 站内没有文档页，滚动后才出现的 `.VPLocalNav`（「回到顶部」条）全站隐藏。

### 2.2 首屏：球池（`HeroBallpit.vue`，`<header class="ballpit" data-testid="ballpit">`）

货架上的真 Bot 从导航条后面掉下来，堆在地板上，有三只坐在站名和搜索框上。站名的每个字和搜索框都是场景里的实体（碰撞体），不是贴在上面的字。为什么换、为什么收进版心见决策 42。样式在 `styles/hero.css`，物理在 `theme/ballpit-physics.ts`。

**版式**

- **高度**：`clamp(520px, 100svh − 导航让位 − 124px, 800px)`；<680px 是 `clamp(460px, 100svh − 导航让位 − 176px, 620px)`。地板是这块的底边。1440×900 时「本周主推」的标题在首屏底部露头。
- **站名和搜索框**（`.pit-copy`）：水平居中，顶边在首屏高度的 33% 处（<680px 27%），上方留出让 Bot 落下来的空间。`h1`（站名）圆体 `--bz-fs-display`（`clamp(44px, 5.6vw, 72px)`）/ 700，行高 1.05，字距 −0.02em；视口 1440 时 72px，390 时 44px。站名到搜索框 32px（<680px 24px）。
- **没有副标题**。首屏的字只有站名和搜索框。站点 tagline（`meta.mjs` 的 `SITE.tagline`）只给页面的 `meta description` 用，界面上不显示。
- **搜索框**（`SearchTrigger`，`<button data-testid="search-trigger">`）：≥680px **476×51、圆角 12**（窄屏撑满）；`--bz-card` 底、1px `--bz-border-strong`、内高光。左边 16px 的放大镜（`BzIcon`）+ 占位字「搜索」（15px，`--bz-text-3`；`meta.mjs` 的 `SHELF_COPY.searchPlaceholder`，搜索面板的输入框用同一个），右边两个键帽「⌘」「K」（24px 高、圆角 8、12px/600；非苹果设备挂载后显示「Ctrl」；<680px 不显示键帽）。读屏名称是「搜索 Bot、Prompt 和 Skills」（决策 71）。悬停只把描边加深到 `--bz-border-hover`。点击派发 `window.dispatchEvent(new CustomEvent('bz-search-open'))`，由 `SearchPalette` 打开；关闭后焦点回到这个按钮。
- 首屏不放投稿按钮（和导航重复）；`[data-testid="contribute-link"]` 在页尾（§2.5 末尾）。
- **舞台宽度**：视口宽于 1204px 时舞台**收进版心**——两面墙在版心两边（各离中线 602px，和悬浮导航条同宽），地板线只画在版心里、两端淡出，Bot 往中间收一点，堆成中间高两头矮的小丘。视口不宽于 1204px 时墙在视口外 28px（两边的 Bot 被屏幕边切掉一截），地板线横贯视口。场景层（`.pit-world`、`.pit-floor`）本身铺满视口宽，靠 `.shelf-page` 的 `overflow-x: clip` 不产生横向滚动。

**谁上场**

- 货架上没有自定义头像的 Bot，官方颜色和形状（`DefaultAvatar`）。挑选是确定性的：按颜色分组，色相隔着取（相邻不撞色），同色里优先还没用过的形状，灰黑的每 10 只最多插一只。
- 数量看舞台宽：地板上 `round(1.5 × 舞台宽 / 平均直径)` 只，限 6–30（手机是 `2 ×`，限 6–15），另加 3 只坐席。1440 宽 24 只，390 宽 18 只。货架不足 7 只时不设坐席，有几只掉几只；0 只时只剩站名和搜索框。
- 直径：桌面 56–120px 十二档循环（舞台窄于 1100px ×0.86，宽于 1680px ×1.15），手机 44–84px；坐席 54–76px（手机 40–52px）。
- **坐席**：站名最后一个字上、搜索框左肩、搜索框右端各一只；肩膀太窄坐不下（很窄的手机）就改成落地。
- **服务端只输出站名和搜索框**；Bot 在挂载、量完场景以后才渲染（没有脚本时就是站名和搜索框）。

**物理和渲染**

- `theme/ballpit-physics.ts`：不碰 DOM、没有第三方库。不旋转的圆角盒刚体（按每个形状的真实轮廓拟合：药片是扁的，水滴是竖的），固定步长 1/120 秒，重力 2300px/s²，顺序冲量加分离式位置修正；重心落在支撑范围外会滑下去（不旋转的刚体靠它装作会翻）。
- 静态碰撞体：站名的每个字（canvas 量墨迹框）、站名和搜索框之间补的一块实心、搜索框。落地的 Bot 掉落时从站名和搜索框**后面**穿过，落到它们下面才恢复碰撞；站名和搜索框始终在 Bot 的上层，搜索框一直点得到。
- 大的先掉、小的后掉，约 2 秒落定。种子固定（墙在版心两边用 42，否则用 7），同一宽度下每次落成同一堆。
- 位置只写 `transform: translate3d`，由脚本直接写，不走 Vue 响应式；挤压和歪头写在里面一层。每只脚下一团自己颜色的光（`.pit-glow`，静态径向渐变，只动 transform 和 opacity）。全部落定后在身后画一张静态的光晕（`.pit-haze`，一个元素、一张背景，700ms 淡入；被搅动时先暗到 25%）。没有 `filter: blur`，没有一直在动的装饰。
- **停表**：全部落定（动能低于阈值持续 0.45 秒）就停 rAF；首屏滚出视口（IntersectionObserver）或标签页隐藏时也停，模拟停在原地，回来接着走。落定以后每 5–10 秒有一只身上没压着别人的自己蹦一下（约 0.8 秒），其余时间不跑。
- **回到首页不重演**：同一份文档里掉落只演一次（标记记在 `window.__bzBallpitPlayed` 上；不能用模块变量，因为 VitePress 首次进站和站内跳转回来用的是页面代码的两份副本）。之后再回到首页（从详情页后退、点站名回来），把同一场模拟同步快进到落定，直接摆好。窗口宽度跨档（数量或大小变了）时也是直接摆好；同档内只重量墙和碰撞体。

**互动**

| 触发 | 反应 |
|---|---|
| 鼠标停在 Bot 上 | 睁大眼（`wide`）+ 跳一下；停满 240ms 冒出名片（已经开着一张时换下一张只要 140ms）。移开 220ms 后收起；鼠标挪到名片上不收 |
| 点一下 | 戳：随机变个身、向上弹一下（不说话），名片立刻出来。和货架上同一个 Bot 共用戳历史 |
| 按住拖动 | 移动超过 5px 算抓：跟手、能挤开别的；松手带着速度飞出去（限速 2600px/s），这次松手不算点击 |
| 鼠标快速扫过（≥650px/s） | 给碰到的 Bot 一个冲量 |
| 触屏 | `touch-action: pan-y`：在 Bot 身上竖着划照常滚页面；点一下 = 戳 + 名片；横着拖才算抓。点别处收起名片 |
| 键盘 | 整个球池只占一个 Tab 停靠点（roving tabindex）。←/→ 按屏幕上的左右顺序换一只；走到哪只，哪只出名片并播报「名字：一句话介绍」（`announce()`）；Enter / 空格同样出名片；Esc 收起；再按 Tab 到名片链接 |
| 减少动效 | 不演掉落、不能拖、不自己蹦，没有跳动和名片的弹出动画；同一场模拟快进到落定直接显示。悬停、点击、键盘出名片照常 |

**名片**（`[data-testid="pit-card"]`）：沿用台词气泡的样子（`--bz-card` 实底、2px `--bz-ink` 描边、Bot 色硬投影 `3px 3px 0`、圆角 12、12px 的尖角朝下指着它），出现在 Bot 头顶 16px 处。里面三行：名字（h3 档 20px/700 圆体，右边一个 `chevron-right`）、原名（只有写了中文叫法 `nameZh` 的才有，12px/600 `--bz-text-3`）、一句话介绍（14px/1.5 `--bz-text-2`，最多两行、均衡断行）。称呼的规矩是「有中文叫法以它为主，原名跟在下面」。**整张名片是进详情页的链接。** 宽度收到刚好包住最长的一行，最小 168px、最大 304px（且不超过视口宽 − 32px）；靠近屏幕边时名片往里收，尖角仍指着 Bot。全页只开一张，和列表卡的台词气泡互斥（共用 `pitch.ts` 的 `activePitch`）。

**可用性**：每只 Bot 是一个 `button`（`[data-testid="pit-bot"]`，外层 `.pit-body` 带 `data-slug`），`aria-label` 是全称（「中文叫法（原名）」或原名），`aria-expanded` 表示名片开没开；焦点框沿用全站样式（偏移 3px）。地板和光是 `aria-hidden`。

### 2.3 本周主推

`<section class="shelf-section" aria-labelledby="featured-title">`。区块标题只有 `h2`「本周主推」，没有说明。

- **选哪三个**：由编辑定，写在策展文件 `curation/shelf.yaml` 的 `featured`（最多三个，按写的顺序排，每个带一句点评 `note`）。里面的 Bot 不在货架上的那一项直接跳过；一个都没有时整个区块不显示。不再按热度兜底。不受分组筛选和排序影响。
- **网格** `.featured-grid`：3 张等宽卡，≥900px 一排、间距 16；<900px 竖排、间距 16。
- **主推卡** `[data-testid="featured-card"]`（带 `data-slug`、class `bz-bot-scope`，**不带** `data-testid="bot-card"`）：圆角 12、细边 + 内高光、内边距 24，深色底色透明、浅色 `--bz-surface-1`；左上常驻一团 Bot 色柔光（`::before`，深色 22%、浅色 16%，不透明度 .7），悬停时更亮、细边染 Bot 色（42%）。**左对齐**，三张等高，底行贴底：
  1. 头行：72px 头像砖（`.featured-tile.bz-tile`，活 Bot 占砖 68%，`aria-hidden`，点它是戳）+ 右边名字（`h3.bot-name > a`，链到详情页，title 档 16px/600 圆体；有中文叫法的写成「中文叫法 + 原名」，只占一行，§3.4）和作者行（13px `--bz-text-3`：`by 作者`（链接规则见「作者主页」），后面跟「· 官方市场」或「· 社区收录」）。作者自己投稿的，名字右边一个「作者投稿」标签。
  2. 介绍 `.bot-tagline`（15px/1.6，`--bz-text-2`，固定两行高，多了省略），到头行 16。
  3. **编辑点评** `blockquote.featured-note[data-testid="featured-note"]`（有 `note` 才有），到介绍 16：一块圆角 8 的底（Bot 色 7% 混 `--bz-surface-2`），内边距 12；左边一个 20px 的 `quote` 图标（Bot 色 70% 混墨色），右边点评本身（13px/1.5，墨色 85%）。**只显示点评，不写「编辑说」。** 点评不拦点击，点它和点卡片别处一样进详情。
  4. 底行 `.featured-foot`：左边分组标签（前面一只 12px 的分组吉祥物）+ 额度（`bolt` +「额度 低/中/高」，「高」用 `--bz-quota-high`）；右边「导入」`[data-testid="featured-import"]`（`.bz-btn.sm`，`arrow-up-right` + 文字，上报和动画逻辑同列表）；OpenBot 的 Bot 换成「复制安装提示词」（§3.5）。
- **整张卡可点进详情**，做法和层级同列表卡（§3.2「整卡可点」）：砖、作者链接、「导入」在链接上面。
- 悬停主推卡：Bot `wide`，不显示气泡；点砖 = 戳（和列表、详情共用同一个 slug 的戳历史）；点「导入」：上报、Bot 播 `comet`、新标签打开。

**小队**区块排在主推和专题之间（`<section id="squads">`，组件 `HomeSquads.vue`），规格见小队那一节。

### 2.3b 专题

`<section id="collections" class="shelf-section" aria-labelledby="collections-title">`（`HomeCollections.vue`）。区块标题只有 `h2`「专题」。数据是策展文件的 `collections`，按写的顺序；一个都没有时整个区块不显示。

- **一排卡** `.collection-strip`（`role="group"`）：≥1100px 五列等宽、间距 16（1140 内容宽时每张约 215px；多于五个自动换行）。<1100px 改成一条**自己横向滑动**的带子：每张 208px 宽、`scroll-snap-type: x proximity`、隐藏滚动条、出血到页面左右留白；还有卡片没露出来的那一头 48px 渐隐（`data-fade="left|right|both|none"`，和分组切换同一个做法）；页面本身不横向滚动。
- **专题卡** `button[data-testid="collection-card"]`（带 `data-slug`）：圆角 12、内边距 16、细边 + 内高光，深色底透明、浅色白。自上而下只有三样，**不显示 `blurb`**：
  1. 头像叠 `.collection-faces`（`aria-hidden`）：专题里前 4 只 Bot 的**静止**小头像（`BotStill`，40px，互相压 12px），每只身体外面垫一圈 2px 的卡片底色，叠在一起也分得开；多于 4 只时后面跟「+N」（12px/600 `--bz-text-3`）。
  2. 标题（title 档 16px/600 圆体，一行，太长省略），到头像叠 16。
  3. 「N 个 Bot」（12px/600 `--bz-text-3`），到标题 4。
- 卡片左上有一片很淡的柔光（`::before`），颜色是这几只 Bot 自己的颜色从左到右渐变（深色不透明度 .16、浅色 .1）；悬停时柔光加深、细边换成 `--bz-border-strong`，卡片不位移。
- **点一张**：按这个专题筛选「全部 Bot」（§2.5 状态 3），页面平滑滚到「全部 Bot」（减少动效时直接到位），键盘焦点交给它的标题 `#all-title`。正在筛选的那张 `aria-pressed="true"`，细边 `--bz-border-hover`、柔光保持加深。

### 2.4 全部 Bot：标题和工具栏

`<section id="all" class="shelf-section shelf-all" aria-labelledby="all-title">`。区块标题 `h2#all-title`「全部 Bot」（带 `tabindex="-1"`，筛选后接焦点用），右侧计数 `.bot-count`「共 N 个」（N 是当前显示的数量，12px/600 `--bz-text-3`）；货架为空时不显示计数。

工具栏 `.shelf-toolbar`（`ShelfToolbar.vue`，货架为空时不显示），到列表 24。左边分组，右边排序：

- **分组切换** `.role-tabs`（`.bz-seg.free`，`role=group`、`aria-label=按分组筛选`）：一排 `button[data-testid="role-tab"]`，带 `data-role` 和 `aria-pressed`，单选。第一项「全部」（`data-role="all"`，前面一个 16px 的 `grid` 图标），后面是货架上有 Bot 的分组，顺序跟 schema 枚举走；每项是「16px 的分组吉祥物（静止，`RoleMascot`）+ 分组名 + 数量」，数量用 12px、`--bz-text-3`。9 个分组在 1140 内容宽时正好一行放下；放不下时这一条自己横向滑动，还有内容的那一侧 32px 渐隐（`data-fade="left|right|both|none"`），选中的那一项会自己滑进看得见的范围。焦点框画在按钮里面（这一条会裁掉往外画的框）。
- **排序** `.sort-seg`（`.bz-seg`，`role=group`、`aria-label=排序`）：「推荐 / 最新 / 最热」，`sort-rec` / `sort-new` / `sort-hot`，规格见 §1b「分段控件」。默认「推荐」。
- **吸顶**：`position: sticky; top: var(--vp-nav-height)`，也就是贴在导航条下面 8px。平时没有底，左右各往外放 8px，所以分组的左边缘和内容对齐；吸住以后（`data-stuck="true"`）显出和导航条同一种玻璃底（`--bz-nav-bg` + `blur(18px) saturate(160%)`）、细边、圆角 12，位置不跳。吸没吸住是滚动时量出来的（一帧最多量一次）。
- **<680px**：排序换到分组下面一行，靠左；只有分组那一条吸顶（它自己变成玻璃条），排序跟着页面滚走。
- 键盘顺序：分组各项 → 排序三项 →（专题筛选条的「清除」）→ 第一张卡片。
- 分组和排序可以叠加。排序在本次访问里记住（点进详情再退回来还在），不写进地址栏。

### 2.5 分组、列表和页尾

列表区 `.shelf-list` 有三种状态：

1. **按分组分段**（默认：选「全部」、没有专题筛选）。每个有 Bot 的分组一段 `section[data-testid="role-group"]`（`RoleGroup.vue`，带 `data-role`、`data-folded`），顺序跟 schema 枚举走，段与段之间 64（<680px 48）。
   - **组头** `.role-head`：一块 40px 的头像砖（`.role-tile.bz-tile.s40`，砖底是分组色的柔光）里一只**活的**分组吉祥物（约 27px，颜色和形状见 `theme/color.ts` 的 `CATEGORY_MASCOTS`，`aria-hidden`）+ 分组名（`h3`，h3 档 20px/600 圆体）+ 右侧「N 个」（`.bz-count`）。**不显示分组说明**（`meta.mjs` 的 `CATEGORY_COPY` 那句只放在分组名和分组切换各项的 `title` 悬停提示里）。吉祥物能玩：悬停睁大眼（`wide`）跳一下，点它是戳；砖本身不位移。到卡片 16。
   - **卡片**：`.bot-grid` 两列（<900px 单列）、间距 16。分组显示时卡片**不带分组标签**。
   - **先露两行**：两列时先露 4 张，单列时先露 2 张；其余收在下面的按钮 `[data-testid="group-more"]`「展开 N 个」里（`.bz-btn.ghost.sm`，`chevron-down` 图标，`aria-expanded`、`aria-controls` 指向这一组的网格）。按钮居中，左右各一条细线，像一道折痕。展开后文字变「收起」、箭头转 180°，新露出来的卡片 240ms 淡入。**只比两行多出不到一行的小组不折**（两列时 ≤6 个、单列时 ≤3 个）：直接全露，没有按钮。
   - **收起时页面不乱跳**：按钮留在原地（上面收走多少，页面就回滚多少）；要是这样组头会被顶出屏幕，就退到组头。
   - 服务端按两列渲染（每组 4 张）；单列宽度下多出来的两张先由 CSS 藏住，脚本接管以后再按实际宽度来。
2. **选中单个分组**：只显示这一组（同样的组头），全部展开，没有展开按钮。
3. **专题筛选**：分组切换回到「全部」。列表上方一条筛选条 `[data-testid="filter-bar"]`（圆角 12、`--bz-surface-2` 底、细边）：左边「专题：<标题> · N 个」（标题用墨色 600，其余 `--bz-text-2`），右边「清除」`[data-testid="filter-clear"]`（`.bz-btn.ghost.sm`，`x` 图标）。下面是不分组的两列卡片，**每张带分组标签**。点「清除」回到状态 1，焦点回到 `#all-title`。

**排序**（三种状态都适用，组内 / 专题内排）：
- 「推荐」：编辑置顶的（策展文件的 `picks`）按置顶顺序排最前，其余按热度 → 上架日期 → 名字。专题筛选时「推荐」就是编辑在专题里排的顺序。
- 「最新」：上架日期新的在前，同一天按名字。「最热」：热度高的在前，热度相同按「最新」。
- 只在这几个时刻重排：进入页面、首次拿到热度、主动切换排序。之后点击只改数字，卡片不跳位。拿不到热度时排序留在「推荐」，不弹错误。

**地址栏**：分组写成 `?role=<分组名>`，专题写成 `?c=<专题 slug>`，后面都带 `#all`；回到「全部」就清掉。用 `history.replaceState` 改，不整页跳转、不增加历史记录。刷新或把地址发给别人都能还原，并且直接落在「全部 Bot」上。专题优先于分组；不认识的值当没写，并顺手从地址栏里清掉，别的查询参数原样留着。服务端渲染的始终是默认状态，脚本接管以后再按地址栏还原。

**切换时的滚动**：切分组、清除专题以后，如果列表开头已经滚到工具栏上面去了，页面退到列表开头（工具栏还吸着，不跳）。切排序不动滚动位置（人还在看原来那一组）。三种切换列表都整体淡入 200ms。每次筛选变化都会给读屏播一句「<分组或专题>，共 N 个」（走全站唯一的播报区）。

**退回来还在**：从首页点进详情再后退，分组和专题（地址栏里）、排序、展开过的分组、滚动位置都还原。排序和展开过的分组记在 `window.__bzShelfMemory` 上，只管这一次打开，刷新就清；不能记在模块变量里：VitePress 的生产构建给同一个页面出了两份代码（首次加载用的精简版 `.lean.js`、站内跳转用的完整版），模块变量各有一份、互相看不见，开发模式下看不出来。站内跳转回到首页时在 `setup` 里就按地址栏和记忆还原，赶在 VitePress 恢复滚动位置之前；首次加载要接管服务端渲染的页面，挂载以后才还原。

**筛选为空**（地址栏写了一个货架上还没有 Bot 的分组）：见 §10。

- **页尾** `.shelf-footer`（货架为空时不显示）：到列表 96px（<680px 64px），居中放一枚「我要投稿」`[data-testid="contribute-link"]`（`.bz-btn`，`plus` 图标 + 文字，链到 `/submit`）。没有引导语，也不画分隔线（下面的全站页脚自带一条，§2.6）。

### 2.6 全站页脚

用户要求加（2026-11-15，决策 44）：每页底部写创建人、开源仓库和鸣谢。文字都在 `meta.mjs` 的 `FOOTER`，改字只改那里。

`SiteFooter.vue`，`[data-testid="site-footer"]`：顶上一条 `--bz-hairline` 细线，上下内边距 48 / 64，和内容区同宽（1140，左右留白 32，<680px 16）。左边：20px 橙色站标 + 站名（16px/600 圆体，墨色），下一行「创建人：贾程博 · 深圳且曼学院」`[data-testid="footer-creator"]`；右边两行（窄屏落到左边下面）：「开源项目」+ 仓库链接 `[data-testid="footer-repo"]`（新标签页打开，`arrow-up-right` 小图标）+「· MIT 许可」；「鸣谢」+「且曼学院」`[data-testid="footer-thanks"]`。13px，标签三级灰、内容二级灰，链接悬停变墨色。

## 3. 卡片、玻璃砖和气泡

### 3.1 玻璃砖（`.bz-tile`）

主推卡、分组组头、详情舞台、404 共用，规格见 §1b「头像砖」：比例圆角 24%、`--bz-surface-2` 底 + `--bz-hairline` 细边 + 内高光，不带投影；`::before` 在砖底画一团 Bot 色的径向柔光（浅色 30%、深色 42% 混透明），所在卡片悬停时变亮。Bot 占砖的 68%。砖是静止的，没有漂移动画；砖里只放 Bot，不放文字。

**列表卡不用方砖**：像 Grok Bot 的列表那样，Bot 直接放大、身体填满头像框。`.avatar-stage` 在列表卡里只是一个 52×52 的格子（没有边、没有底、没有内高光、没有柔光），里面的头像按钮是 44×44。

### 3.2 列表卡（`[data-testid="bot-card"]`）

紧凑的三行，总高约 188px（同一行等高）。

| 区域 | 规格 |
|---|---|
| 外壳 `.bot-card` | 保留 `data-slug`、`bz-bot-scope`。圆角 **12**，`--bz-hairline` 细边 + 内高光，不带投影；深色底色透明，浅色 `--bz-surface-1`。article 是容器查询的容器，版式网格在里面的 `.bot-card-body`：三列 `52px / 1fr / auto`，三行，间距 12，内边距 20×24 |
| 第一行 | 左：52 的格子里一只 44 的 Bot（头像按钮 `[data-testid=avatar]`，不用方砖）。中：名字 `h3.bot-name > a[data-testid="detail-link"]`（title 档 16px/600 圆体；有中文叫法的写成「中文叫法 + 原名」，只占一行，放不下先截原名，§3.4）；作者自己投稿的，名字右边一个「作者投稿」标签（橙）。名字下面是**作者行** `.bot-byline`（13px `--bz-text-3`，只占一行）：「by 作者」（`author-link` 或纯文字，见「作者主页」），后面跟**来源**「· 官方市场」或「· 社区收录」；作者名太长就省略，来源始终留着。**右上角**：「导入」`btn-import`（`.bz-btn.sm`，`arrow-up-right` + 文字） |
| 第二行 | 介绍 `.bot-tagline`（15px/1.6，`--bz-text-2`），固定两行高（48px），多了省略；气泡也落在这一格 |
| 第三行 | 左 `.bot-stats`（**属性**，13px `--bz-text-3`，图标 16，项间距 16，tabular-nums）：分组标签（前面一只 12px 的分组吉祥物；**首页按分组分段、选中单个分组时不出现**，专题筛选和投稿预览里出现，由 `BotCard` 的 `showCategory` 控制，默认显示）→ 额度（`bolt` +「额度 低/中/高」，「高」用 `--bz-quota-high`）→ 门槛（`plug` +「要连账号」或 `plug-off` +「不用连账号」）→「会自己跑」（`clock`，有才显示）→ 热度（`flame` + 数字，大于 0 才显示，「热度」两个字只给读屏）。门槛和「会自己跑」在组件里从 `bot.permissions` 现算：含「外部账号」或「浏览器 Cookie」算要连账号，含「定时自动运行」算会自己跑。右：「复制安装提示词」`btn-prompt`（`.bz-btn.ghost.sm`，`copy` + 文字；外部收录没有这个按钮） |
| 窄卡片 | 卡片自己窄于 400px 时（手机、/submit 预览；用 `@container`，不看视口）：内边距 20px，「导入」挪到第四行，和「复制安装提示词」并排，各自撑开、高 44；窄于 320px 各占一行 |
| 悬停 | 仅 `@media (hover:hover)`。卡片 `::after` 是一层绝对定位的渐变：左上角 `color-mix(in srgb, var(--bz-bot-color) 18%, transparent)` 的径向光，叠在自上而下的柔光上；默认 `opacity: 0`，150ms `ease-in-out` 淡入到 1；细边同时染上 Bot 色（45%）。**卡片本身不位移、不缩放。** 内容在这层之上（`z-index`）。触摸点开气泡或键盘聚焦头像时这层也亮起来 |
| 标签 | 见 §1b「标签」：系统字体 12px/600，高 22px，左右 8px，圆角 8px；分组色、来源色 14% 混卡片底，文字为该色 40% 混 `--bz-ink`，两主题对比度均 ≥4.5。来源标签只有「作者投稿」一种；「官方市场」「社区收录」写在作者行里，不做标签 |
| 热度 | 列表卡上大于 0 才显示，火苗是 `--bz-flame`；没有热度不占位。详情页始终显示：加载「热度 …」，失败「热度 —」，title 为「热度暂时获取不到」 |
| 按钮 | 见 §1b「按钮」。卡片上都是小号：「导入」是 Bot 色淡染的玻璃，「复制安装提示词」是幽灵款。复制成功：图标换成 `check`、文字换成「已复制」、字和边变 `--bz-success`，1.8 秒后恢复 |

**整卡可点**（列表卡和主推卡一样）：

- 名字那个链接有一个 `::after`，绝对定位、`inset: 0`，铺满整张卡（列表卡铺满 `.bot-card-body`，主推卡铺满 `.featured-card`）。鼠标在卡上任何地方都是手型，点下去进详情。
- DOM 里**仍然只有这一个**指向详情的链接：键盘顺序和读屏文本不变，焦点框画在名字上。
- 层级（由下到上）：卡片底和悬停光晕 → 介绍、属性这些静态内容 → 整卡链接的 `::after`（`z-index: 0`）→ 头像格子 / 主推卡的砖、作者链接、按钮（`position: relative; z-index: 1`）→ 气泡（`z-index: 2`，不接指针事件，点气泡等于点卡片）。所以点头像是戳、点作者去作者主页、点「导入」开模板页、点「复制安装提示词」是复制，都不会误进详情。
- 全卡悬停的反应（Bot 变 `wide`、光晕、气泡）挂在 article 的 `pointerenter` / `pointerleave` 上，链接铺满以后照旧。悬停的反馈是整张卡的光晕，名字不加下划线。
- /submit 的投稿预览复用同一张卡：整卡点下去是切到「详情页」预览（和点名字一样），不跳走。

保留 `.bot-tag`、`.bot-tagline`、`.avatar-stage` 等现有类名和全部 data-testid。DOM 顺序（也是键盘顺序）：头像 → 名字 → 作者 → 导入 → 复制。

### 3.3 气泡几何与跳动

- **位置**：气泡在卡片里面，**盖在介绍那一块上**：绝对定位在 `.bot-tagline` 同一个网格格子里（左上对齐），不占高度，长了就往下盖住第三行；悬停时介绍 120ms 淡出，气泡出现在同一位置，尖角朝上指向头像（尖角中心在头像正下方，距气泡左边 26px）。气泡完全在卡片内，不压头像、不压「导入」。
- **样子**（漫画风保留）：`--bz-card` 实底、2px `--bz-ink` 描边、圆角 **12px**，硬投影 `3px 3px 0 var(--bz-bot-color)`；圆体 14px/700/1.45，内边距 8px 14px；宽度随文字，最小 68px、最大撑满介绍那一格；最多两行，line-clamp:2、text-wrap:balance 防孤字。尖角为 12px 方块，仅右、下 2px 描边：卡片里转 225° 朝上，详情页转 45° 朝下。
- **弹出**：opacity 0→1 180ms；位移 −5px→0、scale .94→1 280ms 弹簧缓动，原点在尖角处；收起 opacity 120ms，位移和缩放倒放。
- **跳动**：头像按钮原点脚底，560ms、每段弹性缓动；0/24/54/80/100% 的 translateY 0/2/−10/0/0px 与 scale (1,1)/(1.07,.92)/(.96,1.05)/(1.02,.98)/(1,1)。逐帧检查头像下沿到气泡上沿始终 ≥13px（放得下约 11px 的尖角）。悬停和键盘说话重新触发；鼠标/触摸戳只播 Bot 变身、不叠加按钮位移，连续点击保持稳定命中。
- 每卡 `data-testid=pitch-bubble`，`data-open="true|false"`；全页最多开一个。有 pitch 用 pitch，没有则 DEFAULT_PITCHES 随机且不连续重复；戳时改用 §5 专用台词。
- 头像按钮 `aria-label="听听{名字}的自荐"`（名字是界面上叫它的那个：有中文叫法用中文叫法，§3.4）；打开时 aria-describedby 指向独立的 `bz-sr-only` 全文元素。视觉 tooltip 设 aria-hidden、不用 aria-live；气泡 `data-text` 从打开起就是全文，内部唯一一个 span 用于逐字层，`[data-testid=typing]` 用 i 容器及三个 i 点、aria-hidden，避免逐字播报。初次加载不自动开气泡。
- `BotAvatar` 的 DOM：外层 `.avatar-root`（在卡片里 `display: contents`，让头像格子和气泡各自落进卡片网格；在详情页是气泡的定位容器）→ `.avatar-stage.bz-tile` > `button.bot-avatar`，以及并列的 `p.pitch-bubble`、`p.bz-sr-only`。
- focus-visible：全站一律 2px `--bz-ink` 外框、偏移 2px（头像按钮偏移 3px）。

### 3.4 名字：中文叫法和原名

`bot.yaml` 的 `name` 是原名（和 x.ai 模板页上的一致），`nameZh` 是可选的中文叫法（决策 41）。货架上 82 个 Bot 里 70 个的原名是英文，逛的人看不出它是干什么的，所以**写了中文叫法的 Bot，全站以中文叫法称呼它**，原名跟在后面，方便和模板页对上。没写的照旧只有原名，DOM 和以前一样（名字就是一段文字，不多套元素）。

规矩只在一处：`scripts/lib/bot-name.mjs`（`displayName` 界面上叫它什么、`originalName` 跟在后面的原名、`fullName` 一行纯文字里的全称）。页面上要写 Bot 的名字一律用 `components/BotName.vue`，不直接写 `bot.name`。

**两个名字并排时**：`span.bz-name[title="原名"] > span.bz-name-zh + span.bz-name-orig`，样式在 `base.css`「Bot 的名字」。

| 用在哪 | 中文叫法 `.bz-name-zh` | 原名 `.bz-name-orig` |
|---|---|---|
| 卡片、阵容、同组的 Bot（默认） | 跟着所在的标题走：title 档 16px/600 圆体，墨色 | 13px（`--bz-fs-sm`）/400，系统字体，`--bz-text-3`（和作者行同一档灰） |
| 名字本身只有 13–14px 的地方（`small`） | 同上，跟着所在的那行字 | 12px（`--bz-fs-xs`）/400 |
| 详情页的大标题（`wrap`） | h1 档 32px/700（<680px 28px） | h3 档 20px/500（<680px 18px） |

- 基线对齐，间距 6（`small` 是 4）。原名不加括号、不加分隔符：大小和灰度已经分出主次。界面上也不写「原名：」这类说明字（§0 第 6 条）。
- **默认只占一行**。名字那一行和没有中文叫法的卡片一样高（21.6px），两种卡片混排不会高低不齐。放不下时按这个顺序让：
  1. 原名截断，末尾省略号；
  2. 留给原名的地方不到 4 个字宽（4em）时，原名整个不显示，不留一截「Co…」；
  3. 中文叫法自己都放不下，才截中文叫法。

  「导入」按钮、「作者投稿」标签、小队里的岗位标签都不让位（它们 `flex: none`，名字那一格 `min-width: 0`）。
- 一行的写法里，原名的全称始终在 `title` 里（挂在 `.bz-name` 上）。这一层抬到「整卡可点」的伪元素上面（`z-index: 2`），鼠标停在名字上才出得来提示；它在链接里面，点它照样进详情。触摸设备看不到 `title`：被截掉的原名，点进详情页在标题里是全的。
- **详情页的大标题**（`wrap`）可以换行：两个名字各是一整块，放不下时原名整个落到下一行，不从中文叫法中间断开；原名不截断，所以这里不带 `title`。投稿预览里标题只有 24px，原名再降一档到 16px。
- 第 2 条的做法：`.bz-name` 是允许换行的 flex 容器，只露一行高（`max-height: 1lh; overflow: hidden`）。原名的起步宽度是 4em（`flex: 1 1 4em`；比 4em 短的原名按自己的宽度，`max-width: max-content`），这一行摆不下它就落到第二行，被裁掉。Chromium 和 WebKit 实测一致。

**哪里写两个名字，哪里只写中文叫法**

| 写法 | 用在哪 |
|---|---|
| 中文叫法 + 原名 | 列表卡、主推卡、详情页标题、搜索面板的条目、详情页的「同组的 Bot」和「改编自」、小队页的阵容和导入清单。都是认识它、要去导入它的地方。投稿预览里的卡片和详情跟着走 |
| 只写中文叫法，原名在 `title` 里（`short`） | 小队页里第二次以后出现的地方：流程图节点、流程文字版、额度和导入前准备清单、口令的收件人。同一页的阵容里已经写过原名，图和清单里再写一遍只会挤 |
| 只写中文叫法（纯文字） | 小队卡上那行名单（`rosterLine`）；读屏文本和替代文字：头像按钮「听听<名字>的自荐」、详情页侧栏的 `aria-label`、截图和自定义头像的 `alt`、小队页「导入」「已导入」的读屏名、权限后面小头像的提示 |
| 「中文叫法（原名）」 | 详情页的网页标题（`<title>`）：标签页上先看到中文，搜原名也搜得到 |

**排序和搜索**：按名字排的地方（三种排序里日期和热度都一样时、搜索面板没输入时的列表、详情页「同组的 Bot」）用显示出来的那个名字，也就是 `displayName`。搜索里中文叫法和原名都算「名字」，分量一样，搜哪个都排在只命中介绍的前面；小队也能用成员的两个名字搜到（§7、§14.6）。

**不动的地方**：`/submit` 流程里的文字（「检查通过：<name>」、PR 标题）仍然用原名；小队编制表里没收录的成员（`missing`）不是货架上的 Bot，没有中文叫法这个字段。

验收：`tests/unit/bot-name.test.mjs`（怎么称呼、校验、搜索、排序、投稿预览）、`tests/e2e/name-zh.spec.mjs`（各页面的写法和主次、六种宽度下只占一行且不挤掉「导入」、收窄时「写全 → 截断 → 不显示」、详情页标题换行、搜索、小队页）。

### 3.5 平台：OpenBot 的 Bot

货架上的 Bot 默认是 Grok Bot；`bot.yaml` 写了 `platform: OpenBot` 的是 OpenBot 的 Bot（决策 76）。界面上只多两样东西，不加任何说明句子：

- **平台标签** `.bz-tag.platform-tag[data-testid="platform-tag"]`「OpenBot」，只挂在 OpenBot 的 Bot 上（Grok Bot 不挂）。列表卡、主推卡挂在名字右边（「作者投稿」标签后面）；详情页挂在头部分组标签右边。颜色 `#4f46e5`，和分组、来源标签一样 14% 混卡片底、字 40% 混墨色。
- **没有「导入」**：OpenBot 没有模板链接。「复制安装提示词」`btn-prompt` 升成主按钮：列表卡、主推卡是实心小号（`.bz-btn.sm`），详情页侧栏是 `.bz-btn.primary.block`，这一屏唯一的实心主按钮。主推卡用的就是列表卡那颗（`BotActions`，埋点 `from: featured`）。复制的内容是 OpenBot 版安装提示词（`meta.mjs` 的 `installPrompt(slug, 'OpenBot')`）：发给 OpenBot 里任意一个 Agent，它先说清楚会做什么，等用户确认再新建一个 Agent 来当这个 Bot，定时任务先建好不开。读屏多一句「（发给 OpenBot）」。
- 外部收录的 OpenBot 也有这颗按钮（仓库里有它的 ROLE.md 和技能，摘要 `repoFiles: true`），详情页「技能」一块列的是 `skills/` 里的真文件，带「查看源码」。
- 写了 `projectUrl` 的，详情页侧栏小字里多一行「项目」（§9.2）。

## 4. 活体头像与接口

常驻动作由引擎 liveliness 提供：呼吸、自然眨眼、视线漂移。所有 LiveBot 初始化及减少动效重置时，均在 `new BotEngine` 第四参数传 `EXPRESSION_BY_ID.get('attentif')`，正脸竖胶囊眼，不再用默认往右上的 neutre。临时表情与鼠标跟随保持原行为。渲染方式参考 jeremy-prt/bloub `BloubBot.vue`（MIT，b4bb3c1），保留 mask 挖眼及粒子、圆环前后层次，不修改 vendor。

视口为 ±112，静止身体最长边占头像框 ≥80%；根 SVG `overflow: visible`，特效可画出框外。mask 和填色画布仍为上游 ±158，避免变身时身体被裁小。粒子深度雾混 `--bz-card`（回退 `--vp-c-bg`），与恒定深色眼睛解耦，浅色不发黑、深色仍自然隐入背景。头像放进玻璃砖后（§3）特效仍可画出砖外；逐帧检查跳动时头像不碰气泡（§3），并检查 Hero、详情和特效无横滚/裁切。

### 视线跟随与生命周期

`theme/live/gaze.ts` 的 `lookAt(dx, dy)`：

```text
nx = clamp(dx / 480, -1, 1)
ny = clamp(dy / 360, -1, 1)
yaw = nx * 16°
pitch = 10° - ny * 13°
Look = { yaw, pitch, mix: 1, spin: 0, wander: 0 }
```

16/13/10 来自 bloub `ui/gaze.ts` 的 YAW_MAX/PITCH_MAX/PITCH（MIT），不带上游面板专用 -TURN 或 spin 偏移。非有限输入当 0。全局仅一个 passive pointermove，touch 忽略；可见 Bot 在鼠标更新时以自己的中心计算，宽高为 0 跳过。鼠标 4 秒不动、离开文档（relatedTarget 为空）或窗口失焦时 `setLook(null, t, 0.6)`，0.6 秒回落并恢复漂移。

`theme/live/clock.ts`：`register(client): () => void`，client 含 el 和 tick(t)，t 单位秒。全站一个 rAF、一个 IntersectionObserver。仅可见 client tick；全离屏、document.hidden 或 reduce 时停止调度，不空转，不用 setInterval。离屏 500ms 内 data-running=false，隐藏后立即 false，恢复时 true。

SSR 不访问 window/document/matchMedia；输出 `sample(0)` 静态首帧，挂载后接管。mask id 用 Vue useId，不用随机数，不能有 hydration 警告。

### LiveBot DOM 与事件

`components/LiveBot.vue` 根元素就是 svg，不加外包层：class=bz-live、viewBox="-112 -112 224 224"、overflow:visible、aria-hidden=true。SSR 和客户端首帧都由相同 attentif 引擎 `sample(0)` 生成。

| 标记 / props | 含义 |
|---|---|
| `data-testid="live-bot"` | 活体根 SVG |
| `data-state="idle|…"` | 当前引擎状态 |
| `data-running="true|false"` | 当前是否被 tick |
| `data-follow="pointer|rest"` | 指针跟随或自身视线 |
| `data-shape` / shapeId | 原样输出形状 id |
| `data-part="body"` | 身体垫底 path，带 d，填 `var(--bz-eye, #16161b)`；眼睛是深色（唯一例外：官方色近乎纯黑的 Bot 在浅色主题下换成奶白，见 §1） |
| `data-part="fill"` | mask 内身体填色 rect；DefaultAvatar 传入 `var(--bz-bot-body)` |
| rest | 基础状态，默认 idle；卡片/主推/球池悬停 wide、空货架 sleep、404 thinking |
| `data-part="eye"` | mask 内两眼 path；transform 直接用引擎 matrix(...)，opacity 用 alpha |
| `data-part="dot|arc|notif"` | 粒子 / 圆环 / 通知点 |
| radii / color | number[] 或 null（圆）；color 接受 CSS 变量，身体用 style fill，不用 fill 属性 |
| look | 可选，`{ yaw, pitch }`（度）：没有鼠标可跟时看向哪里。不传就是正脸。传了也照常眨眼、漂移（`mix: 1, wander: 1`）；鼠标一动仍然先跟鼠标，鼠标停 4 秒后回到这个方向而不是回正脸。服务端的首帧和减少动效下的静态帧就已经看过去了。`DefaultAvatar`、`BotPortrait` 原样透传。小队合影用它让队员看向队长（§14.2） |
| outline / size | 可选描边色；有值沿身体画 1.5px、non-scaling-stroke；SVG width/height 默认 96，外层 CSS 决定显示尺寸 |

在根 SVG 派发 `bz-play` 自定义事件，`detail = { state: StateId, hold?: number }`。不在 STATE_BY_ID 的状态或 reduce 时忽略；否则 setState(state,t)，持续 `hold ?? 状态 duration` 秒（共享时钟）后回 rest；`hold: Infinity` 一直保持，NaN/-Infinity 回退 duration，负数归零。新事件打断旧事件。`live/playback.ts` 管理播放期限，rest 改变不打断有限临时动作；离开可释放 wide/Infinity。减少动效恢复静态 idle，重新启用动效回当前 rest。LB3 通过此接口及组件局部引用接反应，不为每个头像另起时钟。

## 5. 互动行为

| 触发 | 反应 |
|---|---|
| 鼠标进入整张列表卡片（不再只限头像） | wide 睁大眼 + 跳一下；卡片淡入 Bot 色光晕、介绍淡出；气泡先显示「…」打字点 350ms，再按 28ms/字逐字打出（读屏区一开始就有全文） |
| 离开卡片 | 立即关闭气泡（120ms 淡出）、介绍回来，基础状态改 idle；进行中的戳/按钮临时动作不被打断 |
| 鼠标进入主推卡 | wide + 左上柔光变亮；不跳、不出气泡 |
| Tab 到头像 / Enter / 空格 / Esc / 失焦 | Tab 说一句；Enter/空格换一句并重新跳；Esc 关闭；失焦关闭 |
| 点击或点按头像（「戳」） | 从 wink, burst, orbit, play, comet, egg, hexagon, thinking 随机选一个，不与上次重复；按引擎 duration 播完回 rest，换戳台词且不连续重复；滚动 3 秒内第 5 次触发 alert，说「别戳啦！」并清零计数。卡片/精选/详情按 slug 共享历史；球池里的 Bot 和货架上同一个 slug 共用历史；组头的分组吉祥物使用独立的 `mascot:<分组名>` 历史，不污染货架 |
| 点卡片上头像、作者、按钮以外的任何地方（列表卡、主推卡） | 进这个 Bot 的详情页（整卡可点，§3.2） |
| 点「导入」（列表、主推）或「一键导入」（详情） | 该卡 Bot 播 comet（「嗖」一下），新标签打开模板页 |
| 复制成功 | wink |
| 30 秒没有任何输入（减少动效时不触发） | data-running=true 的 Bot 依次进入 sleep，整波次错开 0–800ms；一个全局超时器管理整波 |
| 睡着后有任何输入 | 取消待睡队列；睡着的 Bot 里只有离输入点最近的一只 exclaim（键盘、滚动这类没坐标的输入取第一只），按 2 秒 duration 回 rest；其余的安静睁眼（`idle`、hold 0，下一帧回 rest）。不让全体一起冒感叹号：满屏感叹号太瘆人（用户 2026-11-15） |
| 进首页（每份文档一次） | 球池里的 Bot 从上面掉下来，约 2 秒落定；之后再回到首页直接摆好（§2.2） |
| 球池里的 Bot | 悬停：wide + 跳一下，停住冒出名片；点击 = 戳 + 名片；能抓起来扔；键盘可达。详见 §2.2 |
| 点首屏搜索框、按 ⌘K / Ctrl+K、「/」 | 打开搜索命令面板（`SearchPalette`）；关闭后焦点回到原处 |
| 点分组切换里的某一项 | 列表只留这一组并全部展开，计数跟着变，列表淡入 200ms，地址栏写上 `?role=`；主推、专题不变（§2.5） |
| 点专题卡 | 按这个专题筛选，滚到「全部 Bot」，焦点到它的标题，地址栏写上 `?c=`（§2.3b） |
| 组头里的分组吉祥物 | 悬停跳一下 + wide，点击 = 戳（历史记在 `mascot:<分组名>` 下）；仍然 aria-hidden |
| 空货架 / 筛选无结果 | 一只睡着的 Bot（96px），rest=sleep，无灰度滤镜 |
| 404 页 | not-found Layout 插槽；120px 头像砖里的 Bot 先 exclaim、再常驻 rest=thinking；「这一页走丢了」+ href=/「回货架看看」，没有说明句（版式见 §10） |
| 触摸 | 点按 = 戳 + 气泡显示 4 秒；点别处关闭；不跟随视线 |

戳台词：「哎，痒！」「再戳我就变形了」「好啦好啦，我在呢」「你找我呀？」。全部新增文案在 meta.mjs。

`live/reactions.ts` 仅挂一组 capture/passive 全局输入监听：pointermove、pointerdown、keydown、wheel、scroll、touchstart。URL 的 `?bz-idle=<毫秒>` 仅在客户端首次注册时读取一次，只接受 200–600000 的整数；默认代码值 `30_000`。若演示短阈值遇到未播完的戳/惊醒/入场，整波睡眠每秒检查一次、等临时动作完成后再睡，避免打断反馈；不增加每只 Bot 的计时循环。最后一个 Bot 卸载清理监听和计时器。

球池的掉落每份文档只演一次（标记在 `window` 上，不写 sessionStorage，整页刷新会再演），减少动效不演；戳球池里的 Bot 不弹台词气泡，只出名片。

气泡打字消费共享时钟，完成、关闭或失去全页唯一所有权时注销；减少动效时立即显示全文（包括中途切换）。卡片/详情以 provide/inject 把动作按钮接到自身头像，复制失败不 wink。

输入按每次事件 pointerType 判断，不存全局「触摸过」标记；鼠标点击不依赖浏览器是否赋焦点。全页单气泡、触摸再次点按换一句保留；鼠标转触摸时释放旧视线，后续鼠标仍能跟随。导入仍正常新标签打开、点击正常上报，动画不阻塞业务；复制成功按钮显示对勾图标 +「已复制」，文字和边框 success 色，1.8 秒恢复，唯一读屏播报区播报「已复制安装提示词」。失败按 §8。

## 6. 官方真脸

维护者用 `scripts/sync-faces.mjs` 读取 bots/*/bot.yaml 的 templateUrl，从 x.ai 模板 HTML 的 Next.js 转义数据中，在 addHref 后提取 color、shape。只取公开颜色和形状名，不复制形状路径、眼睛坐标或代码。构建不联网；`faces.json` 静态 import，不在运行时 fetch。

`site/.vitepress/data/faces.json` 格式（键字母排序、两空格缩进、结尾换行）：

```json
{
  "memory-keeper": { "color": "#777777", "shape": "hex", "fetchedAt": "2026-11-14" }
}
```

每条恰好 color（小写 #rrggbb）、shape（非空字符串）、fetchedAt（YYYY-MM-DD）。抓取失败保留旧条目，没有旧条目则不写，给带 slug 的中文警告。UA 为 Mozilla/5.0，单页超时 25 秒；跳过 _template、无 templateUrl 和 REPLACE-ME。`--check [--file 路径]` 离线校验，失败退出 1，报文件/位置/问题/改法。

### 25 个形状

固定顺序：blob, pebble, bean, egg, squircle, tablet, capsule, cylinder, hex, gem, crystal, wedge, shield, dome, arch, cloud, teardrop, leaf, square, sparkle, clover, flower, heart, house, star。

| 官方 id | 轮廓来源 |
|---|---|
| blob | bloub cercle |
| pebble | galet |
| squircle、square | squircle |
| tablet、capsule | capsule |
| hex | hexagone |
| cloud | nuage |
| teardrop | goutte |
| egg | PROFILES.egg，转普通数组并缓存 |
| bean、cylinder、gem、crystal、wedge、shield、dome、arch、leaf、sparkle、clover、flower、heart、house、star | theme/shapes-extra.ts 的 15 种原创径向轮廓 |

`shapeRadii` 未知 id 返回 null，同 id 返回同数组；SHAPES 映射必须返回原 radii 对象（眼位修正按对象查表），不能复制。原创轮廓用 shape.ts 工具模块加载时计算缓存；64 点、全有限数、最大半径 0.95–1.2、最小 >0.3；除两对别名外，任意两形状逐点最大差 >0.02。心形有凹口、星形五角、四瓣草、花六瓣、房子有屋顶，拱门和穹顶可区分。

`theme/face.ts`：`botFace(slug)` 委托 `resolveFace(slug, entry)`，返回 `{slug, shape, radii, color, source}`。已知官方形状 source=official；未知形状用 seed 轮廓 + 官方色，source=seed；无数据时原 avatarSeed 算法、SHAPES/COLORS 选择不变，shape 为 seed:<id>，fixtures 不变。

`DefaultAvatar` 使用 botFace(slug) 的 radii/shape/color。`faceColors(hex)` 返回 light/dark/outline：light 原色小写；dark 委托 color.ts 的 darkSwap（仅一份深色换奶白规则）；L>0.85 时 outline='rgba(0,0,0,.12)'，否则 null。根属性与动画帧更新隔离，不逐帧覆盖主题变量。根 SVG 内联 `--bz-bot-light` / `--bz-bot-dark`，有描边再内联 `--bz-bot-outline`；`--bz-bot-body` 由 CSS 切换，描边仅浅色显示。**待集成确认的差异**：计划写浅色描边 1px，LB1 明定 outline 渲染 1.5px；本文接口按 LB1 记录，不将两者声称一致。

## 7. 排序、筛选、搜索入口与外链

- 分组切换和排序的样子见 §2.4，规则见 §2.5。三种排序的比较函数在 `theme/shelf.ts`：推荐 = `pick` 有值的按序号在前，其余按最热；最热 = heat 降序、再 addedAt 降序、再名字；最新 = addedAt 降序、再名字。默认推荐。「名字」是界面上显示的那个：有中文叫法按中文叫法，没有按原名（§3.4）。
- 首次热度改变顺序时列表淡入 200ms；之后点击只改数字，不重排，切换排序或刷新才重排。主推是编辑定的，不随热度变。热度不是导入成功数。
- 搜索面板里 Bot 后面还有一组「小队」，见 §14.6。
- 输入了字以后，小队后面还有「Prompt」「Skills」两组（各最多 4 条，决策 71）：条目 `[data-testid="search-prompt"]`、`[data-testid="search-skill"]`（带 `data-slug`），32px 头像位里放 28px 的分类砖（`LibraryTile`，吉祥物占 74%），标题 + 一句话用途，右边分类标签用分类色（`library-marks.ts`，浅色、深色同一个颜色；选中行的标签字是「该色 40% 混 ink」）。上下键在 Bot、小队、Prompt、Skills 之间连着走，回车或点击进 `/prompts/<slug>`、`/skills/<slug>`。没输入时不出现这两组；数据第一次打开面板才加载，没到时这两组先不出现、也不显示「没找到」。读屏播报加上「N 条 Prompt」「N 个 Skill」，超过 4 条补「（列出前 4 条 / 个）」。
- 面板里四组（Bot、小队、Prompt、Skills）都在滚动区里，各是一个 `role="group"`（`aria-label` 是组名，`data-group` 是 bot / squad / prompt / skill）。组名高 32px、`position: sticky` 吸在滚动区顶上，面板实底；每行 `isolation: isolate`，行里的 Bot 名字（`.bz-name` z-index 2）、队长小头像不会压到组名上、也不会隔着组名接住鼠标；滚动区 `scroll-padding-top: 40px`，键盘翻到的条目停在组名下面。
- 拆词：查询先统一写法（全角转半角、小写），再按空白和「汉字与两个字符以上的英文、数字段（+ # 算在内）的交界」拆词，「做PPT」等于「做 PPT」；单个字母不拆，「B站」「K线」整个当一个词，匹配时再拿去掉空白的文字比一次（「B站」命中「B 站」，不命中 Website）。规则在 `search.ts` 的 `queryWords`、`matchWord`，库页的本库搜索也用它们。收录条目不显示的原名、slug 按词头匹配，整词和驼峰切开的两套都认（PDFs 搜 pdf、ChatGPT 搜 chatgpt 或 gpt 都行），+ 和 # 算词里的字；同一档里只在适用场景里找到的词少的排前面。
- 搜索：中文叫法和原名都算「名字」（`search.ts` 的 `searchBots`），搜哪个都能找到，分量一样：某个名字以整句查询开头排最前，其次是每个词都在名字里（可以一个词在中文叫法、一个词在原名）。条目里的名字按 §3.4 写成「中文叫法 + 原名」（`small`）。
- 搜索入口只有首屏搜索框一个按钮（外加快捷键），派发 `bz-search-open`。搜索面板本身（⌘K / Ctrl+K、「/」、键盘操作、读屏播报）由 `SearchPalette.vue` 负责，规格见 LB9 契约；面板颜色全部引用 `--bz-*` token，条目里的小 Bot 身体约 32px。输入框占位字「搜索」（和首屏同一个 `SHELF_COPY.searchPlaceholder`）；一次最多列 8 条，多出来的只写「还有 N 个」；底部的键帽提示（↑↓ 选择、↵ 打开、esc 关闭）保留。
- 新标签链接有读屏文本「（在新标签页打开）」及 `rel="noopener noreferrer"`。「导入」「一键导入」是按钮，图标用 `BzIcon` 的 `arrow-up-right`（放在文字前面）；作者外链、技能源码、定时任务这些文字链接沿用后面一个 12px 的「↗」（`ExternalHint`，aria-hidden）。「我要投稿」是站内链接（`/submit`），不带这些。

## 8. 手动复制对话框

原生 dialog，data-testid=prompt-fallback。标题「复制没成功，请手动复制」，说明「全选下面的文字，复制后发给你的 Grok Bot」（OpenBot 的 Bot 是「……复制后发给 OpenBot 里的任意一个 Agent」）。只读 textarea 内容等于安装提示词，打开自动全选聚焦；「关闭」按钮、Esc、点遮罩均可关，关闭后焦点回复制按钮。

## 9. 详情页

一份看得懂的「简历」：点进来的人要能看明白这个 Bot 是干什么的、怎么开口、要准备什么、适不适合自己。同一套 token 和质感，内容区最大宽 1140px。

三条规矩贯穿全页：

1. **界面上不放解释性的句子。** 区块只有标题（短名词）和数据；额度档位、每项权限、国内使用这些含义放在 `title` 和读屏文本（`.bz-sr-only`）里。
2. **没有数据的区块整块不渲染。** 没有定时任务就没有「定时任务」这一块，没有权限就没有「权限」这一块，不写「暂无」「不需要」。投稿预览例外（§9.5）。
3. **能点的东西才有容器。** 气泡、卡片、悬停反馈只给能点的东西（开场白、所在小队、同组的 Bot）；只是给人读的内容是平的：字、圆点、细线，不套卡片。

### 9.1 版式

DOM 顺序：「返回货架」→ `.detail-layout`（头部 `header.detail-header` → 侧栏 `aside.detail-rail` → 主栏 `.detail-main`）。键盘顺序跟着走：返回 → 头像 → 一键导入 → 复制安装提示词 → 作者 → 主栏里的开场白……

- **≥1000px 两栏**：左边头部和主栏，右边 320px 的侧栏，列间距 48（≥1100px 64）。侧栏的顶和头部对齐，`position: sticky` 吸在导航条下面 16px（`top: calc(var(--vp-nav-height) + 16px)`），主栏往下滚它一直在。网格第二行是 `1fr`：内容少的 Bot，头部和第一块之间不会被侧栏撑开。
- **<1000px 单栏**：头部 → 侧栏（到头部 32）→ 主栏（到侧栏 48），侧栏不吸顶。
- **返回**：顶部「← 返回货架」是幽灵小按钮（`.bz-btn.ghost.sm`，`arrow-left` + 文字），往左收 12px，让箭头和正文左边缘对齐。
- **头部**（上方留 64px 给气泡）：≥768px 左右布局、间距 32、上下居中；窄屏上下布局。左边一块 **120×120** 的头像砖舞台（<768px 96）里一只活 Bot（占砖 68%），舞台后面垫一团 Bot 色柔光（头部的 `::before`，16%）。右边自上而下：名字 `h1`（h1 档 32px/700 圆体；预览里是 `h2`；有中文叫法的是「中文叫法 + 原名」，原名 20px/500 三级灰，放不下整个落到下一行，§3.4）→ 一句话介绍（16px/1.5，`--bz-text-2`）→ 分组标签（到介绍 16）。作者、来源、上架日期、热度不在头部，在侧栏。
- **气泡**在头像上方：左边和砖对齐、往右长，尖角朝下探进砖里指着 Bot（尖角中心距气泡左边 60px）；不会盖住「返回货架」，也不压到名字。头像支持说话、跳动和戳。

### 9.2 侧栏（`data-testid="detail-rail"`）

一张卡：圆角 12、内边距 20、细边 + 内高光，底色 `--bz-surface-1`（深色透明、浅色白）。自上而下三段，段与段之间一条细线：

1. **按钮**（`BotActions`，都撑满、高 44、间距 8）：「一键导入」`btn-import`（`.bz-btn.primary`，`arrow-up-right` + 文字，**这一屏唯一的实心主按钮**）；不是外部收录的，下面一枚「复制安装提示词」`btn-prompt`（`.bz-btn`，`copy` + 文字，复制后变 `check` +「已复制」）。OpenBot 的 Bot 只有「复制安装提示词」一枚，是实心主按钮（§3.5）。按钮下面不放说明小字。
2. **三项属性**（`dl.rail-facts`，三格并排，中间两条细线；每格上面一行 12px 的名称，下面一行 15px/600 的图标 + 值）。每格按自己内容的宽度起步、多出来的宽度三格平分，所以每格的字到下一条细线的留白一样宽。
   - **额度**：`[data-testid="quota-meter"]`，三根由矮到高的小柱（4 宽，高 6、10、14，像信号格）加一个字「低 / 中 / 高」。低亮 1 根、中亮 2 根、高亮 3 根；没亮的是 `--bz-border-strong`，亮的是 `--bz-ink`，只有「高」把柱子和字都换成 `--bz-quota-high`。档位的含义（`quotaCopy`）在 `title` 和 `.bz-sr-only` 里。
   - **账号**（`fact-account`）：权限里有「外部账号」或「浏览器 Cookie」是 `plug` +「要连」，否则 `plug-off` +「不用连」。和列表卡同一套判断。
   - **定时任务**（`fact-routines`）：`clock` +「N 个」（`about.routines` 的条数；0 个时这一格是三级灰）。只知道有、数不出几个的（有 `routines.md`，或带「定时自动运行」权限但没写 `about.routines`）显示一个对勾，读屏读「有」。
3. **一组小字**（`dl.rail-meta`，13px，左边名称 `--bz-text-3`、右边值 `--bz-text-2`，行距 12）：作者（`author-link`，链接规则见「作者主页」）、来源（`.bot-origin`：官方市场 / 社区收录 / 作者投稿）、项目（`data-testid="project-link"`，只有写了 `projectUrl` 的才有：GitHub 仓库写成「owner/仓库」，别的只写域名，新标签打开，埋点 `kind: source`）、上架（`<time>`）、热度（`data-testid="heat"`：`flame` + 数字；没取到是「…」，失败是「—」）；有 `forkedFrom` 时再加一行「改编自」（`data-testid="forked-from"`，链到原 Bot 的详情页；原 Bot 有中文叫法的写成「中文叫法 + 原名」，`small`）。

**探头的小 Bot**（`data-testid="rail-peek"`，只在两栏时有）：头部整个滚到导航条下面以后，侧栏卡片的上沿右侧探出一只 28px 的它（露出上半身，弹簧 280ms 升上来），头部回到视野它就缩回去。侧栏吸顶跟着走的时候，一眼还认得出这是谁的导入按钮。它是活的（会眨眼、跟着光标看），鼠标移到侧栏上会睁大眼；纯装饰，`aria-hidden`、不接鼠标。用 `IntersectionObserver` 看头部，不监听滚动。减少动效时没有升降过渡。

### 9.3 主栏的区块

每块是一个 `section`：标题（圆体 h3 档 20px/600，到内容 16）+ 内容，不套卡片；块与块之间 64px（<680px 48px），正中一条 `--bz-hairline` 细线（头部到第一条细线 48）。要读的正文用 `--bz-detail-ink`（墨色 88% 压在页面底色上的实色），比二级灰亮一档。「技能」「定时任务」的标题后面跟一个数量（13px，`--bz-text-3`）。

顺序、`data-testid` 和内容：

| 区块 | testid | 内容 |
|---|---|---|
| 能做什么 | `section-about` | `about.intro` 一段（16px/1.75，最宽 44em）；下面 `about.does` 一列，每条前面一个 6px 的 **Bot 色圆点** |
| 开场白 | `section-starters` | `about.starters` 每条一个聊天气泡样子的按钮（`data-testid="starter"`），见下 |
| 截图 | `section-screenshots` | 只有仓库里放了截图的作者投稿 Bot 才有（投稿不收截图，DECISIONS 第 43 条）。≥768px 两列，16:10，圆角 12、细边，lazy，点开是新标签里的原图 |
| 技能 | `section-skills` | 平铺的两列（列宽不小于 320，放不下就一列），每项（`skill-item`）是名字（15px/600）+ 一句话（13px）。外部收录用 `about.skills`；作者投稿的用 `skills/` 目录里的（等宽的技能名，多一个「查看源码 ↗」） |
| 定时任务 | `section-routines` | `about.routines` 一条一行（`routine-item`），行间细线：上面小字是时间 `when`（13px，`--bz-text-3`），下面是做什么 `what`（15px）；右边是小字标记「默认开」（墨色，前面一个实心小圆点）或「默认关」（三级灰，空心小圆点），`quiet` 是「不打扰」的再加「没事不打扰」。「未说明」「照发」不出标记。标记不套标签的底：十个任务就是二十个标记，只留小字整列才安静。窄屏标记换到下一行。作者投稿的有 `routines.md` 时，下面一个链接「查看定时任务 ↗」 |
| 导入前准备 | `section-prereq` | `prerequisites` 列表，每条前面一个 4px 的小圆点。有 `about.cnNote` 时最后单独一行（`prereq-cn`）：前面一个 `globe` 图标，`title` 和读屏文本是「国内使用」 |
| 权限 | `section-permissions` | 一排中性标签（`.bz-tag`，间距 8，放不下换行）。每项的含义（`permissionCopy`）在标签的 `title` 和 `.bz-sr-only` 里 |
| 适合谁 | `section-fit` | 左右两栏（放不下就上下）：左边实心圆里一个对勾 + `about.fit`（`fit-yes`），右边浅底圆里一个叉 + `about.notFit`（`fit-no`）。不另加小标题，读屏读「适合：」「不适合：」 |
| 编辑点评 | `section-editor` | `editorNote`（策展文件的 `editorNotes`）：一个 24px 的 **Bot 色**引号图标挂在左边，点评 16px/1.75 |
| 设计说明 | `section-design` | 作者投稿的 Bot 才有。`vp-doc`、最大宽度 720px；里面的小标题 16px/15px，比区块标题低一级 |
| 所在小队 | `section-squads` | `bot.squads` 每支一行（`squad-link`），见下 |
| 同组的 Bot | `section-related` | 同一个分组里另外最多 3 个，按推荐顺序，见下 |

**开场白**：气泡是 `<button>`，贴着文字的宽度（最宽撑满主栏）、圆角 12、`--bz-surface-2` 底 + 细边，右边一个 `copy` 图标。悬停底亮一档、边染 Bot 色、图标变墨色。**点一下复制**这句话：图标换成 `check`，旁边出现「已复制」，边和图标变 `--bz-success`，1.8 秒后恢复；同一时间只有一条显示「已复制」；头部的 Bot 眨一下眼（`wink`）；读屏播报「已复制」（页面上唯一那个播报区）。键盘 Enter / 空格同样复制。不上报热度。剪贴板接口用不了时退回 `execCommand('copy')`，还不行就把这句话选中，按 ⌘C / Ctrl+C 就能带走。触摸设备上气泡高不小于 44。

**所在小队**：一行一张可点的卡（圆角 12、细边 + 内高光）：成员小头像（28px，不要方砖，间距 4，队长排最前，纯装饰）→ 小队名（圆体 16px/600）→ 它在队里的岗位（标签；队长是实心款 `.bz-tag.solid`）→ 最右一个 `chevron-right`。**整行可点**进 `/squads/<slug>`：DOM 里只有小队名那一个链接，用伪元素铺满整行。悬停边亮一档、淡入一层柔光、箭头变墨色，不位移。<680px 分两行：第一行小队名、岗位、箭头，第二行小头像。

**同组的 Bot**：≥680px 三张等宽卡并排（间距 16，内边距 16）：40px 的活 Bot（不要方砖，和首页列表卡一样）→ 名字（圆体 16px/600；有中文叫法的是「中文叫法 + 原名」，一行，§3.4）→ 一句话介绍（13px，最多两行）。<680px 竖排，Bot 在左、名字和介绍在右（介绍一行）。整张卡可点进那个 Bot 的详情页（同样只有名字一个链接）；悬停淡入一团它自己颜色的光、细边染色、Bot 睁大眼，不位移。

### 9.4 数据从哪来

完整摘要（含 `about`、`editorNote`、`squads`）在路由参数 `params.bot` 里。另外两样由 `site/.vitepress/data/detail.mjs` 在构建时算好，也放进路由参数（`site/bots/[slug].paths.mjs`），页面上不用再加载整份货架：

- `params.related`：`relatedBots(bots, bot)`，同组另外几个，只带 `slug`、`name`、`nameZh`、`avatar`、`tagline`、`detailUrl`。推荐顺序是「编辑置顶的在前（按 `pick`），其余上架新的在前，再按名字（显示出来的那个）」，也就是首页「推荐」排序去掉热度。
- `params.lineups`：`squadLineups(squads, bot)`，`{ 小队 slug: [{ slug, name, nameZh, avatar }] }`，队长排最前。

`BotDetail` 的 `related`、`lineups` 两个属性都有空的默认值，不传就没有对应的区块。小头像用 `BotMini.vue`（一只活 Bot；`bare` 是不要方砖）。

### 9.5 投稿预览

/submit 的「投稿预览」复用 `BotCard` 和 `BotDetail`（`preview` 注入）。预览容器只有 380px 左右宽：卡片靠容器查询自动用窄卡片版式（投稿包里写了 `nameZh`，名字照 §3.4 写成「中文叫法 + 原名」，窄了先截原名）；详情永远是单栏（根节点带 `.is-preview`，两栏的规则不对它生效），没有探头的小 Bot。预览里链接不跳走、不请求热度、数据不完整也不报错（数组和字符串都先验类型，不对的当作没写）；按钮是禁用的，下面一行「上架后可用」；开场白不可点；热度那一行新投稿显示「新上架」、更新显示「—」。缺少技能或设计说明时，分别提示「暂无技能说明。」「暂无设计说明。」；已有技能的源码入口和定时任务的链接分别显示为「上架后可查看源码」「上架后可查看」。预览不显示截图区；设计说明引用缺失的本地截图时只留下图片的说明文字。`styles/misc.css`、`home.css`、`detail.css` 里各有一小段专门把 `submit.css` 里针对旧版式的偏移归零。

### 作者主页

返回货架按钮下留 `--bz-sp-8`。圆头像在左，昵称和 GitHub handle 在右，垂直居中，间距 `--bz-sp-6`；头像宽屏 112px，≤640px 为 80px。Bot 和小队分别用原卡片网格，只显示非空区块，区块前留 `--bz-sp-8`。

作者主页归入 Bot 模块，页眉高亮 Bot 并显示滑块。直接打开也会加载卡片热度。卡片里指向本页的「by 作者」只显示纯文字。

头像 `loading` 时显示昵称首字：去掉前导空白，按字形取首字（不支持时按码点取），转大写（大写后会变成多个字母的，比如 ß、ﬁ，保持原样），空昵称显示 `?`。`image` 时首字留在 DOM 里但颜色透明，`fallback` 时移除失败的图片。水合时也核对加载结果。卡片及详情页不加头像；有 `author.page` 就在同页进入作者主页，不加外链提示或打点。其余作者外链及作者页的 handle 在新标签页打开，带外链提示、`noopener noreferrer` 和 `data-track-kind="author"`；投稿预览保持纯文字。

## 10. 空状态与出错

空状态只有一只 Bot、一句话（状态反馈）和一个按钮，没有解释。

| 情况 | 表现 |
|---|---|
| 无 Bot | 虚线框（`1px dashed var(--bz-border-strong)`、圆角 12、上下内边距 48）里居中：96px sleep Bot +「货架上还没有 Bot」（16px/600）+「做第一个投稿的人」（次级按钮，前面一个 `plus` 图标）；data-testid=empty-state；不显示主推、工具栏、计数和页尾（全站页脚照常） |
| 筛选无结果 | 同样式：96px sleep Bot +「这个分组还没有 Bot」+「看看全部」按钮（前面一个 `grid` 图标，点了回到「全部」）；data-testid=empty-filter。分组切换只列货架上有 Bot 的分组，所以只有从地址栏直接打开一个还空着的分组（`?role=学习` 这类）才会看到；这时计数是「共 0 个」，分组切换里没有选中项 |
| 搜索无结果 | 搜索面板里一只睡着的 Bot +「没找到，换个词试试」（货架为空时是「货架上还没有 Bot」） |
| 404 | 上下各留 96px，内容居中：120px 头像砖（`.bz-tile.s120`，砖背后一小团这只 Bot 颜色的光）里的 Bot 先 exclaim、再循环 thinking → 小字「404」（12px/600，`--bz-text-3`，`aria-hidden`）→「这一页走丢了」（h1 档 32px）→「← 回货架看看」（次级按钮，染这只 Bot 的颜色，前面一个 `arrow-left` 图标，到标题 32）。只有标题和返回按钮，没有说明句 |
| 详情页某块没内容 | 整块不渲染（主栏的每一块都是：没有定时任务就没有「定时任务」，没有权限就没有「权限」）；投稿预览例外，见 §9.5 |
| 热度失败 | 详情页侧栏的热度一行显示「—」，列表卡不显示热度；未手选时切最新，不弹错误；主推保持原样 |
| 自定义头像失败 | 回退该 slug 默认头像 |
| 截图失败 | 同尺寸占位块和「图片加载失败」 |

## 11. 减少动效与深色模式

`prefers-reduced-motion: reduce` 下保持 SSR 静态帧；无 rAF、跟随、变身、睡醒、入场、跳动、砖上浮、列表淡入、展开时的卡片淡入、展开箭头的旋转过渡、点专题后的平滑滚动（直接到位）、球池的掉落和拖动（直接摆在落定的位置）、排序滑块过渡，页面上没有任何在跑的 CSS 动画；气泡仍能开关，去位移缩放，只保留 120ms 透明度淡入淡出（覆盖 VitePress 全局 0s 规则）。

主题跟随系统，也可以用导航条上的开关切换；按 §1 token 切换，Bot 颜色、按钮色与柔光按 darkSwap 规则适配。浅深主题都验对比度，切换不用 JS 监听。

## 12. 验收要点

验收脚本在批次目录 `/Users/Admin/Documents/pi-prompts/2026-11-14-bot-zhipin-living/verify/`，不是仓库内目录。实现线跑 npm run check、隔离端口全部 e2e，vendor diff 为空、不越 scope、产物无 _worker.js。

1. **LB1**：idle 眼睛隔 1.5 秒不同；左右 ±300px 的眼睛平均 x 差 ≥10、上下 y 差 ≥6；rAF ≤75 次/秒；离屏 500ms 内暂停，隐藏停钟；reduce 首帧不变；SSR 有 body path、无 hydration 警告。burst 300ms 内生效、有粒子，2.6±0.6 秒回 idle 且双眼存在。
2. **LB2**：真脸数据与 25 轮廓合法、fixtures 不变；暗色换色对卡片底 ≥3:1；真实构建带官方色。
3. **LB3**：全卡进入 300ms 内 wide，typing 先出现，350+28×字数+300ms 内全文；离开 200ms 内关气泡、600ms 内 idle。键盘、触摸、单开回归通过；戳 200ms 内进集合、状态时长+0.6 秒内回 idle，连戳 alert；导入 200ms 内 comet 且正常上报/开页；复制 wink；30 秒睡眠、输入 300ms 内 exclaim、2.5 秒内 idle；会话首次有 swirl、刷新不重播。Hero、空货架、404 与真实脸接线通过。
4. **LB6**：黑眼睛、attentif 首帧、身体占比 ≥80%、SVG 特效外溢；九个分组的标签浅深对比度 ≥4.5（LB6 当时是旧的八类）、外部标签中性。（招牌只数和大小以本文件 §2.2 为准，LB6 的 7/5 只断言已被 LB8 取代。）
5. **LB9**：搜索面板的打开方式、键盘、焦点、对比度（`verify/lb9-search.spec.mjs`）。
6. **LB8**（`verify/lb8-raycast.spec.mjs`）：v4 的验收。里面和 v5 冲突的数（砖圆角 28、h1 80px、卡片圆角 16、头像 56、详情头像 160、按钮 ≥40、Bot 色实底按钮、斜向极光）已被 v5 取代，以本文和仓库 `tests/e2e/` 为准；其余（导航条、砖墙 9 块、搜索框、筛选排序、横向不滚动、减少动效、对比度）仍然有效。
7. **目视**：`verify/out/LB8/` 的截图和 Raycast 实测截图并排看：深色版是干净有质感的商店，同时一眼看得出是 Grok Bot 的世界；浅色版同样干净；手机版不挤。
8. **发布边界**：LB8 仅在 feat/raycast-look 提交，不推送、不开 PR；实际检查结果以交付说明为准。
9. **首页第二批**（主推的编辑点评、专题、工具栏、分组、专题筛选、地址栏还原）：仓库里的 `tests/e2e/home.spec.mjs`，排序和分组的纯函数另有单测 `tests/unit/shelf.test.mjs`。用例只从页面上读数，示例货架和真实货架都能跑。示例货架每个分组只有一个 Bot、折不起来，所以「展开 / 收起」和「退回来还在」这两条在它上面会跳过；要验这两条，把 `E2E_BASE_URL` 指到真实数据的预览再跑这个文件。

10. **中文叫法**（§3.4）：`tests/e2e/name-zh.spec.mjs` + `tests/unit/bot-name.test.mjs`。真实货架上再目视一遍：最长的几个名字（「Grok Bot 入门教练 Grok Bot Tutorial」「复习卡制作员 Flashcard Forge Desk」）在两列、单列、390 和 320 宽的卡片里都只占一行，「导入」没被挤走。

## 13. 标签页图标（favicon）

浏览器标签页上的小图标是一只 Bot：每次打开随机一只，开着的时候隔几秒变成另一只，眼睛跟着鼠标看。代码在 `theme/live/favicon.ts`，决策见 DECISIONS 第 33 条。

**长相**

- 和页面里的 Bot 同一个引擎出帧：纯色身体 + 两只深色竖胶囊眼睛（`#16161b`），正对前方。
- 镜头贴着身体外框，四边各留 6%，身体较长的一边占图标的 88%。坐标取整。
- 眼睛比页面里的大一号（宽 0.27、高 0.5，页面是 0.21 / 0.44），眼距 18°：缩到 16px 还看得出是两只眼。
- 颜色 7 种，就是招牌吉祥物那一套（`meta.mjs` 的 `HERO_MASCOTS`）。不取货架 Bot 的官方色，灰、黑、白在标签栏上看不清。
- 形状 18 种：blob、pebble、bean、egg、squircle、tablet、hex、gem、shield、dome、arch、cloud、leaf、clover、flower、heart、house、star。其余 7 种缩到 16px 后和别的撞脸或眼睛挤在一起，不用。
- 每次变化，形状和颜色都必须和上一只不同。
- 眼睛按身体轮廓裁切：看向边缘时，出了身体的部分不画。

**节奏**

| 时机 | 行为 |
|---|---|
| 脚本加载完 | 立刻换成一只随机 Bot（不带过渡）。页面自带的静态图标 `<link>` 被移走，只留一个带 `data-bz-favicon` 的 |
| 之后每隔 4–7 秒（随机） | 变成另一只。过渡 520ms，约 60ms 一帧：形状渐变，颜色沿色相环走近的一边过渡（不经过灰色），正中间闭一下眼 |
| 两次变身之间 | 眨一次眼（3 帧，共约 165ms），时间点在这段停留的 35%–65% 处随机 |
| 鼠标在页面里移动 | 眼睛跟着看。页面不知道图标在屏幕上的位置，所以按视口算：以视口中线为界，鼠标在左看左、在右看右（各 24°）；在上半看上（10°）、下半看下（16°）。视口分成 9 × 5 格，一格一档，同一格里挪动不换图；换图间隔不小于 60ms。变身和眨眼时视线保持 |
| 鼠标停住 4 秒、移出窗口、窗口失焦 | 视线回正。触摸不触发跟随 |
| 标签页在后台 | 照样换，但一步到位，不放过渡帧，不眨眼。浏览器会给后台定时器降频（Chrome 在后台 5 分钟后降到每分钟一次），变化会随之变慢 |
| 过渡中途切到后台 | 立刻落到新 Bot 的静止帧 |
| 站内跳转 | 图标元素不换，节奏不重置；中途冒出来的静态图标 `<link>` 会被再次移走 |
| `prefers-reduced-motion: reduce` | 打开时随机一只，之后不再变、不眨眼、不跟鼠标；关掉这个系统设置后恢复 |

停留期间图标是一张静止的图，不写 DOM；图没变就不重复赋值。

**DOM 约定**

`head > link[rel="icon"][data-bz-favicon]`：`href` 是 `data:image/svg+xml,` 开头的地址，`data-shape`、`data-color` 标注当前（过渡中则是目标）这只 Bot，`data-follow` 是 `pointer`（正跟着鼠标）或 `rest`。

**静态兜底**

`site/public/` 下三个文件，在 `config.mts` 的 `head` 里声明，给没有脚本、不支持 SVG 图标或不跟随运行时换图的环境用：`favicon.svg`、`favicon.ico`（32×32）、`apple-touch-icon.png`（180×180，深色底 `#141418`）。画的都是招牌正中那只橙色圆团（`FAVICON_DEFAULT`）。改了画法后运行 `npm run gen:favicon` 重新生成并提交，单测会检查 `favicon.svg` 有没有跟上。

**验收**

- `tests/unit/favicon.test.mjs`：名单、随机、每种形状的取景和眼睛位置、视线映射和上限、眨眼、过渡节奏、静态文件。
- `tests/e2e/favicon.spec.mjs`：真浏览器里随机、定时变化、过渡帧、视线跟随与回正、后台、减少动效、站内跳转。
- 无头浏览器没有标签栏。改了长相后要把图标按 16px（1 倍和 2 倍像素）画出来，放在浅色、深色标签栏底色上目视；还要在真实浏览器里开着页面看一眼标签页。
- 没在 Safari 上实测。Safari 对 SVG 图标和运行时换图的支持历来不完整，预期它显示静态图标。

## 14. 小队

几个 Bot 组成一支小队一起干活。成员还是货架上的普通 Bot（各有各的卡片和详情页，可以单独导入），小队只是加在上面的一张编制表：谁是队长、每人在队里干什么、谁把什么交给谁、怎么组队。Grok Bot 没有批量导入，所以组队是「逐个导入 + 照着步骤接线」，小队页带着人把这个过程走完。数据约定见 `schema/squad.schema.json` 和 `scripts/lib/squad-summary.mjs`。

代码：`theme/squad.ts`（排版计算，纯函数）、`components/SquadLineup.vue`（合影）、`SquadCard.vue`、`HomeSquads.vue`、`SquadFlow.vue`（流程图）、`SquadDetail.vue`、`BotStill.vue`（不会动的小 Bot）、`styles/squad.css`。固定文字全在 `meta.mjs` 的 `SQUAD_COPY`。

### 14.1 固定文字

界面上不放解释性的句子（§0 第 6 条）。小队相关的固定文字只有这些，其余全是数据：

| 在哪 | 文字 |
|---|---|
| 首页区块标题 | 「小队」 |
| 小队卡、小队页头部、搜索条目 | 标签「小队」；队形名（带队 / 接力 / 搭伙，数据）；「N 个 Bot」 |
| 小队卡的名单 | 有队长：「<队长的队内岗位> <队长名字> · 专员 N 个」；没有队长：成员名字用「 · 」连起来。名字是界面上叫它的那个（有中文叫法用中文叫法），这一行不带原名（§3.4） |
| 招募卡 | 按钮「投稿小队」 |
| 小队页 | 「返回货架」「开始组队」；区块标题「阵容」「怎么配合」「组队步骤」「整队的代价」「要知道的事」；标签「可选」「未收录」；按钮「导入」「复制」；反馈「已复制」；进度「已导入 2 / 5」；小标题「额度」「权限」「导入前准备」；流程图节点「你」 |
| 只给读屏 | 「（在新标签页打开）」「交给」（流程文字版里箭头的读法）、「<成员名> 已导入」（打勾按钮的名字） |

额度档位和权限的含义（和 Bot 详情页同一份）只放在 `title` 和 `.bz-sr-only` 里。

### 14.2 合影（`SquadLineup`）

一块舞台面板，成员站在同一块地面上，看起来是一队人，不是一排头像。整块 `aria-hidden`。

- **站位**由 `squad.ts` 的 `lineup(members, formation, variant)` 算，返回每个成员的横向偏移、离地高度、身体大小、层级、从左到右的序号和常驻视线：
  - 有队长：队长最大、站正中最前面、层级最高；其余成员按数据顺序分站两边（前一半在左），离队长越远站得越靠后（离地更高、层级更低）。
  - **小合影里人多时站两排**（`card`，队长 + 3 个以上队员）：像真的合影。前排是队长和左右各一个（60，中心距队长 60，离地 4）；其余在后排（56，离地 54），先占队长左右肩后的两个空当（±30），再往外（±92），只露出上半张脸。从左到右仍是数据顺序；每张脸都看得见，Bot 也能按原大画。
  - 接力：一字排开，奇数位靠后一点。搭伙：同样一字排开，前后错落更大。
  - 两边人数不一样时把整队挪回正中。
- **两种尺寸**（一排时）：

| | 队长 | 队员 | 最近的队员到队长 | 队员之间 | 离地（近 / 远） |
|---|---|---|---|---|---|
| `card`（首页小队卡） | 80 | 60 | 62（压住 8） | 50（压住 10） | 4 / 10 |
| `stage`（小队页头部） | 120 | 96 | 116 | 104（几乎挨着） | 14 / 26 |

  数字是身体的大小：活体画布四周有一圈放动效的余量（身体约占 89%），样式里把画布放大到 112%。整队按面板的宽高等比缩进去（面板是尺寸容器，用 `cqw` / `cqh` 算缩放系数 `--u`），最大 1:1；所以 6 个人的队、390 宽的手机都放得下。
- **看向队长**：队员的常驻视线朝着队长（近的 10°、远的 16°；两排时前排 10°、后排 6° 并略往下看；`LiveBot` 的 `look`，§4），队长看镜头。接力队形里前一个看着后一个。鼠标一动，全队一起看向鼠标；鼠标停 4 秒后各自看回去。
- **光**：每只脚下一团自己颜色的椭圆光（`.photo-pool`，Bot 色 72% 混透明、模糊 12px，整层不透明度深色 .5、浅色 .42），混在一起就是这支队的颜色；地面另有一道很淡的中性椭圆光。光单独一层、裁在面板里；Bot 在另一层，戳出来的粒子可以画到面板外面。每只脚下一小块椭圆影子。
- **贴纸边**：互相压住的地方要分得开。身体垫底那层（`[data-part="body"]`）描一圈 5px 的面板底色（深色 `#0a0b0d`、浅色 `#f7f6f3`），露在身体外面的一半（2.5px）就是一圈细边。不用滤镜。
- 面板：圆角 12（小队页是 16），底比卡片亮一档（白 / 黑 2.5%），细边 + 内高光。

### 14.3 首页的「小队」区块（`HomeSquads`）

`<section id="squads" class="shelf-section" aria-labelledby="squads-title">`，排在「本周主推」后面。只有标题「小队」和卡片。一支小队都没有时整块不渲染。`BotShelf.vue` 里只有一行 `<HomeSquads />`。

- **网格** `.squad-grid`：两列、间距 16；<900px 单列。每支小队一张卡，最后补一张招募卡。
- **小队卡** `[data-testid="squad-card"]`（带 `data-slug`）：圆角 16、内边距 12、细边 + 内高光，最小高 208。左边 250px 是合影（`card` 尺寸），右边自上而下：
  1. 一行标签：「小队」（`.bz-tag`，前面一个 12px 的 `users` 图标）、队形（`.bz-tag`，`squad-card-formation`）、「N 个 Bot」（12px/600 `--bz-text-3`，`squad-card-count`）。
  2. 小队名（`h3`，h3 档 20px/600 圆体），到标签 12。
  3. 一句话介绍（15px/1.6 `--bz-text-2`，最多两行），到名字 4。
  4. 名单（13px `--bz-text-3`，一行，多了省略；`squad-card-roster`），到介绍 12。
- **没有按钮，整卡可点**：名字的链接用 `::after` 铺满整卡（`z-index: 2`，盖在合影上面），DOM 里只有这一个链接；点合影等于点卡片。
- **悬停**（鼠标）：全员变 `wide`，从左到右依次跳一下（`bz-bounce`，每只晚 80ms）；细边加深到 `--bz-border-strong`，脚下的光变亮。卡片不位移。离开后回 `idle`。
- <680px：合影在上（高 168）、文字在下。
- **招募卡** `[data-testid="squad-recruit"]`：同样大小，`1px dashed var(--bz-border-strong)`，内容居中：三只空位（`BotStill` 的 `ghost`：一圈虚线轮廓 + 两只淡淡的眼睛；中间那只大一号，是队长的位置）→ 「投稿小队」（`.bz-btn.sm`，`plus` 图标，新标签页打开仓库 `CONTRIBUTING.md` 的「投稿小队」一节）。没有别的字。按钮的可点范围铺满整卡。

### 14.4 小队详情页（`/squads/<slug>`，`SquadDetail`）

最大宽 1140，单栏。`data-testid="squad-detail"`（带 `data-slug`）。块与块之间 64（<680px 48），正中一条 `--bz-hairline` 细线；区块标题 h3 档 20px/600 圆体，到内容 24。全页只有一个实心主按钮「开始组队」。

**头部** `squad-header`：「← 返回货架」（幽灵小按钮）→ 合影舞台 `[data-testid="squad-stage"]`（整宽，高 280、<680px 200，圆角 16，`stage` 尺寸）。每只脚下一块小名牌（`.photo-plate`，12px/600，高 22，最宽 96）写着它**在队里的岗位**；队长那块是实心的（墨底），和阵容表里的「队长」标签同一种画法。<680px 不画名牌。悬停某只：它睁大眼跳一下；点谁戳谁（和货架共用同一个 slug 的戳历史）。舞台下面一行两栏：左边是标签行（「小队」、队形 `squad-formation`、「N 个 Bot」`squad-count`、`by 作者` `squad-author`（见「作者主页」）、「· 来源」`squad-origin`）→ 小队名 `h1`（h1 档）→ 一句话介绍（16px `--bz-text-2`，`squad-tagline`）；右边贴底是「开始组队」`squad-start`（`.bz-btn.primary`，高 44，`arrow-down` 图标）：平滑滚到组队步骤（减少动效时直接跳），焦点移过去，地址栏写上 `#setup`。<680px 上下排，按钮撑满。

**阵容** `squad-roster`：一张编制表（圆角 12 的面板，行与行之间细线），一行一个成员 `[data-testid="squad-member"]`（带 `data-slug`、`data-lead`），行高约 72：

- 四列：48 砖（活 Bot，`aria-hidden`，点它是戳）｜名字（title 档圆体，`member-link` 链到它的详情页；有中文叫法的是「中文叫法 + 原名」，§3.4）+ 队内岗位标签（`member-title`；队长是实心的 `.bz-tag.solid`）+「可选」（`member-optional`）｜它在队里负责什么（15px `--bz-text-2`，`member-does`）｜「导入」（`member-import`，`.bz-btn.sm`，染这只 Bot 的颜色）。
- **整行可点**进这个成员的详情页（名字的链接铺满整行）；砖和「导入」在链接上面。悬停：从头像一侧漫出一点这只 Bot 的颜色，Bot 变 `wide`。
- 「导入」和货架上的一样：照常上报这个 Bot 的导入（`reportClick(slug, 'import')`），新标签页打开模板页，舞台上和这一行的 Bot 播 `comet`。点过以后图标从 `arrow-up-right` 换成绿色的 `check`（`data-done="true"`），文字不变。
- 原套装里有、本站没收的成员（`missing`）排在最后 `[data-testid="squad-missing"]`：虚线空位砖、名字和介绍用三级灰、标签「未收录」，没有链接也没有「导入」。
- 名字那一格宽 400（≥900px）：「中文叫法 + 原名 + 岗位标签 + 可选」放在一行里，放不下先截原名，标签不往下掉。<900px 这一格独占一行，放不下时照旧让标签换行。
- <900px：介绍换到名字下面；<680px：「导入」再换到最下面。

**怎么配合** `squad-flow`：见 §14.5。数据里没有 `flow` 时整块不渲染。

**组队步骤** `squad-setup`（`id="setup"`）：一列编号的步骤（`.setup-step`，带 `data-step`），左边 28px 的圆形编号，编号之间一条细线连着。内容最宽 760。顺序：

1. **导入**（`data-step="import"`）：标题就是进度「已导入 2 / 5」（`setup-progress`），后面一条进度条：一格一个成员，导入了就亮成它的颜色。下面是成员清单（`setup-member`）：打勾的圆（`member-check`，`aria-pressed`，读屏名「<名字> 已导入」）+ 小头像 + 名字（14px/600；有中文叫法的后面跟 12px 的原名，就在「导入」旁边，方便和模板页对上）+「导入」（`setup-import`，幽灵小按钮）。点任何一处的「导入」都会自动打勾；也可以自己点圆圈勾上或取消。全部导完，这一步的编号变成实心的对勾。
2. **数据里的接线步骤**（`setup`，每条一步）：标题（title 档圆体）+ 说明（15px `--bz-text-2`）。
3. **组队口令**（`kickoff`，`squad-kickoff`）和 4. **第一句话**（`tryout`，`squad-tryout`）：各是一条「发给队长」的消息：上面一行是 `send` 图标 + 队长的小头像 + 队长名字（只写中文叫法；没有队长就不显示收件人），右边「复制」（`copy-kickoff` / `copy-tryout`，幽灵小按钮）；下面是正文（保留换行）。复制成功：图标换成 `check`、文字换成「已复制」、读屏播报，1.8 秒后恢复，舞台上的队长眨一下眼。复制不了时把正文选中，方便手动复制。

V5-DESIGN 把口令排在接线步骤前面；现在的示范小队里，接线步骤讲的是「分五次导入」「先让每个成员走完首次设置」，要在发口令之前做，所以实现成：导入 → 接线 → 口令 → 试一句。

**已导入的成员只记在本机**：`localStorage` 的 `bz-squad-<slug>`，值是成员 slug 的 JSON 数组（`squad.ts` 的 `parseImported` 只认字符串数组，并且只留这支队里真有的成员）。挂载后才读，所以服务端渲染出来永远是 0。另一个标签页改了会跟着同步。存不了（隐私模式）时这次访问里照常打勾。

**整队的代价** `squad-cost`：三块卡片（圆角 12）。左边一栏上下两块：「额度」（`squad-quota`：每个成员一行，小头像 + 名字 + 三格强度条 + 低 / 中 / 高，「高」用 `--bz-quota-high`；这三块里成员的名字只写中文叫法，原名在 `title` 里）和「权限」（`squad-permissions`：并集，每项后面跟着用到它的成员的小头像）；右边占两栏的是「导入前准备」（`squad-prereq`：按成员分组，两列）。<900px 全部单列。

**要知道的事** `squad-notes`：`notes` 两列排开（<900px 单列）；每条的第一句（到第一个句号）用墨色 500，后面的用 `--bz-text-2`。

没有内容的块整块不渲染（流程、导入前准备、要知道的事）。页面底部没有来源说明：来源写在头部的标签行里。

### 14.5 流程图（`SquadFlow` + `squad.ts` 的 `flowLayout`）

一张能看懂「谁把什么交给谁」的图。排版是纯函数 `flowLayout(squad, width)`：给画布宽度，返回节点坐标、每条线的 SVG 路径、箭头位置和标签位置。1:1 画，不缩放：服务端按 1140 宽排；挂载后用 `ResizeObserver` 量容器宽度重排（最窄 616）。比 1204 窄的桌面在量好之前先不露出来（`.is-ready`）。线画在一张 SVG 里，节点和标签是叠在上面的 HTML。

- **带队**（四层，自上而下）：交东西给队长的「你」→ 队长 → 其余成员一排 → 收东西的「你」。
  - 你和队长之间是竖线；两个方向都有时并排两条，往下的在左、标签在线的左边，往上的在右、标签在右边。队长交回给你的东西回到上面那个「你」。
  - 队长和队员之间是圆角折线（像组织架构图）：从队长脚下正中出发，共用一条横线，再沿每个队员头顶那一列落下；标签叠在这一列上，所有标签排成一行。队员回给队长的线走低 10px 的另一条横线。
  - 队员一排均分画布，每格最宽 264（人少时不摊开，整排居中）。队员之间：相邻的走一条横线，标签在线的正中；隔着人的从名字下面绕，各占一条道。
  - 队员交回给你的：沿各自那一列往下，汇成一条横线，落到下面那个「你」的头顶。
- **接力**（或没有队长的其他情况）：从左到右一条线，交出东西的「你」在最左，收东西的「你」在最右。相邻的走直线，标签在这一排上方（都放得下就排一层，有放不下的才高低两层错开）；隔着人的，往前的从上面绕、往回的从名字下面绕。
- **搭伙**：成员围成一圈，「你」在中间；上半圈的名字写在砖上面。你和成员之间是直线：只有一个方向时标签压在线上，一来一回时两条线并排、标签各放在自己那条线的外侧。成员之间的线往外鼓。
- 同一对节点、同一方向的几条合成一条线，标签里一行一条。数据里没有出现的那个「你」不画。
- **节点**：成员是 56 砖里一只活 Bot（点它是戳），砖下面两行字：名字（13px/600；只写中文叫法，原名在 `title` 里）和队内岗位（12px `--bz-text-3`）；队长的字在砖右边（下面要出线）。「你」是一个 56px 的中性圆，里面一个「你」字。
- **线**：1.5px，`--bz-text-3` 的 62%，末端一个小箭头。**标签**：12px/600、`--bz-card` 实底、细边、圆角 8，压在线上；太长就折行（宽度不超过这一列）。
- **小光点**：每条线上一个 2.5px 的点，从交出的一方走向接手的一方，6 秒一趟，各条线错开 0.6 秒；颜色是交出那只 Bot 的颜色（「你」是墨色）。用 CSS 的 `offset-path` 做。
- **悬停**某个节点（鼠标）：和它相连的线、箭头变成它的颜色（「你」是墨色），相连的标签变亮；其余的线降到 22%、标签 28%、节点 40%，不相连的线上的光点不显示。
- **文字版** `[data-testid="squad-flow-list"]`：一条一行，上面是交接的东西（15px/600），下面是「小头像 + 名字 → 小头像 + 名字」（箭头给读屏念成「交给」）。≥680px 视觉上收起、只给读屏；<680px 不画图，直接显示文字版。图本身 `aria-hidden`。

### 14.6 搜索面板里的小队

`SearchPalette` 在 Bot 后面多一组「小队」（最多 3 支）：没输入时列在「全部 Bot」后面；输入后 Bot 那组的小标题是「Bot」。条目 `[data-testid="search-squad"]`（带 `data-slug`）：32px 的头像位里一张小合影（三只 `BotStill`：队长在前面正中，两个队员在后面左右）+ 名字 + 一句话介绍，右边标签「小队」。上下键在 Bot 和小队之间连着走，回车或点击进小队页。读屏播报的结果数带上小队（「找到 3 个 Bot，1 支小队」）。

`search.ts` 的 `searchSquads(squads, query, limit = 3)` 复用 `searchBots` 的规则：名字最重；其次是「小队」两个字、队形、作者；最后是介绍、slug、成员的名字（原名和中文叫法都算）和队内岗位。

### 14.7 不会动的小 Bot（`BotStill`）

20–28px 的小头像（名单、流程文字版、代价、搜索条目）用它：和活体同一个引擎出的第一帧，只画一次，不进共享时钟。颜色和眼睛的规则同活体（深色主题近黑换奶白等）。`ghost` 只画一圈虚线轮廓，表示空位。

### 14.8 减少动效、可用性

- `prefers-reduced-motion: reduce`：合影不跳，流程图的光点不显示，「开始组队」直接跳到位；Bot 停在静态帧（队员仍然看着队长）。页面上没有在跑的 CSS 动画。
- 键盘顺序（小队页）：返回货架 → 作者 → 开始组队 → 每个成员的名字、导入 → 组队步骤里每个成员的打勾、导入 → 复制 ×2。合影、流程图、砖里的 Bot 都不进 Tab 顺序。
- 触摸目标：按钮在触摸设备上高 44；打勾的圆点按范围向外扩 12px。
- 320–1440 任何宽度不横向滚动。

### 14.9 验收

- `tests/unit/squad-layout.test.mjs`：站位（队长最大最靠前、视线方向、2–6 人都居中装得下）、名单一行、流程图三种队形（节点在画布里、标签互不压住也不压节点、各种少见连法、边界）、本机记录的解析、`searchSquads`。
- `tests/e2e/squad.spec.mjs`：首页区块（位置、内容、整卡可点、键盘、悬停、招募卡）、小队页（结构、导入上报和进度、刷新后还记得、开始组队、复制、戳、看向队长）、流程图（宽屏、悬停、手机文字版、窄桌面重排）、六种宽度不横滚、减少动效、搜索面板。
