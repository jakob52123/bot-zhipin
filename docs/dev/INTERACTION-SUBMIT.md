# 投稿页交互与视觉规格（第二期 · `/submit`）

> 投稿页只有三步：① 检查投稿包 → ② 用 GitHub 登录 → ③ 授权并提交。预览在检查后即可查看，不需要登录。决策 43 去掉的截图步骤见附录。

本文件是 L4「投稿页交互实现」的依据，和 `docs/dev/SUBMIT.md`（接口契约）配套。视觉沿用第一期 `INTERACTION.md`：这里只写新增的部分，凡是写「同第一期 §N」的，数值、行为都照第一期来。
数值是目标值，可以 ±2px 微调，但不能破坏 §16 的验收要点。

> **2026-11-15 换皮（设计系统 v5）**：投稿页的视觉换成了和首页同一套（`INTERACTION.md` §0、§1、§1b）。流程、状态、文案、`data-testid`、键盘和读屏行为都没动，§16 的验收要点全部照旧。本文 §1–§14 里换皮前的像素值（20 的圆角、28 的实心序号、2px 虚线框、14px 和 18px 的字、没有图标的按钮等）已经过时，**视觉取值以 §1.3 为准**。

## 0. 原则与范围

1. **一页做完**：投稿人从 AI 给的链接进来，在这一页看预览、登录、提交、看进度，不用再去 GitHub 填表。唯一会跳出去的是 GitHub 登录授权页。
2. **先看后做**：不登录也能看到预览和检查结果；登录只在提交之前。
3. **任何错误都给下一步**：每条报错都要说清「怎么办」，能交给 AI 改的，给一个「复制给 AI」按钮，复制出来的文字 AI 拿到就能直接改。
4. **不丢东西**：解开的投稿包在刷新、登录跳转、会话过期后都还在（§3.3）。
5. **文案口语、短句、不吓人**。界面上除了「GitHub」「PR」「CC BY 4.0」「slug」这几个词，不出现英文。「PR」第一次出现时写成「PR（合并请求）」。
6. 视觉只用第一期 token 和本文 §1 新增的几个 `--bz-` token，不另起一套。

## 1. 新增 token 与沿用的组件

### 1.1 新增 token（写进 `style.css` 的 `:root` 和 `.dark`）

| token | 浅色 | 深色 | 用途 |
|---|---|---|---|
| `--bz-danger` | `#b91c1c` | `#f87171` | 错误标题、错误图标（取值同 `--bz-quota-high`） |
| `--bz-warning` | `#b45309` | `#fbbf24` | 「提醒」类非阻断信息（取值同 `--bz-quota-mid`） |
| `--bz-success-text` | `#15803d` | `#4ade80` | 成功状态的**文字**（`--bz-success` 浅色在白底只有约 3.3:1，小字不达标，文字改用这个；图标、边框仍用 `--bz-success`） |
| `--bz-radius-panel` | `--bz-r-panel`（16px） | | 换皮后只是 `--bz-r-panel` 的别名，样式里不再直接用 |

提示条统一三种底色：中性 `--bz-surface-soft`；错误 `color-mix(in srgb, var(--bz-danger) 8%, var(--bz-paper))` 加 1px `color-mix(in srgb, var(--bz-danger) 35%, transparent)` 边框；成功同理换成 `--bz-success`。圆角 12px，内边距 12px 16px，14px / 行高 1.7。

### 1.2 沿用

| 沿用什么 | 来源 | 本页怎么用 |
|---|---|---|
| `.shelf-page` 容器 | 第一期 §2 | 投稿页根元素，`max-width: 1120px` |
| `.shelf-button` / `.shelf-button.primary` | 第一期 §3 按钮行 | 所有按钮。高 40px，触摸设备 44px |
| 分段控件 `.sort-controls` 样式 | 第一期 §5 | 预览区「卡片 / 详情页」切换 |
| `.shelf-button.copied` 复制成功态 | 第一期 §3 | 「复制投稿提示词」「复制给 AI」成功后 1.8 秒显示「已复制 ✓」 |
| 手动复制对话框 `.prompt-fallback` | 第一期 §7 | 复制失败时用，标题和说明见 §4.3 |
| 外链标记 `ExternalHint` | 第一期 §6 | 所有新标签打开的链接 |
| `LiveAnnouncer` 播报区 | 第一期 | 全页唯一的读屏播报区。`announce.ts` 要加一个通用的 `announce(text)`（先清空、`nextTick` 后再写），本页所有播报都走它 |
| `BotCard`、`BotDetail`、`BotActions`、`BotHeat`、`BotAvatar` | 第一期组件 | 加 `preview` 属性后用于预览区（§6） |
| 焦点样式 | 第一期 §3 | `.shelf-page :focus-visible` 的 2px 墨色描边，本页不改 |

### 1.3 v5 换皮后的视觉取值（以此为准）

样式都在 `theme/submit/submit.css`，选择器全部收在 `.submit-*` 之下。只用 `INTERACTION.md` §1.1 的阶梯和 §1b 的公共部件；投稿页自己的 token 只有 §1.1 那四个，外加文件里几个 `--sb-*` 派生量。

| 部件 | 现在的样子 |
|---|---|
| 类名 | 按钮用 `.bz-btn`（`.primary`、`.ghost.sm`）；标签用 `.bz-tag`；分段控件是 `.bz-seg`，同时留着 `sort-controls`（测试靠它找轨道）；两个链接式按钮（「改用 GitHub Issue 投稿」「查看 PR」）同时留着 `shelf-button`（§16 第 25 条按 `a.shelf-button` 量高度）。图标用 `SubmitIcon`：全站那套加 `theme/submit/icons.ts` 里多出来的 13 个，画法一样（24 网格、线宽 1.5、圆头）。GitHub 标志是品牌图形，仍是实心的内联 SVG |
| 圆角 | 按嵌套分三层：步骤卡、预览面板 16 → 报错条目、指南小卡、提示词卡 12 → 提示条、输入框、slug 小标签 8。勾选框 6、进度条 2 是小件 |
| 字 | 页头 h1 档（32，圆体），导语 16；步骤标题 h3 档（20，圆体），结果面板标题 h2 档；正文 15；提示条、说明、阻塞清单 13；状态短语、文件名、slug、错误编号 12。没有 14 和 18 |
| 网格 | ≥1024px 两列 `minmax(0, 1fr) 420px`，列间距 32；卡与卡间距 16 |
| 步骤卡 | 细边 `--bz-hairline` + 内高光，底 `--bz-surface-1`，内边距 24（<768px 20）。头部：24 的序号圆 + 标题 + 右侧状态短语（和首页区块标题右边的计数同一个样子）。序号：当前步是玻璃圈加墨色数字；完成是淡绿底的对勾；出错是淡红底的叹号。提交中其余步骤淡到 0.5 |
| 按钮 | 所有按钮高 ≥40（触摸 44）；实心主按钮高 44，**一屏只有一个可点的**：指南里是「复制投稿提示词」（「读取」是次级），流程里是当下该做的那一步（投稿包有错时是 ① 的「复制给 AI」，登录按钮退成次级）。按钮一律「图标 + 动词」。文字按钮是幽灵小按钮：占位 40 高，悬停的底和键盘焦点框只画中间 32 |
| 复制成功 | 图标从 copy 换成对勾，文字仍是「已复制 ✓」，其中「✓」留在 DOM 里但不显示（和货架的复制按钮一个样）。实心按钮复制成功时保持实心 |
| 提示条 | 圆角 8，内边距 12×16，13px。中性：`--bz-surface-2` 底 + 细边；出错：底不变（危险色 8% 混 `--bz-paper`），边是危险色 32%。出错条的标题 15px / 600，前面一个警示图标。备用通道（改用 Issue 投稿）在条里自成一组，上面一条细线 |
| 行内链接 | `.submit-link`：墨色加下划线。点按范围用伪元素上下各撑 10（触摸 12），不再用 `inline-block` 加内边距（那样会把行距撑开）。待审 PR 列表里的链接挨得近，直接每行 40 高 |
| 指南 | 三步小卡和首页主推卡同一种格子（三列、间距 16；≤899px 竖排成「砖在左、字在右」），图标 20，放在 40 的小玻璃砖里。提示词和「复制投稿提示词」收进同一张玻璃底的卡。「已经有投稿包了？」收起时是 56 高的一行，箭头展开时转 90° |
| 报错清单 | 每条诊断是一张小卡（和详情页技能条目同一个样子）：文件路径 13px 等宽加粗、前面一个文件图标；「位置 / 问题 / 改法」标签 13px 三级灰，内容 15px |
| 勾选框 | 自己画的 20 方块：没勾是玻璃底加一圈边，勾上是实心（深色白底、浅色墨底）加对勾。仍是原生 checkbox |
| 结果面板 | 左边一列 40 宽：上面是 40 的淡绿对勾，下面是四个 20 的进度点，连线 1px；标题、说明、按钮都在右边同一条左边线上（<768px 不缩进）。当前这一步的点有一圈慢慢散开的光环（2 秒一次，减少动效时不动）。左上角垫一团这只 Bot 颜色的柔光 |
| 预览面板 | 顶上垫一团这只 Bot 颜色的柔光（颜色由 `SubmitPage` 按列表卡同样的取法给到网格上）。≥768px 头部排成一行：标题和说明在左，分段控件在右，再往右是「收起预览」（≥1024px 不显示）；<768px 分段控件撑满一行。面板里的标题按手机那一档字号走。详情预览的头像靠左，和真实详情页在手机上一致。<768px 面板内边距 16，让里面那张卡尽量接近真实宽度 |
| 分段控件的选中块 | §16 的「预览切换」用例把它钉成两种主题下都是 `#141418` 底、白字。深色在这个底色上再叠一层 10% 的白，看上去和首页的一样；**浅色是墨色块配白字，和首页的白块不一样**。要完全一致，得先改那条用例里的两个颜色断言 |

## 2. 页面结构与布局

### 2.1 地址

| 地址 | 含义 |
|---|---|
| `/submit` | 有暂存的投稿就接着做（§3.3），没有就进入指南模式（§4） |
| `/submit#BZB1:…` | AI 给的投稿链接。读出 `#` 后的令牌，存进 sessionStorage，再用 `history.replaceState` 把地址改回 `/submit`（避免长链接留在地址栏和浏览记录里） |
| `/submit?login=ok｜cancelled｜failed｜expired` | 从 GitHub 登录回来。处理完同样 `replaceState` 去掉参数 |

### 2.2 自上而下的结构（DOM 顺序 = 读屏和 Tab 顺序）

1. 内置浏览器提示条（§12，只在微信等环境出现）
2. 页头：h1 + 一句导语
3. 有投稿包时：
   - 步骤 ① 检查投稿包（`step-check`）
   - 预览区（`preview`，§6）
   - 步骤 ② 用 GitHub 登录（`step-login`）
   - 步骤 ③ 授权并提交（`step-submit`）
4. 提交成功后，①–③ 整体换成结果面板（`submit-result`，§10.2），预览区保留。
5. 指南模式只有页头 + 指南（§4）。

### 2.3 三种宽度

| 宽度 | 布局 |
|---|---|
| ≥1024px | 两列网格 `grid-template-columns: minmax(0, 1fr) 420px; gap: 32px`。左列放 ①②③；预览区在右列，`grid-row: 1 / span 4`，`position: sticky; top: calc(var(--vp-nav-height) + 24px)`，`max-height: calc(100dvh - var(--vp-nav-height) - 48px)`，内容超出就在面板内部滚动。预览区默认展开，不显示折叠按钮 |
| 768–1023px | 单列，预览区排在 ① 之后，**默认展开**，顶部有「收起预览」按钮 |
| <768px | 单列，预览区默认**收起**，只露出一行：「预览上架后的样子」+「展开预览」按钮。容器左右内边距 16px（≤680px 时，同第一期） |

- 页头：h1 32px / 700 / 行高 1.25 / `--bz-ink`（<768px 26px）；导语 15px / `--bz-text-2`，最大宽度 36em。页头下距 32px。
- **步骤卡**：1px `--bz-border`，圆角 `--bz-radius-panel`，背景 `--bz-paper`，内边距 24px（<768px 20px），卡与卡间距 16px。
- **步骤卡头部**：
  - 左边是 28px 圆形序号。当前步：`--bz-ink` 底、`--bz-paper` 字；已完成：`--bz-ink` 底加 ✓；出错：`--bz-danger` 底加「!」。
  - 中间是标题，18px / 700。
  - 右边是状态短语，13px / `--bz-text-3`，比如「已通过」「未登录」「要修改」。
  - 步骤卡根元素带 `data-state="current|done|error"`。
- 页面在 320px 宽时不出现横向滚动。

## 3. 状态总览

### 3.1 状态机

```text
                 ┌────────── 无令牌、无暂存 ─────────► 指南模式 guide
进入 /submit ────┤
                 └── 有令牌或有暂存 ─► 解包 decoding ─┬─► 包损坏 bundle-error ──「重新粘贴」──► guide
                                                     └─► 校验 validating ─┬─► 未通过 invalid（可「复制给 AI」）
                                                                          └─► 通过 valid
valid ─► 登录 ─► 授权 ─► 提交 submitting ─┬─► 成功 submitted ─► 轮询进度 ─► 已上线 live
                                          ├─► 未通过 invalid（422，回到 ① 显示错误）
                                          ├─► 被限流 / slug 被占 / 未合并太多
                                          └─► 后端不可用 ─► 改用 Issue 投稿（备用）
```

登录（§7）有自己的子状态，与上面的主流程并行。

### 3.2 各步骤何时解锁

| 步骤 | 解锁条件 | 锁定时的提示 |
|---|---|---|
| ① 检查投稿包 | 解包成功 | — |
| ② 用 GitHub 登录 | 解包成功即可（检查没通过也能先登录） | — |
| ③ 授权并提交 | 始终可勾选授权；提交按钮要等全部条件满足（§9） | — |

### 3.3 本地暂存（都包在 try/catch 里，读写失败就当没有）

| 存什么 | 存哪里 | 何时清除 |
|---|---|---|
| 投稿包明文、令牌、授权状态 | sessionStorage `bz-submit` | 点「再投一个」「换一个投稿包」时 |
| 提交结果（PR 号、slug、是不是更新） | sessionStorage `bz-submit` 里的 `result` 字段 | 点「再投一个」时 |
| 内置浏览器提示条已关闭 | sessionStorage | 关掉标签页时 |

规则：

- 新链接的投稿包和暂存的不一样：slug 相同就提示「投稿包已更新。」；slug 不同就按新投稿处理。
- 进入页面时如果没有令牌、但有暂存，① 上方显示提示条（`resume-notice`）：「接着上次的投稿：{名字}」，右侧有文字按钮「换一个投稿包」（`bundle-reset`），点了清掉暂存，回到指南模式。

## 4. 指南模式（没有投稿包）

### 4.1 画面

- h1「把你的 Bot 挂上货架」。导语：「不用会 git。让你的 AI 把东西都准备好，你只要看一眼预览、登录、点提交。」
- **三步图解**（`guide-steps`）：≥768px 三列，<768px 竖排。每一步是一张小卡：1px `--bz-border`，圆角 16px，内边距 20px。内容依次是：32px 线框图标（`stroke: currentColor; stroke-width: 1.6`，风格同第一期的小火苗）、序号加标题（16px / 700）、一句说明（14px / `--bz-text-2`）。

  | 序号 | 图标 | 标题 | 说明 |
  |---|---|---|---|
  | 1 | 剪贴板 | 复制提示词 | 点下面的按钮，把提示词发给你的 AI：Grok Bot、Codex、Claude Code 都行 |
  | 2 | 对话气泡 | 回答几个问题 | AI 自己能查到的不会问你，查不到的一次问清，最后给你一个投稿链接 |
  | 3 | 向上箭头 | 打开链接提交 | 看预览、用 GitHub 登录、点提交。维护者审核通过就上线 |

- **提示词框**（`submit-prompt`）：`--bz-surface-soft` 底，圆角 12px，内边距 16px，14px / 行高 1.8，`white-space: pre-wrap`，显示 §4.2 的全文。框下是主按钮「复制投稿提示词」（`copy-submit-prompt`）。
- **「已经有投稿包了？」**（`paste-box`）：用原生 `<details>`，默认收起。展开后：
  - 说明：「把 AI 给你的投稿链接，或者 BZB1: 开头的一长串、BOT-ZHIPIN-BUNDLE v1 开头的整段文字，粘贴到下面。」
  - 输入框 `<textarea>`（`paste-input`，6 行，等宽字体 13px）。
  - 按钮「读取」（`paste-submit`）。输入框为空时 `aria-disabled="true"`。
  - 能识别三种格式：完整链接（取 `#` 后面的部分）、`BZB1:` 令牌、明文投稿包；首尾的空白和代码围栏会去掉。
- 页脚两行小字（13px / `--bz-text-3`）：
  - 「已经上架、想更新？流程一样，用同一个 GitHub 账号提交就会更新原来那个。」
  - 「熟悉 git？也可以照 CONTRIBUTING.md 自己提 PR（合并请求）↗」（`contributing-link`）。

### 4.2 投稿提示词（定稿；放进 `site/.vitepress/meta.mjs`，导出名 `submitPrompt`）

```text
请帮我把我做的 Grok Bot 投稿到「Bot 直聘」：https://github.com/jakob52123/bot-zhipin
1. 先完整读一遍仓库根目录的 AGENTS.md，严格按它的步骤做。
2. 能从你自己（或我的 Bot 配置）里查到的信息直接用，查不到的再一次问清我；不要编造效果。
3. 不要向我要 GitHub 令牌或密码。
4. 最后给我一个 https://bot.jiachengbo.com/submit 开头的投稿链接。
```

仓库地址和站点地址要拼进去，分别取自 `SITE.repo` 和 `SITE.url`（M1 新增），不要写死在组件里。README、CONTRIBUTING 里的投稿提示词改成和这里一字不差。

### 4.3 复制

| 结果 | 表现 |
|---|---|
| 成功 | 按钮文字变「已复制 ✓」，同时加 `.copied` 样式，1.8 秒后恢复；播报「已复制投稿提示词」 |
| 失败（剪贴板被拒） | 打开手动复制对话框（`submit-prompt-fallback`，样式和行为同第一期 §7）。标题「复制没成功，请手动复制」，说明「全选下面的文字，复制后发给你的 AI」。文本框内容就是投稿提示词，打开时自动全选并聚焦。Esc 或点遮罩关闭，关闭后焦点回到按钮 |

本页所有「复制给 AI」按钮都用同一套成功和失败表现，失败时对话框里放的是要复制的那段文字。

## 5. 读取投稿包

### 5.1 解包中（`bundle-loading`）

- 触发：拿到令牌或粘贴内容后开始解码。
- 超过 300ms 还没结束才显示，免得一闪而过：① 卡片里显示「正在读取投稿包…」，同时 `aria-busy="true"`。
- 不做旋转动画，只在文字后面放三个点做透明度呼吸，1.2 秒一次；减少动效时三个点静止。

### 5.2 包损坏（`bundle-error`）

- 触发：令牌解不开、展开后超过 512KB、格式校验不通过（`unpack` 抛错）。
- 画面：① 卡片变成出错状态，里面放一条错误提示条：
  - 标题「这个投稿包打不开」，颜色 `--bz-danger`。
  - 原因一行（`bundle-error-reason`），按情况三选一：
    - 解码失败：「链接好像没复制完整。」
    - 超限：「投稿包太大了（展开后超过 512KB）。」
    - 格式错：直接显示 `unpack` 报错里的「问题」那句。
  - 下一步：「把下面这段发给你的 AI，让它重新生成。」
  - 按钮「复制给 AI」（`bundle-error-copy`）。复制的内容是：

    ```text
    我打开投稿链接时，页面提示：{原因}。请重新运行 make-submission-link 生成一个新的投稿链接给我；如果链接太长，请把完整的 BZB1 令牌发给我，我粘贴到投稿页。
    ```

  - 第二个按钮「重新粘贴」：回到指南模式，并自动展开 `paste-box`、聚焦输入框。
- 预览区、②③都不显示。焦点移到错误提示条的标题上（标题设 `tabindex="-1"`）。

### 5.3 校验未通过（`validation-errors`）

- 触发：浏览器里的校验内核返回 `errors.length > 0`。未登录时，`author.github` 用占位值参与校验，这一项不会报错。
- 画面（放在 ① 卡片内）：
  - 摘要标题 h3「还有 {N} 处要改」，颜色 `--bz-danger`，`tabindex="-1"`，出现时焦点移到这里。
  - 一句：「这些问题要让 AI 改。点「复制给 AI」，把复制的内容整段发给它，它改好会给你一个新链接。」
  - 错误清单：每条一块（`validation-error-item`），块与块之间用 1px `--bz-border` 分隔：
    - 第一行是文件路径，等宽字体 13px，`--vp-c-text-1`；
    - 下面三行「位置 / 问题 / 改法」。标签 13px、`--bz-text-3`、宽 3em；内容 14px。
  - 主按钮「复制给 AI」（`copy-errors`）。复制的内容和 CLI 格式一致：

    ```text
    投稿页检查没通过，请按「改法」逐条修改，改完重新生成投稿链接给我：
    ✗ bots/demo/bot.yaml
      位置：quotaCost
      问题：…
      改法：…
    ```

  - 如果同时有提醒（`warnings`），在错误下面另起一块「提醒（不影响提交）」（`validation-warnings`），标题用 `--bz-warning`，每条前加「!」。
- 预览区照常显示，能显示多少显示多少，坏字段用原文显示，不做链接。
- ② 可以先登录；③ 可以勾选授权，但提交按钮不可用。
- 播报：「投稿包还有 {N} 处要改」。

### 5.4 校验通过（`validation-ok`）

- ① 状态变为已完成，右侧状态短语「已通过」。卡片内只留一行：
  - ✓ 图标用 `--bz-success`，文字用 `--bz-success-text`：「检查通过：{名字}」；
  - 后面跟 slug，等宽字体 13px、`--bz-text-3`：「slug：{slug}」。
- 如果有提醒，下面列出（同 §5.3 的提醒块）。
- **货架上已有同名 slug**（`slug-notice`），按 `submit-context.json` 的 `index` 判断：

  | 情况 | 提示 |
  |---|---|
  | 未登录 | 中性提示：「货架上已经有一个叫 {slug} 的 Bot。如果是你的，登录后会作为更新提交；不是的话，请让 AI 换个英文短名。」 |
  | 已登录，作者是本人 | 中性提示：「这是对你已上架 Bot 的更新。」同时 ③ 的按钮文字改成「提交更新」 |
  | 已登录，作者是别人 | 错误提示：「这个英文短名（slug：{slug}）已经被别人用了。」加按钮「复制给 AI」，复制内容同 §11 的 `slug_taken`。提交按钮不可用 |

- 拿不到 `submit-context.json`（`context-unavailable`）时：照样用内核做单个 Bot 的检查，跳过模板残留和跨 Bot 检查，并显示中性提示：「有几项检查要等提交时由服务器来做。」不阻断。
- 播报：「投稿包检查通过」。

## 6. 预览区（`preview`）

- 面板：1px `--bz-border`，圆角 `--bz-radius-panel`，背景 `--bz-paper`，内边距 20px。
- 面板头部：
  - 标题「上架后的样子」，16px / 700；
  - 一句小字（`preview-note`，13px / `--bz-text-3`）：「上线后效果以实际页面为准。」
  - 分段控件「卡片 / 详情页」（`preview-tab-card`、`preview-tab-detail`），用 `aria-pressed` 表示选中，样式同第一期 §5，默认「卡片」。
- <1024px 时头部右侧多一个「收起预览 / 展开预览」按钮（`preview-toggle`），带 `aria-expanded`，控制面板主体的显示；收起时面板只剩头部一行。

### 6.1 卡片预览（`preview-card`）

- 用 `BotCard` 加 `preview` 属性渲染，宽度 `min(100%, 380px)`，水平居中。头像、舞台光晕、悬停说话和跳动都照第一期，可以玩，台词就用投稿包里的 `pitch`。
- 预览模式下的差异：

  | 元素 | 预览时怎么显示 |
  |---|---|
  | 名字链接 | 不跳页面，点一下切到「详情页」标签 |
  | 作者 | 普通文字「by {名字}」，不做链接 |
  | 热度 | 新投稿显示「新上架」，更新显示「热度 —」，不请求 `/api/stats` |
  | 「一键导入」「复制安装提示词」 | 文字照旧，但都是不可用状态：`aria-disabled="true"`，不透明度 .5，`cursor: not-allowed`，点了没反应，**不上报点击**。按钮行下面加一行小字「上架后可用」（`preview-actions-note`，13px / `--bz-text-3`） |
  | `templateUrl` | 不绑定到任何 href |

### 6.2 详情页预览（`preview-detail`）

- 用 `BotDetail` 加 `preview` 属性渲染。
- 结构调整：
  - 根元素用 `<article>`，不用 `<main>`；不显示「← 返回货架」。
  - 名字从 h1 降为 h3（样式类不变，视觉上用 24px）；各区块标题从 h2 降为 h4（视觉 18px）。这样页面上只有页头那一个 h1。
  - 不论多宽，都用第一期 §8「<768px 上下排布」的版式：用 `.preview` 类强制，不靠媒体查询。
- 各元素在预览时的表现：

  | 元素 | 表现 |
  |---|---|
  | 截图区 | 网站投稿不带截图，预览里不显示截图区（第 43 条） |
  | 设计说明里引用的 `screenshots/xxx` | 这是校验错误：没有这张图，① 里报错，改法是删掉这行图片引用（第 43 条） |
  | 技能 | 名字和说明照常显示；「查看源码」换成小字「上架后可查看源码」，不可点 |
  | 定时任务 | 链接换成小字「上架后可查看」 |
  | 改编自 | 链到线上 `/bots/{forkedFrom}`，新标签打开，带 ↗ 标记 |
  | 热度、上架日期 | 热度同卡片；上架日期新投稿显示今天（北京时间），更新显示原日期（从 `index` 取） |

- 设计说明的 HTML 由共享的安全渲染规则产出（`html: false`，外链图片只渲染成链接）。没通过 schema 的字段一律不进 href。

## 7. 登录（步骤 ②，`step-login`）

| 状态 | 触发 | 画面 | 操作 | 下一步 |
|---|---|---|---|---|
| 确认中（`auth-checking`） | 页面载入时请求 `GET /api/auth/me` | 一行浅灰骨架加小字「正在确认登录状态…」；超过 300ms 才显示 | — | 拿到 200 → 已登录；拿到 401 → 未登录 |
| 未登录 | `me` 返回 401 | 主按钮「用 GitHub 登录」（`login-button`，左边 16px 的 GitHub 标志，`currentColor`）。下面是说明（`login-why`，14px / `--bz-text-2`）：「登录是为了把你记成这个 Bot 的作者和项目贡献者，也防止别人冒用你的名字。我们只读取你的用户名，不会动你的任何仓库。」再下面一行：「还没有 GitHub 账号？免费注册一个 ↗」（`signup-link`，链接 `https://github.com/signup`），后跟小字「要一个邮箱，大约 2 分钟。注册好回到这里点登录。」 | 点登录 | 跳转中 |
| 跳转中 | 点了登录 | 按钮文字变「正在前往 GitHub…」，`aria-busy="true"`，不能重复点。先把当前状态写进暂存（§3.3），再整页跳到 `/api/auth/start` | — | 离开本页 |
| 已登录（`user-badge`） | `me` 返回 200 | 一行：28px 圆形头像（`https://avatars.githubusercontent.com/u/{id}?s=56`，1px `--bz-border`，加载失败显示首字母圆）+「@{login}」（`user-login`，15px / 600）+ 文字按钮「不是你？退出」（`logout-button`，13px / `--bz-text-3`，悬停加下划线）。② 状态变为已完成 | 点退出 → `POST /api/auth/logout` | 回到未登录；重新按未登录状态检查投稿包，③ 的提交按钮不可用 |
| 登录取消 | 回来时带 `?login=cancelled` | 中性提示（`login-notice`，`data-kind="cancelled"`）：「你取消了登录。想继续投稿，再点一次「用 GitHub 登录」就行。」 | 点登录 | 跳转中 |
| 登录失败 | 回来时带 `?login=failed` | 错误提示（`data-kind="failed"`）：「登录没成功，可能是网络不稳。再试一次；还不行就换个网络，或者过一会儿再来。」 | 点登录 | 跳转中 |
| 会话过期 | 回来时带 `?login=expired`；或者提交、查询进度时接口返回 `unauthenticated` / `session_expired` | 错误提示（`data-kind="expired"`）：「登录过期了，请重新登录。」② 变回未登录 | 点登录 | 跳转中 |

- 当前页面不上传截图，也不保存或发送回执。`POST /api/submit/screenshot` 仍供旧页面调用；旧页面提交回执时服务端仍用 `verifyReceipts` 校验，不因换账号或重新登录而跳过检查。
- 从登录回来（`?login=ok`）：焦点移到 ③ 的授权勾选框上，播报「已登录为 @{login}」。

## 9. 授权与提交按钮（步骤 ③，`step-submit`）

- 勾选框（`license-checkbox`，原生 checkbox，可点区域至少 44×44px）。文字：「我同意以 CC BY 4.0 授权这次投稿，并确认内容是我有权公开的。」
- 下面小字（`license-help`，13px / `--bz-text-2`）：「意思是：别人可以在注明你是作者的前提下复制、改编、使用这个 Bot。」后跟「授权全文 ↗」（链到仓库的 `bots/LICENSE`）。
- 提交按钮（`submit-button`，主按钮）：
  - 宽度：<768px 撑满，≥768px 自适应。
  - 文字：新投稿「提交投稿」，更新「提交更新」。
- **不可用时**：
  - 用 `aria-disabled="true"`，不用 `disabled`，这样按钮仍能获得焦点。
  - 外观：不透明度 .45，`cursor: not-allowed`。
  - 按钮下方列出还差什么（`submit-blockers`，13px / `--bz-text-2`），每条前加 `--bz-text-3` 的「·」，按顺序只列没满足的：
    - 「投稿包还没通过检查」
    - 「还没登录」
    - 「还没勾选授权」
    - 「请等倒计时结束」
  - 点不可用的按钮：焦点跳到第一个没满足的步骤（检查摘要、登录按钮、勾选框、限流提示），播报「还差：{第一条}」。
- 全部满足时按钮可用，`submit-blockers` 不显示。

## 10. 提交

### 10.1 提交中

- 触发：点了可用的提交按钮。
- 画面：
  - 按钮文字「正在提交…」，`aria-busy="true"`；
  - ①–③ 的所有输入暂时不可用（`inert`），预览区仍然可以看；
  - 按钮下面一行小字依次变化：「正在检查投稿」→ 2 秒后变「正在创建 PR（合并请求）」。
- 播报「正在提交」。
- 30 秒没有响应，按 `github_error` 处理（§11）。

### 10.2 提交成功（`submit-result`）

- ①–③ 整体换成结果面板（步骤卡样式）：
  - h2「投稿提交好了」，`tabindex="-1"`，出现时焦点移到这里；
  - 导语：「接下来交给维护者审核。审核通过会自动上线，GitHub 会发邮件通知你。现在关掉页面也没关系。」
- **进度条**：四步竖排，每步元素是 `progress-step`，带 `data-step` 和 `data-state="done|current|pending|failed"`：
  - 每步左边是 20px 圆点，用 2px 竖线连到下一步。done：`--bz-ink` 实心加 ✓；current：`--bz-ink` 描边加内部小实心点；pending：`--bz-border` 描边；failed：`--bz-danger` 实心加「!」。
  - 右边是标题（15px / 600）和说明（13px / `--bz-text-2`）。

  | `data-step` | 标题 | 说明 |
  |---|---|---|
  | `checked` | 检查通过 | 「格式、权限、密钥都查过了。」 |
  | `pr` | 已创建 PR（合并请求） | 「PR #{号} ↗」（`pr-link`，新标签打开） |
  | `review` | 等待维护者审核 | 「维护者会核对说明，一般 1–2 天内。有问题会在 PR 里留言。」 |
  | `live` | 已上线 | 进行中写「审核通过后大约 1 分钟上线。」；完成写「去看看你的 Bot ↗」（`live-link`，`/bots/{slug}`，新标签打开） |

- **状态和进度条的对应**（来自 `GET /api/submit/status` 的 `state`）：

  | `state` | 进度条 |
  |---|---|
  | `checking` | checked 完成，pr 进行中 |
  | `waiting_review` | checked、pr 完成，review 进行中 |
  | `approved`、`merged` | 前三步完成，live 进行中 |
  | `live` | 四步全部完成，播报「你的 Bot 上线了」 |
  | `failed` | review 标为失败，说明改成「自动检查出了点问题，维护者会在 PR 里留言告诉你怎么改。」 |
  | `closed` | review 标为失败，说明改成「这个投稿被关闭了，原因请看 PR 里的留言。」 |

- **轮询**：页面可见（`visibilityState === 'visible'`）时每 10 秒请求一次；页面不可见时暂停，回到前台立刻请求一次；`live` 或 `closed` 后停止。请求失败时保留上次的状态，进度条下方显示小字「状态暂时刷新不了，过一会儿会再试。」（`status-stale`）。
- 面板底部两个按钮：次按钮「再投一个」（`submit-another`：清掉暂存，回到指南模式）、次按钮「查看 PR ↗」。
- 刷新页面时，从暂存的 `result` 恢复到这个面板。

### 10.3 提交失败

- 失败时①–③恢复可用，错误提示放在 ③ 卡片里提交按钮上方（`submit-error`，带 `data-code`），出现时焦点移到提示条标题上。各错误码的文案和下一步见 §11。
- `invalid`（422）比较特殊：错误清单放回 ① 里，显示方式同 §5.3（「还有 {N} 处要改」+「复制给 AI」），① 变成出错状态，焦点移到 ① 的摘要上；③ 里只留一行「服务器检查发现了问题，见上面第 ① 步。」
- **被限流**（`rate_limited`）：提示里有倒计时（`retry-countdown`），格式是「{n} 秒」「约 {n} 分钟」「约 {n} 小时」，每秒更新；倒计时结束前提交按钮不可用，`submit-blockers` 里加一条「请等倒计时结束」。
- **后端不可用**：`submit_disabled`、`github_error`（含提交超时）直接给备用通道；网络断开连续失败两次才显示。提示里给次按钮「改用 GitHub Issue 投稿 ↗」（`issue-fallback`）：
  - 用同一个投稿包生成预填好的 Issue 链接，新标签打开。
  - 链接超过 7500 字符时，按钮改成打开空白投稿表单，同时在提示里显示投稿包明文框和「复制投稿包」按钮（`issue-fallback-paste`），说明「打开的页面里，把投稿包粘进「投稿包」一栏」。

## 11. 错误码文案对照表

服务端返回 `{ error: <码>, message, … }`。界面用下表的文案，**不直接显示 `message`**，`message` 只在找不到对应码时兜底显示。

| 码 | 出现在哪 | 给投稿人看的文案 | 下一步（按钮 / 行为） |
|---|---|---|---|
| `bad_request` | 提交 | 「页面状态有点乱，刷新一下再试。」 | 「刷新页面」按钮 |
| `unauthenticated` | 提交、状态 | 按 §7「会话过期」处理 | ② 回到未登录，焦点到「用 GitHub 登录」 |
| `session_expired` | 同上 | 同上 | 同上 |
| `forbidden_origin` | 提交 | 「请直接在 bot.jiachengbo.com 上打开投稿页再提交。」 | 「复制本页链接」（复制 `/submit#` 加当前令牌） |
| `license_required` | 提交 | 「先勾选上面的授权，再提交。」 | 焦点移到 `license-checkbox` |
| `not_found` | 状态查询 | 「找不到这个投稿记录了，可能已经被关闭。」 | 「查看 PR ↗」（有 PR 号时） |
| `slug_taken` | 提交（也会在 §5.4 提前出现） | 「这个英文短名（slug：{slug}）已经被别人用了。」 | 「复制给 AI」，复制内容：「投稿页提示 slug「{slug}」已经被别人用了。请换一个新的英文短名，同步修改文件夹名和 bot.yaml 里的 slug，再生成新的投稿链接给我。」 |
| `pr_limit` | 提交 | 「你已经有 {n} 个投稿在等审核了。等其中一个合并或关闭后再投新的。要改已经投的那个，用同一个 Bot 重新提交就会更新它。」 | 列出待审 PR：每个一行「{slug} · PR #{号} ↗」 |
| `too_large` | 提交 | 「投稿包太大了，请让 AI 精简一下文字内容。」 | 「复制给 AI」，复制内容：「投稿页提示投稿包太大，请精简 DESIGN.md、ROLE.md 和技能说明，让文字总量少于 400KB，再生成新链接给我。」 |
| `invalid` | 提交 | 「还有 {N} 处要改」，清单放在 ①（§10.3） | 「复制给 AI」 |
| `rate_limited` | 登录、提交 | 登录：「登录太频繁了，{倒计时}后再试。」提交：「提交太频繁了，{倒计时}后再试。」 | 倒计时结束后自动恢复按钮或「重试」 |
| `github_error` | 提交 | 「GitHub 那边出了点问题，这次没提交上去。过一会儿再点一次就行。」下面小字「错误编号：{requestId}」（`request-id`，等宽字体，可以选中复制） | 「再试一次」；次按钮「改用 GitHub Issue 投稿 ↗」 |
| `submit_disabled` | 任意接口 | 「网站投稿暂时用不了。可以改用 GitHub Issue 投稿，效果一样。」 | 「改用 GitHub Issue 投稿 ↗」（§10.3） |
| `network_error`、`timeout` | 网络断开或请求超时（提交超时按 `github_error` 处理） | 「网络好像断了，检查一下网络再试。」 | 「再试一次」；连续 2 次失败后再出「改用 GitHub Issue 投稿 ↗」 |

## 12. 内置浏览器提示（`inapp-warning`）

- 触发：UA 里有 `MicroMessenger`、` QQ/`、`Weibo`、`DingTalk`、`AlipayClient` 之一。不拦飞书和 Lark，它们的内置浏览器能正常登录。
- 画面：页面最上方的中性提示条：「你现在是在 {微信 / QQ / 微博 / 钉钉 / 支付宝} 里打开的。GitHub 登录在这里可能不顺，建议点右上角「…」，选「在浏览器打开」。」
- 两个按钮：
  - 「复制本页链接」（`inapp-copy-link`）：复制 `{站点}/submit#{当前令牌}`，没有令牌时复制 `/submit`。因为令牌已经从地址栏去掉了，必须带上，否则换个浏览器打开就丢了投稿包。
  - 「仍然在这里继续」（`inapp-dismiss`）：关掉提示条，在本标签页内记住。
- 不阻断任何操作。

## 13. 键盘、焦点、读屏

- Tab 顺序就是 DOM 顺序（§2.2）。≥1024px 时预览区在右列，Tab 走完 ① 会先进预览区再回到 ②：这是有意的，先看检查结果，再看预览，然后往下做。
- 焦点移动规则：

  | 时机 | 焦点去哪 |
  |---|---|
  | 包损坏 | 错误提示条的标题 |
  | 校验没通过（含服务端 422） | ① 的错误摘要标题 |
  | 从登录回来 | ③ 的授权勾选框 |
  | 点了不可用的提交按钮 | 第一个没满足的步骤 |
  | 提交出错 | `submit-error` 的标题 |
  | 提交成功 | 结果面板的 h2 |
  | 关闭对话框 | 回到打开它的按钮 |

  被移入焦点的标题都设 `tabindex="-1"`，并且有可见的焦点样式。
- **播报**：全部走 `LiveAnnouncer` 的 `announce()`，一次一句，不用 `role="alert"` 叠加播报：
  - 已复制投稿提示词 / 已复制
  - 投稿包检查通过 / 投稿包还有 {N} 处要改
  - 已登录为 @{login} / 登录过期了
  - 还差：{第一条}
  - 正在提交 / 投稿提交好了，PR #{号}
  - 状态变成：{步骤标题}
- 所有按钮、链接、勾选框都满足：高度 ≥40px，触摸设备 ≥44px。

## 14. 深色模式与减少动效

- **深色模式**：全部颜色走 token，跟随 VitePress 自动切换。
  - GitHub 头像加 1px `--bz-border`，免得在深色底上看不出边。
  - 错误、成功提示条的混色以 `--bz-paper` 为底，深色下自动变暗。
- **动效**（不减少时）：

  | 元素 | 动效 |
  |---|---|
  | 进度点完成 | ✓ 从 .6 缩放到 1，280ms `--bz-ease-pop` |
  | 提交成功面板 | 透明度加 8px 上移，220ms ease |

- **减少动效**（`prefers-reduced-motion: reduce`）：
  - 去掉所有位移和缩放，以及三个点的呼吸；
  - 保留 ≤120ms 的透明度过渡；
  - 预览里的头像遵守第一期 §10。

## 15. `data-testid` 清单

第一期的 testid 全部保留。预览里的 `BotCard` 和 `BotDetail` 仍带原有的 `bot-card`、`bot-detail` 等 testid，但都包在 `preview-card` / `preview-detail` 里面，测试要先限定在预览容器内再找。

| 区域 | testid |
|---|---|
| 页面 | `submit-page`（根元素） |
| 内置浏览器 | `inapp-warning`、`inapp-copy-link`、`inapp-dismiss` |
| 指南模式 | `guide`、`guide-steps`、`submit-prompt`、`copy-submit-prompt`、`submit-prompt-fallback`、`paste-box`、`paste-input`、`paste-submit`、`contributing-link` |
| 步骤卡 | `step-check`、`step-login`、`step-submit`（① 为 `current`、`done` 或 `error`；② 为 `current` 或 `done`；③ 为 `current` 或 `error`。提交阻塞看按钮的 `aria-disabled`，不是步骤卡状态） |
| 投稿包 | `resume-notice`、`bundle-reset`、`bundle-loading`、`bundle-error`、`bundle-error-reason`、`bundle-error-copy`、`validation-ok`、`validation-errors`、`validation-error-item`、`validation-warnings`、`copy-errors`、`slug-notice`、`copy-slug-error`、`context-unavailable` |
| 预览 | `preview`、`preview-toggle`、`preview-tab-card`、`preview-tab-detail`、`preview-card`、`preview-detail`、`preview-note`、`preview-actions-note`、`preview-scroll-hint` |
| 登录 | `auth-checking`、`login-button`、`login-why`、`signup-link`、`login-notice`（带 `data-kind`）、`user-badge`、`user-login`、`logout-button` |
| 提交 | `license-checkbox`、`license-help`、`submit-button`、`submit-blockers`、`submit-error`（带 `data-code`）、`submit-error-copy`、`submit-error-link`、`retry-countdown`、`request-id`、`issue-fallback`、`issue-fallback-paste` |
| 结果 | `submit-result`、`progress-step`（带 `data-step`、`data-state`）、`pr-link`、`live-link`、`status-stale`、`submit-another` |

## 16. 验收要点（L4 必须全部满足）

所有断言在 Playwright 里用 `page.route('/api/**')` 返回假数据来跑，不连真实 GitHub。「令牌」指用 `make-submission-link` 对 `tests/fixtures/bots/demo-prd-reviewer` 生成的 BZB1 令牌。

**进入与解包**

1. 打开 `/submit`（没有暂存）：`guide` 可见；`submit-prompt` 的文字等于 `meta.mjs` 里 `submitPrompt` 的输出；页面上只有一个 h1。
2. 授予剪贴板权限后点 `copy-submit-prompt`：剪贴板内容等于 `submitPrompt`；按钮文字是「已复制 ✓」；约 2 秒后恢复成「复制投稿提示词」。拒绝剪贴板时，`submit-prompt-fallback` 打开，文本框内容等于 `submitPrompt`；按 Esc 能关；关闭后焦点回到按钮。
3. 打开 `/submit#<令牌>`：1 秒内 `validation-ok` 可见，里面有 Bot 名字；`location.hash` 为空；刷新后 `validation-ok` 仍可见，`resume-notice` 可见。
4. 把完整链接粘进 `paste-input` 后点 `paste-submit`，效果同上一条。粘贴 `BZB1:xxxx`（坏令牌）：`bundle-error` 可见；`bundle-error-reason` 里有「没复制完整」；点 `bundle-error-copy` 后剪贴板内容里有「make-submission-link」。
5. 粘贴一个缺 `quotaCost` 的明文投稿包：`validation-errors` 可见，标题里有「处要改」；`validation-error-item` 至少 1 个，里面有「位置」「问题」「改法」；`document.activeElement` 是这个摘要标题；`copy-errors` 复制的内容以「投稿页检查没通过」开头，并且有 `✗ bots/`；`step-submit` 仍可见，`submit-button` 的 `aria-disabled="true"`，`submit-blockers` 包含「投稿包还没通过检查」。

**预览**

6. `preview-card` 里的 `btn-import`、`btn-prompt` 都是 `aria-disabled="true"`，点了以后没有请求发到 `/api/click`；`preview-actions-note` 的文字是「上架后可用」；整页没有任何 `href` 等于 `templateUrl` 的链接。
7. 点 `preview-tab-detail` 后 `preview-detail` 可见；`preview-detail` 里面没有 `main` 元素，也没有 `h1`；技能区没有可点的「查看源码」链接，有文字「上架后可查看源码」。
8. 宽 390px 时 `preview-toggle` 的 `aria-expanded="false"`，点一下变 `"true"`；宽 1280px 时 `preview-toggle` 不可见，预览区的 `position` 是 `sticky`。

**登录**

9. `/api/auth/me` 返回 401 时：`login-button` 可见；`signup-link` 的 href 是 `https://github.com/signup`。点 `login-button` 后，页面跳转到 `/api/auth/start`，跳转前 sessionStorage 的 `bz-submit` 里已经有投稿包。
10. `me` 返回 `{ id: 1, login: 'demo' }` 时：`user-login` 的文字是「@demo」；`step-login` 的 `data-state="done"`。
11. 分别带 `?login=cancelled`、`failed`、`expired` 打开：`login-notice` 的 `data-kind` 和参数一致，文案分别有「取消了登录」「没成功」「过期了」；URL 里不再有 `login` 参数。

**更新投稿包**（编号沿用 e2e 用例）

17. 读取同 slug 的新版本投稿包时提示「投稿包已更新。」

**提交**

18. 检查通过、已登录但没勾授权：`submit-button` 是 `aria-disabled="true"`，`submit-blockers` 里有「还没勾选授权」；点按钮后焦点移到 `license-checkbox`。
19. 全部满足后点提交：不发上传请求，提交正文不带 `screenshots`。`/api/submit` 返回 200：`submit-result` 可见；焦点在它的 h2 上；`progress-step[data-step="pr"]` 是 `data-state="done"`，`pr-link` 的 href 等于返回的 PR 地址。把状态接口依次改成 `waiting_review`、`live`：10 秒内（用假时钟快进）`progress-step[data-step="live"]` 变成 `done`，`live-link` 的 href 是 `/bots/<slug>`。
20. 提交返回 422，带 2 条错误：`step-check` 的 `data-state="error"`；`validation-error-item` 有 2 个；焦点在 ① 的摘要标题上。
21. 返回 429，`Retry-After: 90`：`submit-error[data-code="rate_limited"]` 可见；`retry-countdown` 的文字里有「分钟」；`submit-button` 是 `aria-disabled="true"`。
22. 返回 `slug_taken`、`pr_limit`、`github_error`、`submit_disabled`：`submit-error` 的 `data-code` 分别对应。`github_error` 时 `request-id` 显示返回的 requestId；`submit_disabled` 时 `issue-fallback` 可见，它的 href 以 `https://github.com/jakob52123/bot-zhipin/issues/new?template=submit-bot.yml` 开头。

**通用**

23. 用 UA `MicroMessenger` 打开：`inapp-warning` 可见；点 `inapp-copy-link` 后剪贴板里的链接有 `/submit#BZB1:`；点 `inapp-dismiss` 后提示条消失，刷新也不再出现。
24. 宽 1280、768、390、320 时 `document.documentElement.scrollWidth <= innerWidth`（没有横向滚动）。
25. 所有可见的 `button`、`a.shelf-button`、`[role=button]` 高度 ≥40px；触摸设备 ≥44px。
26. 浅色和深色下，`--bz-text-3`、`--bz-success-text`、`--bz-danger` 文字和各自背景的对比度 ≥4.5:1。
27. 减少动效下：`progress-step` 的 ✓ 没有 `transform` 动画；`getAnimations()` 里不含位移和缩放动画。
28. 第一期的 `tests/e2e/interaction*.spec.mjs` 和站点 e2e 全部仍然通过。

**截图存档**（`test-results/submit/<状态>-<宽度>.png`，宽度 1280、768、390、320 各一张；深色模式只拍带 ★ 的，宽度 1280 和 390）

| 状态 | 怎么造 |
|---|---|
| ★ `guide` | 直接打开 `/submit` |
| `guide-paste` | 展开 `paste-box` |
| `bundle-error` | 粘贴坏令牌 |
| ★ `invalid` | 粘贴缺字段的投稿包 |
| ★ `valid-logged-out` | 有效令牌，`me` 返回 401 |
| `blockers` | 没勾授权 |
| `submitting` | 让提交请求挂起不返回 |
| ★ `submitted-review` | 状态返回 `waiting_review` |
| `submitted-live` | 状态返回 `live` |
| `error-rate-limited` | 提交返回 429 |
| `error-disabled` | 提交返回 `submit_disabled` |
| `preview-detail` | 切到详情页标签 |
| `inapp` | 用微信 UA 打开 |

## 17. 需要 M1（`SUBMIT.md`）对齐的点

1. `GET /api/auth/me`：200 返回 `{ id, login }`，头像地址由 id 拼出；401 返回 `{ error: 'unauthenticated' }`。
2. 登录回调固定 302 到 `/submit?login=ok|cancelled|failed|expired`。`expired` 指 OAuth 的 state cookie 过期（超过 10 分钟）。
4. `POST /api/submit` 成功时返回 `{ ok, pr: { number, url }, slug, update, liveUrl, warnings }`。`update` 决定「提交更新」的文案和预览里的日期。
5. 422 的 `errors[]` 和 `warnings[]` 格式与 CLI 一致：`{ file, where, problem, fix }`。
6. `pr_limit` 要多返回 `pulls: [{ number, url, slug }]`，页面要列出来。
8. `rate_limited` 同时给 `Retry-After` 响应头和 body 里的 `retryAfter`（秒），登录接口被限流时回调要怎么表现也要写清（建议 302 到 `/submit?login=failed`，再加 `&retry=<秒>`）。
9. `github_error` 返回 `requestId`。
10. `GET /api/submit/status?pr=<号>` 的 `state` 取值固定为 `checking | waiting_review | approved | merged | live | failed | closed`，另外返回 `url`、`slug`、`liveUrl`。
11. `submit-context.json` 的 `index[]` 要有 `authorGithub` 和 `addedAt`，用来在 §5.4 提前判断 slug 是否被占，以及在预览里显示原上架日期。
12. 浏览器端要能编码：「改用 Issue 投稿」要在浏览器里生成 BZB1 令牌（`CompressionStream('gzip')`），生成的令牌必须能被 Node 端的 `decode` 解开；URL 长度阈值 7500 要和 CLI 共用一个常量。
13. `meta.mjs` 新增 `SITE.url = 'https://bot.jiachengbo.com'` 和 `submitPrompt()`（全文见 §4.2）；网站上「我要投稿」和空状态里「做第一个投稿的人」都改成链到 `/submit`（站内链接，去掉 ↗）。
14. `/submit` 的 CSP 要放行：`img-src 'self' blob: data: https://avatars.githubusercontent.com`；`connect-src 'self'`；`form-action 'self'`；`/api/auth/start` 是整页跳转，不受 `connect-src` 限制。
15. `announce.ts` 要加通用的 `announce(text)`，归 L4 的写入范围。
16. 服务端在新投稿时把 `addedAt` 改写为北京时间当天。预览里也按这个规则显示日期，两边要一致。

## 附录：截图步骤（决策 43 已去掉）

以下是旧页面的规格，不能用来实现或验收当前页面。

### 8.1 总体

- ③ 标题「放截图」，右侧状态短语「{已完成数} / {必填数} 张」。
- 槽位上方是隐私提醒（`privacy-reminder`，中性提示条）：「放之前看一眼：截图里不能有密钥、公司内部信息、别人的聊天记录和手机号。只放 Bot 真实输出的截图，不要用生成或伪造的图。」
- **槽位数量**：
  - 每个投稿包里声明的截图文件名对应一个**必填**槽位（`data-required="true"`）。
  - 投稿包没声明时，按 DESIGN.md 里引用图片的顺序推导；还是没有，就给 1 个必填槽位。
  - 下方「再加一张」（`slot-add`，次按钮，带加号图标）可以追加选填槽位。
  - 总数上限是「30 减文本文件数」，同时不超过 12 张；到上限时按钮隐藏，换成小字「最多 {n} 张」。
- 槽位排列：≥768px 两列网格，间距 16px；<768px 单列。
- 每个槽位头部：
  - 「截图 {n}」（14px / 600），必填的加小标签「必填」（`.bot-tag` 样式）；
  - 投稿包里约定的文件名（等宽 12px / `--bz-text-3`）；
  - 如果 DESIGN.md 里引用这张图时写了说明文字，再加一行「AI 说这张是：{说明}」（13px / `--bz-text-2`），没有就不显示。
- **锁定**（`slots-locked`）：槽位区不透明度 .5，所有输入不可用；上面盖一行居中文字：没登录写「先登录，再放截图」，检查没通过写「投稿包检查通过后才能放截图」。已传好的缩略图照常显示。
- 上传时最多同时传 2 张，其余排队。

### 8.2 槽位状态（槽位元素 `slot` 带 `data-index`、`data-state`）

| `data-state` | 触发 | 画面 | 操作 |
|---|---|---|---|
| `empty` | 初始，或点了移除 | 2px 虚线 `--bz-border`，圆角 16px，高 160px（<768px 120px），居中放 24px 图片图标。有精确指针的设备写「把图片拖到这里，或 点击选择 · 也可以粘贴（Ctrl+V / ⌘V）」；`(hover: none) and (pointer: coarse)` 的设备只写「点这里选一张图」，不提拖放和粘贴 | 点击或 Enter / 空格打开系统选图（隐藏的 `<input type="file" accept="image/png,image/jpeg,image/webp,image/gif">`，`slot-input`）；拖入；粘贴（焦点在这个槽位时贴进这个槽位；焦点不在任何槽位时贴进第一个空槽位） |
| `dragover` | 文件拖到槽位上方 | 边框变实线 `--bz-ink`，背景 `--bz-surface-soft`，文字「松手，放进截图 {n}」；120ms 过渡 | 松手：一次拖入多张时，依次填这个槽位和后面的空槽位，还有剩就自动加选填槽位，到上限为止 |
| `compressing` | 选的图超过 2MB，而且不是 GIF | 显示半透明缩略图和文字「图片有点大，正在压缩…」，进度条循环滚动（减少动效时不动） | — |
| `queued` | 前面已经有 2 张在传 | 缩略图加文字「排队中」 | 「取消」（`slot-cancel`） |
| `uploading` | 开始上传 | 缩略图，下面 4px 进度条（`slot-progress`，`--bz-surface-soft` 轨道、`--bz-ink` 填充，宽度过渡 200ms linear，带 `role="progressbar"` 和 `aria-valuenow`），旁边写「上传中 {p}%」 | 「取消」：中断上传，回到 `empty` |
| `done` | 服务端返回回执 | 缩略图（`slot-thumb`，`object-fit: contain`，最高 160px，1px `--bz-border`，圆角 12px），右上角 20px 的 `--bz-success` 实心圆加白色 ✓。下面一行：文件名 · 大小；压缩过的再加一句「已从 {原大小} 压到 {新大小}」 | 「换一张」（`slot-replace`，打开选图，成功前保留旧图）；「移除」（`slot-remove`：必填槽位清空回 `empty`，选填槽位整个删掉） |
| `failed` | 网络错误、5xx、`github_error`、`receipt_invalid`，或登录跳转打断了上传 | 2px `--bz-danger` 实线边框，缩略图半透明，提示（`slot-message`）：「这张没传上去。」加原因（见 §11），回执失效时写「这张需要重新上传。」 | 「重试」（`slot-retry`）；「换一张」；「移除」 |
| `too-large` | GIF 超过 2MB；或者压缩到最小档还超过 2MB | 同 `failed` 的边框。动图写「动图超过 2MB，没法自动压缩。换一张静态截图，或者把动图压小一点再放。」；压不下来写「压缩后还是超过 2MB，裁掉多余的部分再放。」 | 「换一张」；「移除」 |
| `unsupported` | 不是 PNG、JPG、WebP、GIF（按 MIME 和文件头判断） | 同 `failed` 的边框，写「只支持 PNG、JPG、WebP、GIF。iPhone 的 HEIC 照片先截个屏，或者导出成 JPG。」 | 「换一张」；「移除」 |

### 8.3 压缩规则（交互层面的约定，实现见 L3）

- 只压大于 2,097,152 字节的非 GIF 图片。
- 先把长边缩到 2560px 以内，按 JPEG 质量 .9 → .8 → .7 → .6 依次尝试，有一档 ≤2MB 就停。全部超限就进入 `too-large`。
- 压缩后的图在预览区和缩略图里换成新图。

### 旧步骤与其他区域的关系

旧流程的 ③ 是 `step-shots`，④ 才是提交。未登录或检查未通过时槽位锁定；必填槽位未就绪时不能提交。旧页面暂存缩略图和回执；上传的大小、格式或限流错误在槽位内显示，提交返回 `receipt_invalid` 时按 `slots` 标出失败项。

旧槽位接受键盘选择、拖放和粘贴，按槽位播报上传进度与结果；拖入、压缩、上传成功或失败各有样式，减少动效时不做宽度过渡。原测试使用 `privacy-reminder`、`slots`、`slots-locked`、`slot` 和各 `slot-*` 控件，视觉样本包括 `slot-dragover` 和 `slots-mixed`。

### 旧截图验收用例

12. 选一张 100KB 的 PNG：槽位依次经过 `uploading`（`slot-progress` 可见）到 `done`，`slot-thumb` 可见；`step-shots` 的状态短语是「1 / 1 张」。
13. 选一张 3MB 的 PNG：先出现 `compressing`；最后发给 `/api/submit/screenshot` 的请求体不超过 2,097,152 字节，`Content-Type` 是 `image/jpeg`。选一张 3MB 的 GIF：`data-state="too-large"`，没有发出上传请求。选一个 `.heic` 文件或文本文件：`data-state="unsupported"`。
14. 上传接口返回 500：`data-state="failed"`，`slot-retry` 可见；点重试后再返回 200，状态变成 `done`。
15. `(hover: none) and (pointer: coarse)` 模拟（用 `isMobile` + `hasTouch` 的设备）时，空槽位的文字里没有「拖」和「粘贴」。
16. 一次拖入 3 张图到只有 1 个槽位的投稿：出现 3 个槽位，后 2 个 `data-required="false"`。
17. 已有 `done` 的截图时刷新页面：槽位仍是 `done`，缩略图可见，没有重新发上传请求。
