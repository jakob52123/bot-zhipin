# 埋点设计

2026-11-22 定（决策 72）。用户选了：数据存本站 D1，用命令出中文报告，搜索词存原文。

事件名和字段的正本是 `functions/_lib/events.ts`。本文第 3 节的表和它逐条对应，单测会核对两边一致。

## 1. 埋点要回答的问题

| 问题 | 看什么 | 用到的事件 |
|---|---|---|
| **北极星：来的人有没有把东西拿去用** | 每周「拿走会话数」，以及拿走会话占全部会话的比例 | `TAKE_EVENTS`：`bot_import`、`bot_copy_prompt`、`bot_copy_starter`、`squad_copy`、`prompt_copy`、`skill_copy` |
| 来了多少人、从哪来 | 访客、会话、浏览量；外站来源域名、utm、国家、手机还是电脑 | `page_view` |
| Bot、Prompt、Skills 三块各自好不好用 | 每块的浏览量、拿走次数、拿走率 | `page_view`、拿走事件 |
| 哪些条目有人拿，哪些没人看 | 拿走次数前 10；看的人多但没人拿的前 10 | `page_view`、拿走事件 |
| 大家想找什么，货架上没有 | 搜得最多的词；搜了没结果的词；筛完是空的分类 | `search`、`library_search`、`filter` |
| 导入到底成没成 | 协议唤起占比；疑似没装 App 的占比 | `bot_import`、`bot_no_app` |
| 投稿卡在哪一步 | 每一步的会话数；失败原因排行 | `submit_step` |
| 复制功能坏没坏 | 复制失败（`ok=false`）的占比；404 地址排行 | 各复制事件、`page_view`（页面类型 `404`） |

热度计数（`/api/click`、决策 3、59）**一点不变**。它是页面上展示的功能，带 24 小时去重；埋点是另一条原始数据流，不去重，只给维护者看。导入、复制安装提示词、复制开场白、复制口令这四处，照旧调用 `reportClick`，另外再记一条埋点。

## 2. 数据怎么走

```
浏览器 theme/track.ts ──批量──▶ POST /api/events ──▶ D1 表 events ──▶ npm run report（只读）
```

- **前端**：组件里调用 `track(事件名, 字段)`。事件先进队列，满 10 条或 2 秒后用 `fetch(keepalive)` 发一批；页面隐藏或关闭时用 `navigator.sendBeacon` 把剩下的发掉。发送失败就丢，不重试，绝不阻塞复制和跳转，也不抛错。
- **后端**：`functions/api/events.ts` 校验后批量写入，返回 204。
- **报告**：`scripts/report.mjs` 用 wrangler 只读查询线上库，在终端打印中文报告。

## 3. 事件表

**每条事件都带**（前端自动填，组件不用管）：

| 字段 | 说明 |
|---|---|
| `page` | 页面类型：`home` `bot` `squad` `prompts` `prompt` `skills` `skill` `author` `submit` `404` `other`（`author` 是作者主页 `/authors/<登录名>`，决策 73） |
| `path` | 当前路径，不带查询串和锚点 |
| `slug` | 详情页（Bot、小队、Prompt、Skill）和作者主页自动取地址里的 slug（作者页取登录名）；列表上的动作由组件传被操作条目的 slug |

**站外链接的 `kind`**：链接上写了 `data-track-kind` 就用它；没写的按地址推：`x.ai/bot#download` 是 `download`，本仓库 GitHub 地址下的 `/pull/` 是 `pr`，本仓库其他地址是 `repo`，其余是 `other`。作者的站外主页（含作者页上的 `@登录名`）写 `author`，Prompt/Skill 的原文出处写 `source`，许可证写 `license`。站内链接（包括 `/authors/`）不记 `outbound`，靠 `page_view` 的 `prev` 看从哪来。带 `data-track-own` 的链接（导入按钮，已由 `bot_import` 记过）不记。

**整批共用**（每批请求带一次）：`sid` 会话号、`device`（`mobile`/`desktop`，宽度 ≤ 767px 或主要指针是触屏算 `mobile`）。

**服务器补**：`at`（服务器毫秒时间，减去前端报的 `ago`）、`day`（北京时间日期）、`vid`（当天访客号，见第 4 节）、`country`（Cloudflare 给的两位国家码）。

| 事件 | 什么时候发 | slug 是谁 | 字段 |
|---|---|---|---|
| `page_view` | 进一个页面：首次打开和站内跳转都算，只改查询串或锚点不算 | 详情页的 slug | `landing` 是不是本次会话第一页；`ref` 外站来源域名（只在 landing）；`prev` 上一页类型（只在站内跳转）；`utm_source` `utm_medium` `utm_campaign`（只在 landing） |
| `bot_import` | 点任一「导入」 | 被导入的 Bot | `from`：`card` 列表卡 · `featured` 主推卡 · `detail` 详情页 · `squad_lineup` 小队阵容 · `squad_setup` 小队步骤；`squad` 小队 slug；`direct` 走了协议唤起；`trial` 试跑句复制结果 `none`/`copied`/`failed`；`mod` 按着修饰键或中键 |
| `bot_no_app` | 导入后出现「没装 Grok Bot？去下载」 | 该 Bot | — |
| `bot_copy_prompt` | 复制安装提示词，复制结果出来之后发 | 该 Bot | `from` `card`/`detail`；`ok` |
| `bot_copy_starter` | 复制一条开场白，结果出来之后发 | 该 Bot | `index` 第几条（从 0 起）；`ok` |
| `squad_start` | 点「开始组队」 | 小队 | — |
| `squad_copy` | 复制口令、试一句或新写岗位的岗位说明 | 小队 | `which` `kickoff`/`tryout`/`brief`；`ok` |
| `prompt_copy` | 复制 Prompt | 该 Prompt | `from`：`list` 列表行标题旁 · `list_open` 列表展开后的工具条 · `detail_side` 详情侧栏 · `detail_body` 详情正文区 · `detail_en` 英文原文区；`lang` `translated` 复制的是本站中文译文 / `original` 复制的是原文；`ok` |
| `prompt_open` | 列表里展开一条长文（收起不记） | 该 Prompt | — |
| `skill_copy` | 复制 Skill 安装命令、正文或作者示例里的提问 | 该 Skill | `what` `command`/`body`/`example`；`agent` 命令对应的工具名；`index` 第几条命令或第几个示例；`ok` |
| `outbound` | 点站外链接（全站统一监听，左键和中键都算） | 当前页的 slug | `host`；`to` 域名加路径；`kind` `download` `author` `source` `license` `repo` `pr` `other` |
| `filter` | 首页切分组、切排序、点专题、清除专题；Prompt/Skills 列表切分类 | — | `where` `shelf_role`/`shelf_sort`/`collection`/`library_cat`；`value`；`results` 切完列表里有几条 |
| `library_search` | Prompt/Skills 列表搜索框停手 1.5 秒，或离开页面时还有没发的词；同一个词不重复发 | — | `q`；`cat` 当时的分类；`results` |
| `search` | 全站搜索面板选中结果或关闭时记一次；搜索词为空不记 | 选中的条目（未选不带） | `q` 关闭时的词（最多 40 字）；`results` 四组完整命中数之和；`via` 打开方式 `shortcut`/`slash`/`button`；`picked` 是否选中；选中才带 `pick_type` `bot`/`squad`/`prompt`/`skill` 和 `pick_rank`（按显示顺序跨组从 0 起） |
| `submit_step` | 投稿页每一步，见下表 | — | `step`；`ok`；`code`；`n`；`via`；`mode`；`pr` |

**投稿漏斗的 `step`**：

| step | 什么时候 | 带什么 |
|---|---|---|
| `view` | 进投稿页 | — |
| `copy_prompt` | 复制投稿提示词 | `ok` |
| `read` | 读到投稿包 | `via` `paste` 粘贴 / `link` 链接里带的 / `resume` 本标签页的草稿 |
| `bundle_error` | 投稿包读不出来 | `code` |
| `checked` | 校验跑完 | `ok` 没有错误；`n` 错误条数；slug 被占时 `code=slug_taken` |
| `login_click` | 点 GitHub 登录 | — |
| `login_back` | 从 GitHub 登录回来 | `ok`；失败时 `code` 为 `cancelled`/`failed`/`expired` |
| `submit_click` | 点提交 | `ok` 前置条件都满足；不满足时 `code` 为第一个缺的条件 |
| `submitted` | 提交成功 | `mode` `new`/`update`；`pr` |
| `submit_fail` | 提交失败 | `code` 为错误码 |
| `progress` | 轮询到终态（每个 PR 只记一次） | `code` `live`/`closed`/`failed`；`pr` |
| `issue_fallback` | 点备用 Issue 链接 | — |
| `inapp` | 显示了「在微信等内置浏览器里」提示 | `code` 平台名 |

**不记的**：头像戳、听自荐、球池拖拽、合影和流程图戳、吉祥物戳（纯好玩，不影响决策）；页眉外观切换、汉堡菜单。

## 4. 隐私和数据边界

- **不用 cookie，不用 localStorage 存身份，不跨天追踪同一个人，不加第三方脚本。**
- 会话号 `sid`：浏览器 `crypto.getRandomValues` 生成 16 字节随机数，存在 `sessionStorage`，关掉标签页就没了。sessionStorage 不可用时只存在内存里。
  - **会话会过期**（独立审查后加）：会话号连同它的北京日期、最后一次活动时间一起存。换了北京日期，或者闲置超过 30 分钟，就换一个新会话号，同时清掉「本会话已落地」的标记，下一次浏览重新算 landing。只有这次是整页加载时才带 ref 和 utm；页面没刷新、只是闲置后续上的，ref 和 utm 不带，因为它们属于原来那次进站。
  - 只在正式域名 `bot.jiachengbo.com`、`localhost`、`127.0.0.1` 上发埋点；旧域名和预览部署（`*.pages.dev`）一律不发，免得预览站的数据写进线上库。
- 当天访客号 `vid`：服务器用现成的 `hashIp(IP_SALT, ip, "v|" + 北京日期 + "|" + User-Agent)`（即 `hex(HMAC-SHA256(key = IP_SALT, normalizeIp(ip) + "|v|" + 日期 + "|" + UA))`），取前 16 位。第二天换日期就对不上了，只能数「当天有几个人」。不存原始 IP 和 UA。
- 搜索词存原文（用户定）：去掉首尾空白、合并连续空白、截到 40 字。服务器依次这样处理：
  1. 先截到 200 字，防止超长输入让正则耗尽 CPU；
  2. 做 NFKC 归一，全角转半角；
  3. 邮箱换成「【邮箱】」；
  4. 数字之间只夹空格或横线、合计 7 位以上的，整段换成「【数字】」，例如 `13812345678`、`138 1234 5678`、`138-1234-5678`；
  5. 最后截到 40 字。

  搜索词原文保留 90 天，之后从 `props` 去掉 `q`；事件本身照常保留 400 天，用于统计搜索次数。
- 你自己的访问照样会算进去（用户没选排除）。流量还小的时候，自己点的会明显拉高数字，看报告时心里有数。
- 线上不设 `ALLOW_TEST_IP`。本地设了它时，后端接受 `X-Test-IP`，并且不过滤无头浏览器，方便测试。

## 5. 接口：POST /api/events

请求：`Content-Type: application/json`，同源（规则同 `/api/click`：带 Origin 时必须相同，`Sec-Fetch-Site: cross-site` 拒绝），请求体不超过 16384 字节。

```json
{
  "v": 1,
  "sid": "q3k9V0aZ2mXo7cLp1sYt8w",
  "device": "desktop",
  "events": [
    { "name": "page_view", "page": "bot", "path": "/bots/my-bot", "slug": "my-bot", "ago": 1830, "props": { "landing": true, "ref": "github.com" } },
    { "name": "bot_import", "page": "bot", "path": "/bots/my-bot", "slug": "my-bot", "ago": 0, "props": { "from": "detail", "direct": true, "trial": "copied" } }
  ]
}
```

**整批不合格就 400**：不是 JSON 对象、`v` 不是 1、`sid` 不匹配 `^[A-Za-z0-9_-]{16,32}$`、`events` 不是 1～30 条的数组、超过 16384 字节。

**单条不合格只丢这一条**，其余照写：

- `name` 不在事件表里：丢。
- `path` 不是以 `/` 开头的字符串、或超过 200 字：丢。路径里的查询串和锚点由服务器截掉。
- `page` 不在页面类型里：改成 `other`。
- `slug` 不合 `isValidSlug`：当作没有。
- `ago` 不是 0～600000 的整数：缺省为 0，超出按边界算。
- `device` 不是 `mobile`/`desktop`：整批记 `unknown`。

**字段**：不在该事件定义里的字段丢掉；类型不对的丢掉。字符串去掉控制字符、首尾空白，合并连续空白，按字符（不是字节）截到上限，截完是空串就丢；枚举必须完全相等；整数必须在范围内；布尔必须是 `true`/`false`。最后 `props` 以 JSON 存，没有字段就存 `{}`。

**不写库、直接 204**：User-Agent 为空，或匹配爬虫和无头浏览器（`bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|curl|wget|python|httpclient|go-http`，不分大小写）；本地 `ALLOW_TEST_IP=1` 时不做这一步过滤。

**限流**：复用 `rate_limits` 表和 `hit()`，两个桶都登记在 `RATE_LIMITS` 里。超了都返回 204，不写事件，前端不需要知道。

1. 先清洗整批。一条合格的都没有，直接 204，一行都不写。
2. 每个 IP 的桶 `events`：键是 `hashIp(IP_SALT, ip, "events")`，每分钟最多 60 批、300 条，按合格条数计，用 `hit()` 的 `bytes` 和 `byteLimit` 记。
3. 全站每日总量桶 `events-day`：键固定 `all`，每个 UTC 日最多 1 万条。这是为了把埋点能用的写额度锁住：D1 免费版每天 10 万行写入，计数和投稿也要用。
4. 写入。每条事件写 2 行：表本身和 `events_day_name` 索引。

爬虫在 UA 过滤那步就挡掉了，坏请求在解析那步挡掉，都不占限流表。

**响应**：成功 204 无正文；400 `bad_request`；403 `forbidden`；415 `unsupported_media_type`；405 `method_not_allowed`（带 `Allow: POST`）；没配 `IP_SALT` 或数据库出错 500 `server_error`。错误响应和 `/api/click` 一样带 JSON 类型和 `no-store`。

**清理**：每次请求以 1/200 概率通过 `waitUntil` 执行同一批清理：先删除 `day` 早于「400 天前那天的北京日期」的行，走 `events_day_name` 索引；再对 `day` 早于「90 天前那天的北京日期」且 `q` 非空的 `search`、`library_search` 事件执行 `UPDATE events SET props = json_remove(props, '$.q')`。两个截止日期当天都保留，清理失败不影响响应。

## 6. 表结构（迁移 0005）

```sql
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  at INTEGER NOT NULL,      -- 服务器毫秒时间
  day TEXT NOT NULL,        -- 北京时间 YYYY-MM-DD
  name TEXT NOT NULL,
  page TEXT NOT NULL,
  path TEXT NOT NULL,
  slug TEXT,
  sid TEXT NOT NULL,
  vid TEXT NOT NULL,
  device TEXT NOT NULL,
  country TEXT,
  props TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS events_day_name ON events (day, name);
```

只留一个索引：每多一个索引，每条事件就多写一行。

`name` 不加 CHECK：事件表在代码里，加事件不用迁移（`click_counts` 改 CHECK 要重建表的教训，见决策 60）。只新建表，不碰现有任何表。

## 7. 报告：npm run report

```
npm run report                 # 最近 7 天，查线上库
npm run report -- --days 30
npm run report -- --local      # 查 dev:full 的本地库
npm run report -- --json       # 输出 JSON，给以后做看板用
```

只读：脚本里每条 SQL 都必须以 `SELECT` 或 `WITH` 开头，否则直接报错退出。报告脚本直接 import `.ts`，要 Node 22.18 以上。按北京日期取最近 N 天（含今天），和前 N 天对比。报告内容：

1. **概览**：访客（按天去重 `vid` 再求和）、会话（去重 `sid`）、浏览量、拿走次数、拿走会话数、拿走率；每项带和上一期的对比。
2. **来源**：落地页的外站来源域名前 10、utm 来源前 10、国内（`CN`）和海外占比、手机和电脑占比。
3. **三个模块**：Bot（`home`、`bot`、`squad`、`author`）、Prompt（`prompts`、`prompt`）、Skills（`skills`、`skill`）各自的浏览量、拿走次数，以及拿走率。拿走率 = 在该模块既浏览又拿走的会话数 ÷ 在该模块浏览过的会话数。按会话先聚合、再按模块汇总，不用相关子查询，读的行数和事件数成正比。
4. **条目**：拿走次数前 10（slug、事件、次数）；本期一次都没被拿走的详情页里，按浏览量排的前 10。
5. **搜索**：搜索词前 20（两种搜索合起来，标出来源）；`results=0` 的词全部列出。
6. **筛选**：各 `where` 下 `value` 的次数前 5；`results=0` 的组合。
7. **导入**：`direct` 占比、`trial` 分布、`bot_no_app` 次数占 `bot_import` 的比例。
8. **投稿漏斗**：每个 `step` 的会话数，按第 3 节表的顺序；`submit_fail`、`bundle_error` 的 `code` 排行。
9. **健康**：各复制事件 `ok=false` 的占比；404 页面的 `path` 前 10。

## 8. 上线顺序

1. `wrangler d1 export` 备份线上库。
2. `wrangler d1 migrations apply DB --remote` 应用 0005（只新建表和索引）。
3. 合并 PR，等部署。
4. 线上打开几页、点几下，`npm run report -- --days 1` 能看到数字。

## 9. 不做

- 第三方统计、Cloudflare Web Analytics（用户选了只自建）。
- 网站里的管理后台、定时发飞书（用户选了命令出报告；以后要可以在报告上加）。
- 停留时长、滚动深度、热力图。
- 排除维护者自己的访问、尊重浏览器「请勿追踪」、页脚隐私说明（用户这次都没选）。
