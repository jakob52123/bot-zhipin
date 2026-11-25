# 网站直投接口约定（S3）

前后端、CLI、工作流共用这份约定。改接口、错误码、cookie、回执格式或限额前先改这里。交互和文案见 `INTERACTION-SUBMIT.md`。

## 0. 一句话

AI 生成 `https://bot.jiachengbo.com/submit#BZB1:…` → 投稿人在 `/submit` ① 检查投稿包并预览、② 用 GitHub 登录、③ 授权并提交（2026-11-15 起不传截图，DECISIONS 第 43 条）→ Function 用 GitHub App 在 `submission/web-<数字id>-<slug>` 建单提交并开 PR、开启自动合并 → `pull_request` CI 自动跑 → 维护者 Approve → 自动合并 → `announce-live` 工作流在部署完成后评论「已上线」。

原 Issue 表单链路（`submission.yml`）保留为备用，行为见 §8。

## 1. 投稿链接

- 格式不变：`BZB1:` + base64url(gzip(明文投稿包 `BOT-ZHIPIN-BUNDLE v1`))，限额照旧（30 个文件、单文本 100KB、文本总量 400KB、解压后 512KB）。
- 链接：`${SITE.url}/submit#${token}`。`SITE.url = 'https://bot.jiachengbo.com'`，加在 `site/.vitepress/meta.mjs` 的 `SITE` 里。
- 长度上限是 `bundle-core.mjs` 导出的 `URL_LIMITS`（`submitUrl: 16000`、`issueUrl: 7500`），CLI 和浏览器共用。
- 链接超过 16000 字符时，CLI 改为输出 `${SITE.url}/submit` 加整行令牌，让投稿人打开页面后粘进「已有投稿包」输入框。粘贴框也接受明文投稿包。
- `#` 后面的内容不发给服务器。页面读到后存进 sessionStorage，再用 `history.replaceState` 去掉片段。

## 2. 校验内核（L1）

### 2.1 文件

| 文件 | 内容 | 限制 |
|---|---|---|
| `scripts/lib/bot-model.mjs` | `buildBotModel`、`modelFromBundle`、`parseFrontmatter`、`IMAGE_EXTS` | 纯函数：禁止 import `node:*`、`ajv`、`fs` |
| `scripts/lib/validate/core.mjs` | `validateModels` | 同上 |
| `scripts/lib/validate/{schema,content,images,secrets}.mjs` | 改成只吃模型、不读盘 | 同上 |
| `scripts/lib/validate/generated/bot-schema.mjs` | Ajv standalone 预编译结果，内联运行时，导出 `validate`、`schema`、`SCHEMA_SHA256` | 自动生成，提交进仓库，禁止手改 |
| `scripts/gen-schema-validator.mjs` | 生成上面那个文件；`--check` 逐字比对 | `npm run gen:schema`（带 `-- --check` 时只检查） |
| `scripts/lib/submit-fields.mjs` | `applyServerFields` | 纯函数 |
| `scripts/submission/bundle-core.mjs` | `pack` `unpack` `assertSlug` `assertFilename` `assertPath` `assertFileSet` `stripFence` `LIMITS` `TEXT_EXTS` | 纯函数；用 `TextEncoder` 量字节 |
| `scripts/submission/bundle.mjs` | 重新导出上一行全部，另有 Node 版 `encode`/`decode`（zlib，`maxOutputLength`） | 现有导出名一个不少 |
| `scripts/lib/bundle-web.mjs` | 浏览器和 Workers 用的 `encodeToken(text)`、`decodeToken(token)`：`CompressionStream`/`DecompressionStream('gzip')`，边解压边累计字节，超过 512KB 立刻中断并报 `unpack` 同款错误 | 纯 Web API |
| `scripts/submission/screenshot-plan.mjs` | `planScreenshots(bundle, images)`：命名、扩展名修正、多余图片取名 `screenshot-<n>`、改写 `.md` 里的引用；`screenshots.mjs` 的 `makeFilePlan` 改为调用它，行为不变 | 纯函数 |

`load-bots.mjs`、`validate/index.mjs`、`validate.mjs` 保留为 Node 适配器。**`validateBots({ botsDir, now })` 和 `formatResult` 的签名、错误条目、顺序、文案逐字不变，现有测试一字不改。**

### 2.2 模型

```js
/** FileEntry：rel 是相对 Bot 文件夹的 POSIX 路径，如 'bot.yaml'、'skills/a/SKILL.md'、'screenshots/x.png'
 *  { rel, size, text: string|null, head?: Uint8Array, format?: 'png'|'jpeg'|'webp'|'gif'|null }
 *  text：UTF-8 文本；图片或超过 100KB 的非图片为 null
 *  head：前 16 字节；也可以直接给 format（服务端只有截图回执，没有字节） */
buildBotModel(slug, { files: FileEntry[], dirs?: string[], symlinks?: string[] })
// 返回字段与现在 loadBot 一致：slug, raw, data, yamlError, role, design, routines, avatar, skills, screenshots, files, symlinks；
// 路径字段全部是 rel。Node 适配器再补 dir、yamlPath、各文件的绝对 path，给 sync-assets.mjs 和 site 数据加载器用。

modelFromBundle(bundle /* unpack 的结果 */, images /* [{ name, size, format }] 按最终文件名 */)
```

### 2.3 校验

```js
validateModels(models, { template, now, others = [], policy = {} }) // → { errors, warnings }
```

- `models`：要报错的 Bot（CLI 传全集，投稿只传 1 个）。
- `template`：`_template` 的模型，由调用方提供。Node 从磁盘读；浏览器和 Function 读 `submit-context.json`。
- `others`：`[{ slug, templateUrl }]`，只参与查重（slug、templateUrl）和 `forkedFrom` 存在性检查，不对它们报错。查重时先放进 `others`，所以重复错误报在投稿本身上。
- `policy.submission = { login }`：
  - 禁止 `external: true`（报 `bot.yaml / external`）；
  - 要求 `author.github` 等于 `login`，忽略大小写。
- 错误条目 `{ file, where, problem, fix }`，`file` 形如 `bots/<slug>/<rel>`，和现在完全一样。按 `file|where` 用 Map 去重，每个 Bot 最多列出 50 条错误，另追加「还有 N 处问题没列出，先改完上面这些再校验」汇总（N 为去重后未列出的条目数）。
- YAML 解析前按 UTF-8 字节限制：`bot.yaml` ≤8192 字节、`SKILL.md` 的 frontmatter 内容（不含围栏）≤4096 字节。超限不解析；长内容移到 Markdown 正文。未知 schema 字段名超过 64 字符不计算编辑距离、不提供猜测字段名。现有 Bot 和 fixtures 的校验输出保持逐字一致。

### 2.4 服务端统一改写的字段

```js
applyServerFields(botYamlText, { login, addedAt }) // → 新的 bot.yaml 文本
```

- 用 `yaml` 的 Document API 改写，保留注释和其他字段的写法。
- `author.github = login`。没有 `author` 就建 `author: { name: login, github: login }`；有 `author` 但没有 `name`，补 `name: login`。
- `addedAt` 设为传入值。新投稿取北京时间当天，更新取 main 上的原值。
- 三处调用方式：
  - CLI 校验时，`login` 用占位 `submitter`（满足 GitHub 用户名格式），只用于临时副本，**不写进投稿包**；
  - 浏览器预览时，用已登录账号，没登录用 `submitter`；
  - Function 用真实登录账号。
- Issue 备用链路缺 `author.github` 时，用 Issue 作者补上（§8）。

### 2.5 构建时生成（`sync-assets.mjs`，输出到已 gitignore 的 `site/public/api-data/`）

`submit-context.json`：

```json
{
  "v": 1,
  "commit": "<CF_PAGES_COMMIT_SHA 或 git rev-parse HEAD 或 'local'>",
  "schemaSha256": "<与 generated 文件一致>",
  "index": [{ "slug": "quota-saver", "name": "…", "templateUrl": "…", "authorGithub": "…或 null", "addedAt": "2026-11-14", "external": true }],
  "template": { "files": { "bot.yaml": "…", "ROLE.md": "…", "DESIGN.md": "…", "routines.md": "…", "skills/example-skill/SKILL.md": "…" } },
  "copy": { "permissions": { "<权限>": "<说明>" }, "quota": { "<档位>": "<说明>" } },
  "limits": { "files": 30, "fileBytes": 102400, "totalBytes": 409600, "imageBytes": 2097152 }
}
```

- `index[]` 里写了中文叫法的 Bot 多一个 `nameZh`（没写的不带这个键）；投稿预览用它给「改编自」那一行写原 Bot 的中文叫法。
- `copy` 取自 `explanations()`，给预览页用（浏览器不能 import 用了 `node:fs` 的 `bots.mjs`）。

`build.json`：`{ "commit": "<同上>", "builtAt": "<ISO 时间>" }`，给上线通知判断「这个提交部署了没有」。

## 3. 后端（L2a、L2b）

### 3.1 环境变量

| 名字 | 类型 | 放哪 | 说明 |
|---|---|---|---|
| `SUBMIT_REPO` | 变量 | `wrangler.toml [vars]` | `jakob52123/bot-zhipin` |
| `GITHUB_APP_ID` | 变量 | 同上 | App 建好后填 |
| `GITHUB_APP_INSTALLATION_ID` | 变量 | 同上 | 同上 |
| `GITHUB_APP_BOT_LOGIN` | 变量 | 同上 | 形如 `bot-zhipin-submit[bot]` |
| `OAUTH_CLIENT_ID` | 变量 | 同上 | 零 scope OAuth App |
| `GITHUB_APP_PRIVATE_KEY` | **加密** | Cloudflare 后台 / `wrangler pages secret put` | PKCS#8 PEM（`-----BEGIN PRIVATE KEY-----`） |
| `OAUTH_CLIENT_SECRET` | **加密** | 同上 | |
| `SESSION_SECRET` | **加密** | 同上 | ≥32 字节随机 |
| `SESSION_SECRET_PREV` | 加密，可选 | 同上 | 换密钥期间仍可验旧 cookie 和回执 |
| `SUBMIT_DRY_RUN_USER_IDS` | 变量 | `[vars]` | 逗号分隔的 GitHub 数字 id；只有这些人能用 `dryRun` |
| `ALLOW_TEST_ENDPOINTS` | 变量 | 只在 `.dev.vars` | `1` 时才读 `GITHUB_API_BASE`、`GITHUB_OAUTH_BASE`（指向本地假 GitHub）和 `X-Test-IP`；线上不设置 |

- 上面任何一项缺失（`SUBMIT_DRY_RUN_USER_IDS`、`SESSION_SECRET_PREV` 除外），`/api/submit*` 和 `/api/auth/start` 返回 503 `submit_disabled`，页面切到「改用 GitHub Issue 投稿」。
- `wrangler.toml` 里，ID 类变量在 App 建好前留空字符串。
- 测试主机只允许 `127.0.0.1`、`localhost`、`[::1]` 和以 `.test` 结尾的主机名。`ALLOW_TEST_ENDPOINTS=1` 时，请求主机不在此集合，所有 `/api/auth/*`、`/api/submit*`（含不支持的方法）均返回 503 `submit_disabled`；两个 GitHub base 必须配置且主机在此集合，否则同样 503，不回退到真实 GitHub。URL 使用方原有的协议、凭据、路径校验保持不变。未开测试开关时保持线上行为，忽略测试 base。

### 3.2 公共约定

- 返回 JSON：`{ ok: true, ... }` 或 `{ ok: false, error: <码>, message: <给人看的中文>, errors?, retryAfter?, requestId? }`。`Cache-Control: no-store`，`X-Content-Type-Options: nosniff`，`Content-Security-Policy: frame-ancestors 'none'`。
- 写接口（POST）全部满足：
  - 带 `Origin` 时必须等于本站；`Sec-Fetch-Site` 有值时必须是 `same-origin`。否则 403 `forbidden_origin`。
  - 只收 `application/json` 或 `image/png|jpeg|webp|gif`，否则 415 `unsupported_type`。
  - 不回应 OPTIONS，不发任何 CORS 头。
  - 把 `functions/_lib/http.ts` 的 `validateClickHeaders` 抽成通用的 `assertSameOrigin`，计数接口行为不变。
- 不对外返回 GitHub 的错误原文；内部错误给 502 `github_error` 加 `requestId`（8 位随机），不记录任何令牌。
- 限流键：登录相关用 `ip.ts` 的加盐 IP 哈希，登录后用 GitHub 数字 id。

### 3.3 会话和登录

**cookie：**

| 名字 | 属性 | 内容 | 有效期 |
|---|---|---|---|
| `__Host-bz_oauth` | HttpOnly; Secure; SameSite=Lax; Path=/ | `{ state, verifier, exp }`，HMAC 签名 | 10 分钟 |
| `__Host-bz_s` | HttpOnly; Secure; **SameSite=Strict**; Path=/ | `{ v:1, id, login, iat, exp }`，HMAC-SHA256 签名 | 2 小时 |

- 签名格式：`base64url(JSON).base64url(HMAC)`。验签用常数时间比较，先试 `SESSION_SECRET`，再试 `SESSION_SECRET_PREV`。
- 本地 `wrangler pages dev` 是 http。`ALLOW_TEST_ENDPOINTS=1` 时 cookie 名去掉 `__Host-` 前缀、不加 Secure，其余属性不变。

**接口：**

- `GET /api/auth/start`
  - 只处理 `Sec-Fetch-Mode` 缺失或为 `navigate` 的请求；其他值直接 400 `bad_request`，不计数、不设 cookie。
  - 限流：每 IP 每小时 120 次。
  - 生成 32 字节 `state` 和 PKCE `verifier`（S256），写 oauth cookie。
  - 302 到 `${OAUTH_BASE}/login/oauth/authorize`，参数：`client_id`、`redirect_uri=${origin}/api/auth/callback`、`state`、`code_challenge`、`code_challenge_method=S256`、`allow_signup=true`。**不带 scope。**
- `GET /api/auth/callback?code&state`
  - 校验 oauth cookie 和 state。
  - 换令牌：`POST ${OAUTH_BASE}/login/oauth/access_token`，带 `client_id`、`client_secret`、`code`、`redirect_uri`、`code_verifier`，`Accept: application/json`。
  - `GET ${API_BASE}/user`，只接受 `type === 'User'`，取 `id`、`login`。
  - **立即撤销令牌**：`DELETE ${API_BASE}/applications/${client_id}/token`，Basic 认证，body `{ access_token }`。撤销失败也继续登录，但记一条不含令牌的日志。
  - 清掉 oauth cookie，写会话 cookie，302 `/submit?login=ok`。
  - 失败时 302 `/submit?login=cancelled|expired|failed`：用户点了拒绝是 `cancelled`，state 不对或过期是 `expired`，其余是 `failed`。
  - `/api/auth/start` 被限流时不跳 GitHub，直接 302 `/submit?login=failed&retry=<秒>`。
  - **不接受任何 returnTo 参数。**
- `GET /api/auth/me`：已登录返回 200 `{ ok:true, id, login }`，否则 401 `unauthenticated`。头像由前端用 `https://avatars.githubusercontent.com/u/<id>?s=56` 拼。
- `POST /api/auth/logout`：清 cookie，返回 204。

### 3.4 旧页面兼容接口

`functions/api/submit/screenshot.ts` 仍处理 `POST /api/submit/screenshot`；当前前端不调用。上传协议见附录，提交时的回执校验见 §3.5。

### 3.5 提交 `POST /api/submit`

请求体（JSON，≤ 700KB）：

```json
{ "bundle": "<BOT-ZHIPIN-BUNDLE v1 明文>", "license": true }
```

以上是当前页面发送的正文；`dryRun` 是接口的可选字段。处理顺序：

1. 要求登录。`license !== true` 返回 400 `license_required`。`dryRun` 为 true 但当前用户 id 不在 `SUBMIT_DRY_RUN_USER_IDS` 里，返回 403。
2. 校验前仅计 `submit-try`（每人每小时 40 次）；解出 slug 后，非 dryRun 再计 `submit-slug`（同一人同一 slug 每 2 分钟 1 次）。每人每天 10 次和全站每小时 20 次的发布额度延后到第 10 步之后扣。超限返回 429 `rate_limited`，带 `retryAfter` 秒数和 `Retry-After` 头。
3. 只 `unpack` 一次明文，允许首尾空白和代码围栏；`BZB1:` 一律 400 `bad_request`，不调用 `decodeToken`，不做服务端解压。浏览器仍可解压链接，原生 base64url strict 解码优先，旧浏览器回退；发送给服务端的始终是明文。解包同时拒绝非良构 UTF-16（孤立代理码元），失败带 `errors`。
4. 回执：`screenshots` 可以不传，也可以是空数组，都当作零张（2026-11-15 起新页面不再带这个字段）；传了就必须是数组。`verifyReceipts` 对旧页面传来的回执检查数量、签名、类型版本、SHA、大小和格式，`uid` 必须等于当前用户，未过期。失败返回 400 `receipt_invalid`，带 `slots: [下标]`（对应请求数组的位置，从 0 开始）。
5. 拿安装令牌：用 App 私钥签 RS256 JWT，`POST /app/installations/{id}/access_tokens`，参数 `{ repositories: ['bot-zhipin'], permissions: { contents:'write', pull_requests:'write' } }`。令牌在 isolate 内存里缓存，最多 50 分钟。
6. `GET /git/ref/heads/main` 拿 `mainHead`；`GET /git/commits/{mainHead}` 拿根 tree。
7. 判断是谁的：`GET /contents/bots/{slug}/bot.yaml?ref={mainHead}`。
   - 404：是新投稿，`addedAt` 取北京时间当天，不查询 `bot_owners`；成功建好 PR 后写入或覆盖数字 id 绑定。
   - 已存在：`external: true` 仍返回 409 `slug_taken`。`bot_owners` 有记录时只比较 `user_id` 与会话 id，不同返回 409，不再比较 login（支持改名，防旧用户名被接管）。
   - 已存在但没有绑定记录（老 Bot）：沿用 `author.github` 与 login 忽略大小写的核对，不同返回 409。通过则沿用原 `addedAt`，PR 标题前缀改为「⚠ 更新已上架 Bot：」，正文开头加醒目提示「这个 Bot 之前没有绑定作者数字 ID，只按 GitHub 用户名核对，请人工确认是原作者」。成功建好或更新 PR 后写入绑定。
8. 同时未合并的网站投稿 PR（见 `web_submissions` 表）达到 3 个且不是在更新其中一个时，返回 409 `pr_limit`，带 `pulls: [{ number, url, slug }]`。数之前先查这几个 PR 的状态，把已合并或已关闭的行删掉。
9. `applyServerFields` 改写 `bot.yaml`；`planScreenshots` 定截图文件名并改写 Markdown 里的引用（没有回执时忽略投稿包里的 screenshots 文件名段，不放截图）；`modelFromBundle` 建模型；用 `submit-context.json`（经 `ASSETS.fetch`，60 秒缓存，照 `slugs.ts` 的写法）调 `validateModels`，参数 `{ template, now, others: index 去掉本 slug, policy: { submission: { login } } }`。有错误返回 422 `invalid`，带 `errors`（含密钥扫描结果）。**校验和密钥扫描必须在任何 GitHub 仓库写操作之前完成。** 改写后模型还必须严格满足 `author.github === login`、`addedAt === 预期值`；不满足返回 422，问题「bot.yaml 的作者或日期字段写法特殊，无法自动填写」，改法「用普通的 `author:` 和 `addedAt:` 写法」。
10. `dryRun` 到这里结束，返回 200 `{ ok:true, dryRun:true, slug, update, files: [路径…], warnings }`；只扣 `submit-try`，不写 `bot_owners`。非 dryRun 此时才扣 `submit`、`submit-all`，通过后才能开始首次 GitHub 写入。
11. 建 tree：
    - 第一次 `POST /git/trees`，不带 base_tree：文本条目用 `content` 内联，截图条目用 `sha`；`mode` 一律 `100644`，`type` 一律 `blob`；路径相对 `bots/<slug>/`。
    - 第二次 `POST /git/trees`：`base_tree` 设为 main 的根 tree，只放一个条目 `{ path: 'bots/<slug>', mode: '040000', type: 'tree', sha: <上一步的子树> }`。
    - 联调要确认这样会整体替换旧目录。不行的话，改成读旧子树，对旧有、新没有的文件写 `sha: null`。
12. `POST /git/commits`：`message` 是 `新增 Bot：<name>（网站投稿）` 或 `更新 Bot：<name>（网站投稿）`；`author = { name: login, email: '<id>+<login>@users.noreply.github.com' }`；`committer` 不填（默认是 App）；`parents: [mainHead]`。
13. 分支 `refs/heads/submission/web-<id>-<slug>`：不存在就 `POST /git/refs` 建，存在就 `PATCH`（force）。分支名先过正则 `^submission/web-[1-9]\d{0,19}-[a-z0-9]+(?:-[a-z0-9]+)*$`。
14. 查 head 为 `owner:<分支>` 的已开 PR：没有就建（`base: main`），有就更新标题和正文。PR 正文模板见 §3.7。
15. GraphQL `enablePullRequestAutoMerge(input: { pullRequestId, mergeMethod: MERGE })`。失败不报错，`autoMerge: false` 并带一条 warning。
16. upsert `web_submissions`；`bot_owners` 在第 14 步 PR 成功后 upsert（失败不绑定，dryRun 不绑定）。
17. 返回 200：`{ ok:true, slug, update, branch, pr: { number, url }, liveUrl: '<SITE.url>/bots/<slug>', autoMerge, warnings }`。`errors`/`warnings` 的条目一律是 `{ file, where, problem, fix }`。

GitHub 客户端（`functions/_lib/github.ts`）只导出上面用到的固定操作（`createBlob`、`getRef`、`getCommit`、`getContent`、`createTree`、`createCommit`、`upsertRef`、`findOpenPr`、`createPr`、`updatePr`、`enableAutoMerge`、`getPr`、`getChecks`、`getReviews`、`compare`、`installationToken`、OAuth 的三个调用）。**不导出通用的 request 方法。** 每个方法内部检查 URL 落在 `/repos/${SUBMIT_REPO}/…`、`/app/installations/${id}/access_tokens`、`/user`、`/applications/${client_id}/token`、`/login/oauth/*`、`/graphql` 之内，写 ref 的方法再检查一次分支正则。

### 3.6 状态 `GET /api/submit/status?pr=<n>`

- 不要求登录。限流：每 IP 每分钟 30 次。PR 的 head 分支必须匹配 `^submission/(web-\d+-[a-z0-9-]+|issue-\d+)$`，否则 404。
- 返回：

  ```json
  { "ok": true, "state": "checking|failed|waiting_review|approved|merged|live|closed", "checks": "pending|success|failure", "slug": "…", "url": "…", "liveUrl": "…或 null" }
  ```

- 缓存按 PR 号分两层：isolate 内存 Map + D1 `pr_status`，`checking` 缓存 30 秒，其余成功状态 120 秒。内存有界，D1 保留最后结果供过期兜底；命中任一有效缓存时完全不调 GitHub，同 isolate 的同 PR 并发刷新合并。
- 真正刷新前扣全站 `status-gh`（每小时 600 次，按一次状态刷新计，不是每条 REST 调用计）。超预算返回缓存，即使已过期；无缓存返回 503 `github_error`，文案「状态暂时刷新不了，过一会儿再看」。失败或非投稿 PR 不缓存；普通 GitHub 故障仍用原 502 处理。缓存对外仍是 `Cache-Control: no-store`。
- 判断规则：
  - 已关闭但没合并 → `closed`；
  - 已合并：本部署 `build.json` 的 `commit` 与 merge 提交相同或在其后（`compare` 的 status 是 `identical` 或 `ahead`）→ `live`，否则 `merged`；
  - 没合并：`validate-and-build` 检查失败 → `failed`；还没结束 → `checking`；通过且有有效的 APPROVED → `approved`；否则 `waiting_review`。

### 3.7 PR 正文模板

```markdown
## 网站投稿

- Bot：`bots/<slug>/`（<新增|更新>）
- 投稿人：@<login>（GitHub 账号已登录验证）
- 提交作者记为投稿人，合并后计为贡献者。
- 自动检查：校验器和密钥扫描在推送前已通过<，N 条提醒请复核>；构建以 validate-and-build 为准。
- 投稿人已在投稿页勾选 CC BY 4.0 授权，并确认内容有权公开。
- 已开启自动合并：批准且检查通过后自动用普通合并合入。

## 维护者核对（机器判断不了）

- [ ] 设计说明是真实经历，没有编造效果
- [ ] 设计说明「实际效果」里摘的输出像这个 Bot 的真实输出，没有露出隐私、密钥或公司内部信息
- [ ] 声明的权限和额度如实
- [ ] 模板链接在无痕窗口能打开

<!-- bot-zhipin-web-submission uid=<id> slug=<slug> -->
```

### 3.8 D1（`migrations/0002_submit.sql`、`0003_submit_hardening.sql`）

```sql
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT NOT NULL, key TEXT NOT NULL, window INTEGER NOT NULL,
  n INTEGER NOT NULL DEFAULT 0, bytes INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, key, window)
);
CREATE TABLE IF NOT EXISTS web_submissions (
  user_id INTEGER NOT NULL, slug TEXT NOT NULL, pr_number INTEGER NOT NULL,
  branch TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, slug)
);
-- 0003_submit_hardening.sql；时间戳均为服务器毫秒。
CREATE TABLE IF NOT EXISTS pr_status (
  pr INTEGER PRIMARY KEY, body TEXT NOT NULL, fetched_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS bot_owners (
  slug TEXT PRIMARY KEY, user_id INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
```

- 计数用 `INSERT … ON CONFLICT DO UPDATE SET n = n + 1, bytes = bytes + ? RETURNING n, bytes`，一条语句完成。
- 过期行沿用 `scheduleCleanup` 的 1% 概率清理。

| bucket | key | 窗口 | 上限 | 计数时机 |
|---|---|---|---|---|
| `login` | IP 哈希 | 1 小时 | 120 | 登录导航（无 mode 头也允许） |
| `shot` | 用户 id | 1 天 | 60 次 / 60MB | 上传前 |
| `shot-all` | `*` | 1 天 | 1000 | 上传前 |
| `submit-try` | 用户 id | 1 小时 | 40 | 解包/校验前，含 dryRun |
| `submit` | 用户 id | 1 天 | 10 | 校验及密钥扫描通过后、首次 GitHub 写入前，非 dryRun |
| `submit-slug` | `id:slug` | 2 分钟 | 1 | 解包后、校验前，非 dryRun |
| `submit-all` | `*` | 1 小时 | 20 | 同 `submit` |
| `status` | IP 哈希 | 1 分钟 | 30 | 每次合法状态查询，含缓存命中 |
| `status-gh` | `*` | 1 小时 | 600 | 缓存未命中或过期、真正刷新前 |

计数仍采用固定窗口；预算拒绝会计入尝试数但不调用 GitHub。发布额度不是原子预占/退款机制（本轮不做）。

### 3.9 错误码

| 码 | HTTP | message（服务端默认文案，前端以 INTERACTION-SUBMIT.md 为准） |
|---|---|---|
| `bad_request` | 400 | 投稿包格式不对，请让你的 AI 重新生成链接。 |
| `license_required` | 400 | 请先勾选授权。 |
| `receipt_invalid` | 400 | 有截图需要重新上传（带 `slots`）。 |
| `unauthenticated` | 401 | 请先用 GitHub 登录。 |
| `session_expired` | 401 | 登录已过期，请重新登录。 |
| `forbidden_origin` | 403 | 请在本站页面里提交。 |
| `not_found` | 404 | 找不到这个投稿。 |
| `slug_taken` | 409 | 这个英文短名已被别人使用，请让 AI 换一个。 |
| `pr_limit` | 409 | 你还有 3 个投稿在等待审核，先等它们处理完（带 `pulls`）。 |
| `too_large` | 413 | 文件太大了。 |
| `unsupported_type` | 415 | 只支持 PNG、JPG、WEBP、GIF 截图。 |
| `invalid` | 422 | 还没通过检查（见 errors）。 |
| `rate_limited` | 429 | 操作太频繁，请稍后再试（`Retry-After` 头 + `retryAfter` 秒）。 |
| `github_error` | 502 / 503 | 普通上游故障 502：GitHub 暂时没响应，请稍后再试（带 `requestId`）。状态刷新预算耗尽且没有缓存时 503：状态暂时刷新不了，过一会儿再看。 |
| `submit_disabled` | 503 | 网站投稿暂时关闭，请改用 GitHub Issue 投稿。 |

## 4. 前端（L3 逻辑、L4 界面）

- 页面 `site/submit.md`（`layout: page`），组件只在这一页 import，**不进 `theme/index.ts`**，首页打包产物里不能出现 markdown-it 和校验内核。
- L3 提供 `site/.vitepress/theme/submit/` 下的 TS 模块，L4 只调用它们：
  - `bundle.ts`：读片段或粘贴内容 → 明文；
  - `context.ts`：取 `/api-data/submit-context.json`；
  - `preview.ts`：根据投稿包生成预览，复用共享的摘要和安全 Markdown 渲染规则；本地截图引用只留说明文字；
  - `validate.ts`：调 `validateModels`；
  - `api.ts`：`me`、`startLogin`、`logout`、`submit`、`status`；
  - `store.ts`：草稿（明文、令牌、授权状态、结果）保存在 sessionStorage 的 `bz-submit`；不暂存截图或回执，存储失败不阻断流程；
  - `issue-fallback.ts`：生成预填的 GitHub Issue 链接。
- 预览安全：
  - 没通过 schema 的字段不进任何 `href` 或 `src`；
  - `BotCard`、`BotDetail`、`BotActions`、`BotHeat` 加 `preview` 属性：不上报点击、不请求热度，内链和源码链接改成不可点或页面内锚点；
  - `scripts/gen-headers.mjs` 在构建后生成 `dist/_headers`：
    - `/*`：`Content-Security-Policy: frame-ancestors 'none'`
    - `/submit`、`/submit.html`（登录是整页跳转到 `/api/auth/start`，不受 `connect-src` 限制）：`default-src 'self'; script-src 'self' <构建后 submit.html 内联脚本的 sha256 列表>; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://avatars.githubusercontent.com; connect-src 'self'; base-uri 'none'; form-action 'self'; object-src 'none'; frame-ancestors 'none'`
    - 构建后要用脚本确认所有内联脚本都被哈希覆盖。

## 5. CLI（L5）

- `node scripts/make-submission-link.mjs bots/<slug>`：本地校验时缺 `author.github` 就用 `applyServerFields` 填占位值，投稿包本身不改。
- 输出第一行是 `${SITE.url}/submit#BZB1:…`。后面几行是给投稿人的提示：「点开链接 → 页面上用 GitHub 登录 → 勾授权 → 提交」（不再有拖截图这一步）。
- 超过 16000 字符走 §1 的退路。
- `--issue` 参数照旧输出 GitHub Issue 预填链接（备用）。
- `site/.vitepress/meta.mjs`：`SITE.url`；`submitPrompt()`（全文见 INTERACTION-SUBMIT.md §4.2）；`CONTRIBUTE_URL` 改成站内 `/submit`，首页「我要投稿」和空状态「做第一个投稿的人」都链到它（站内链接，去掉外链标记）。

## 6. 上线通知（L6）

- `.github/workflows/announce-live.yml`：`on: push: branches: [main]`；权限 `contents: write`（删分支）、`pull-requests: write`、`issues: write`；签出默认分支的可信代码，运行 `node scripts/announce-live.mjs`，参数用 env 传入（`GH_TOKEN`、`SHA`、`REPO`、`SITE_URL`、`APP_BOT_LOGIN=${{ vars.SUBMIT_APP_BOT_LOGIN }}`）。并发组 `announce-live`，不取消进行中的运行。
- 逻辑：
  1. `GET /commits/{SHA}/pulls`，只处理同时满足以下条件的 PR：已合并到 main；head 分支匹配 `^submission/(web-\d+-[a-z0-9-]+|issue-\d+)$`；PR 作者是 `github-actions[bot]` 或 `APP_BOT_LOGIN`。
  2. 从 PR 的文件列表取唯一的 slug。
  3. 每 15 秒轮询 `${SITE_URL}/api-data/build.json`，最多 10 分钟，直到 `commit` 等于 SHA 或在其后（用 compare 判断）；再确认 `${SITE_URL}/bots/<slug>` 返回 200。
  4. 在 PR 上评论（带隐藏标记 `<!-- bot-zhipin-live -->`，已经有就跳过）：`🎉 已上线：<链接>。感谢 @<投稿人>，你已成为 Bot 直聘的贡献者。` 投稿人取 PR 正文里的「投稿人：@login」或提交作者。来自 Issue 的 PR 也在来源 Issue 下评论一次。
  5. 删除 head 分支，已经删了就跳过。
  6. 超时时退出码 1，工作流失败，GitHub 会发邮件提醒维护者。
- `scripts/check-pr-scope.mjs`：修改已存在的 `bot.yaml` 时，`author.github` 不许变（忽略大小写）。
- `.github/CODEOWNERS`：`* @jakob52123`。
- `ci.yml`：通过 `env` 传入 PR 作者和 `author_association`，方便联调核对，不把事件字段直接插值进 `run`。范围检查用 `--pr-author` 核对人工 fork PR 的新增署名；`--app-bots` 里的 `bot-zhipin-submit[bot]`（网站已将 `author.github` 改写为登录人）和 `github-actions[bot]`（Issue 工作流已核对署名是 Issue 作者）只跳过这项检查，手动派发没有 PR 作者时也一样。

## 7. 安全边界

- **投稿始终是数据**：不执行、不 eval，Markdown 用 `html:false`；外链图片只渲染成链接。
- **推送等于公开**：校验和密钥扫描必须在建 tree 之前做完。
- **App 权限**：只开 Contents RW、Pull requests RW、Metadata R；不开 Workflows（推不了 `.github/workflows/`）；不开 webhook；只装 bot-zhipin。
- **写入范围**：
  - 代码层：分支名白名单，tree 只放 `bots/<slug>`，mode 只有 100644 和 040000；
  - 规则集层：只允许 `main`（PR）和 `submission/**` 被写，tag 受限。
- **防误合并**：保留 `dismiss_stale_reviews_on_push`；要求代码所有者批准；自动合并只在批准且检查通过后才会触发。
- **对象库滥用**：只收图片文件头，每张 ≤2MB，必须登录，按人和全站限额。被上传但没提交的 blob 留在对象库里会被 GitHub 回收，接受这个边界。
- **链接只发给本人**：链接被转给别人时，对方可以用自己的账号提交、抢走署名。PR 上显示投稿人，维护者审核时核对。

## 8. Issue 备用链路的变化（L5）

- `issue.mjs`：`author.github` 缺失时，用 Issue 作者补上（调用 `applyServerFields`，只改 github 和缺失的 name，addedAt 规则不变）；填了但不一致时仍然报错（防冒名）。
- 成功评论里加一句：「下次可以直接在网站上投稿，更快：<SITE.url>/submit」。

## 9. 线上联调记录（2026-11-15）

用维护者账号在生产环境走完一遍，结论：

- **新增**：投稿页提交 → App 开 PR（作者 `bot-zhipin-submit[bot]`，提交作者是投稿人的 noreply 邮箱）→ `pull_request` CI 不用人批准就自动运行（`author_association=NONE`，走严格范围检查）→ 自动合并已开启（MERGE）→ 维护者 Approve 后约 50 秒自动合并 → 约 45 秒后 `上线通知` 评论「已上线」并删除投稿分支 → 投稿页进度自己走到「已上线」。
- **更新**：同一账号再投同名 Bot，标题变为「更新 Bot」，`addedAt` 沿用原值；第二层 tree 用一个 `040000` 条目**确实整体替换旧目录**（去掉的 `routines.md` 在 PR 里显示为删除），其他 Bot 不受影响。§3.5 第 11 步的备用方案不需要。
- **授权页**：零 scope OAuth App 显示「Public data only · Limited access to your public data」。
- **CPU**（`wrangler pages deployment tail` 实测，18 次 dryRun 加真实提交）：普通投稿 8–17ms，接近上限的大投稿包（36 万字节、29 个文件）22–44ms，1.9MB 截图上传 64ms，冷启动首个请求 28ms。全部 `outcome: ok`，没有 `exceededCpu`，但都高于免费版名义上的 10ms。流量上来后如果出现 1102 错误，先升级 Workers Paid，再考虑拆接口。
- **Node 版本**：CI 用 Node 22，没有 `Uint8Array.fromBase64`；依赖这个原生方法的测试要 `skipIf`。workerd 里有原生 `toBase64`，不需要 `nodejs_compat`。

## 附录：截图（决策 43 已去掉）

### 旧页面使用的上传协议 `POST /api/submit/screenshot`

> 2026-11-15 起前端不再调用这个接口（DECISIONS 第 43 条）。接口保留，只为兼容部署时还开着旧页面的人；下面的规格不变。

- 要求登录，否则 401。请求体就是图片原始字节，`Content-Type: image/png|jpeg|webp|gif`；`Content-Length` 必填且 ≤ 2097152，否则 413 `too_large`。读的时候边读边计数，超了立刻中断。
- 校验文件头，格式必须和 Content-Type 同属一类（jpeg/jpg 视为同类），否则 415。
- 编码：用原生 `Uint8Array.prototype.toBase64`；没有就在 `wrangler.toml` 加 `compatibility_flags = ["nodejs_compat"]`，改用 `Buffer`。**禁止**用纯 JS 循环做 base64。
- 拼出 `{"encoding":"base64","content":"…"}`，调 `POST /repos/{repo}/git/blobs`。
- 不需要自定义请求头（页面用 XHR 读上传进度，同源请求）。槽位顺序由提交时 `screenshots` 数组的顺序决定。
- 返回 200：`{ ok:true, receipt, sha, size, format, exp }`，`exp` 是回执过期时间（毫秒时间戳，现在 + 24 小时）。
  - `receipt = base64url(JSON{ t:'r', v:1, uid, sha, size, format, exp: 现在+24h }).base64url(HMAC)`。
- 限流：每人每天 60 次或 60MB；全站每天 1000 次。

旧前端用 XHR 显示上传进度，超过 2MB 的非 GIF 用 canvas 压成 JPEG；在 localStorage 按 slug 暂存回执和缩略图，按 `exp` 过期，预览用 blob URL 显示图片。这些不是当前前端的实现要求。
