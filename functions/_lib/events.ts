// 埋点事件表：前端 site/.vitepress/theme/track.ts、后端 POST /api/events、报告脚本 scripts/report.mjs 共用。
// 事件名和字段只在这里定义；改了要同步 docs/dev/TRACKING.md 第 3 节的事件表（单测会核对两边一致）。
// 加事件、加字段不用迁移数据库：props 整体存成 JSON。删字段或改字段含义要先问维护者，旧数据的报表会跟着变。

// author 是头像线（决策 73）新加的作者主页 /authors/<登录名>，slug 取登录名。
export const PAGE_TYPES = ['home', 'bot', 'squad', 'prompts', 'prompt', 'skills', 'skill', 'author', 'submit', '404', 'other'] as const
export type PageType = typeof PAGE_TYPES[number]

export const DEVICES = ['mobile', 'desktop'] as const
export type Device = typeof DEVICES[number]

export type PropSpec =
  | { readonly type: 'str'; readonly max: number }
  | { readonly type: 'enum'; readonly values: readonly string[] }
  | { readonly type: 'int'; readonly min: number; readonly max: number }
  | { readonly type: 'bool' }

const str = (max: number) => ({ type: 'str', max }) as const
const oneOf = <const T extends readonly string[]>(...values: T) => ({ type: 'enum', values }) as const
const int = (min: number, max: number) => ({ type: 'int', min, max }) as const
const bool = { type: 'bool' } as const

export const EVENTS = {
  // 每进一个页面发一次：首次打开和站内跳转都算；只改查询串或锚点不算。
  page_view: {
    landing: bool, // 这次会话的第一页
    ref: str(80), // 只在 landing 时有：外站来源的域名（document.referrer 的 host，同站或为空就不带）
    prev: oneOf(...PAGE_TYPES), // 只在站内跳转时有：上一页的页面类型
    utm_source: str(40), // 下面三个只在 landing 时有，取自地址栏
    utm_medium: str(40),
    utm_campaign: str(40),
  },
  // 拿走：导入 Bot（热度照旧走 /api/click，这里另记一份带上下文的）
  bot_import: {
    from: oneOf('card', 'featured', 'detail', 'squad_lineup', 'squad_setup'),
    squad: str(40), // from 是 squad_* 时，小队 slug
    direct: bool, // 走了 grokbot:// 协议唤起；false 表示只打开了 x.ai 模板页
    trial: oneOf('none', 'copied', 'failed'), // 导入时顺带复制试跑句的结果；没有试跑句是 none
    mod: bool, // 按着 Cmd/Ctrl/Shift 或中键点的（浏览器自己开新标签）
  },
  // 导入后 3 秒页面没失焦、出现「没装 Grok Bot？去下载」：疑似没装 App
  bot_no_app: {},
  bot_copy_prompt: { from: oneOf('card', 'featured', 'detail'), ok: bool }, // ok=false 表示剪贴板不可用、退回了手动复制
  bot_copy_starter: { index: int(0, 50), ok: bool },
  squad_start: {}, // 点「开始组队」
  squad_copy: { which: oneOf('kickoff', 'tryout'), ok: bool },
  prompt_copy: {
    from: oneOf('list', 'list_open', 'detail_side', 'detail_body', 'detail_en'),
    lang: oneOf('translated', 'original'), // translated = 复制的是本站中文译文；original = 复制的是原文
    ok: bool,
  },
  prompt_open: {}, // 在 Prompt 列表里展开一条长文（收起不记）
  skill_copy: { what: oneOf('command', 'body', 'example'), agent: str(30), index: int(0, 20), ok: bool }, // example = 复制作者示例里的提问（决策 67 的示例区）
  // 点站外链接（全站统一监听）。已经由上面的事件记过的链接（导入按钮）不再记。
  outbound: {
    host: str(60),
    to: str(160), // host + pathname，不带查询串和锚点
    kind: oneOf('download', 'author', 'source', 'license', 'repo', 'pr', 'other'),
  },
  // 找东西
  filter: {
    where: oneOf('shelf_role', 'shelf_sort', 'collection', 'library_cat'),
    value: str(60), // 分组中文名 / rec|new|hot / 专题 slug / 分类中文名；清除专题记 none，回到全部记「全部」
    results: int(0, 100000), // 切完之后列表里有几条
  },
  library_search: { q: str(40), cat: str(20), results: int(0, 100000) }, // Prompt/Skills 列表的搜索框，停手 1.5 秒后记最终词
  search: {
    // ⌘K 全站搜索面板：面板关闭或选中结果时记一次，没输入不记
    q: str(40),
    results: int(0, 100000),
    via: oneOf('shortcut', 'slash', 'button'),
    picked: bool,
    pick_type: oneOf('bot', 'squad', 'prompt', 'skill'),
    pick_rank: int(0, 50),
  },
  // 投稿漏斗：一个事件名，step 区分步骤，方便按步骤数会话
  submit_step: {
    step: oneOf(
      'view', 'copy_prompt', 'read', 'bundle_error', 'checked', 'login_click', 'login_back',
      'submit_click', 'submitted', 'submit_fail', 'progress', 'issue_fallback', 'inapp',
    ),
    ok: bool,
    code: str(40),
    n: int(0, 1000),
    via: oneOf('paste', 'link', 'resume'),
    mode: oneOf('new', 'update'),
    pr: int(1, 100000000),
  },
} as const satisfies Record<string, Record<string, PropSpec>>

export type EventName = keyof typeof EVENTS

type PropValue<S> = S extends { type: 'str' } ? string
  : S extends { type: 'enum'; values: readonly (infer V)[] } ? V
    : S extends { type: 'int' } ? number
      : boolean
export type EventProps<N extends EventName> = { [K in keyof typeof EVENTS[N]]?: PropValue<typeof EVENTS[N][K]> }

// 「拿走」：用户把东西拿去用了。北极星指标按这组算，不论 ok 是真是假（退回手动复制也多半复制走了）。
export const TAKE_EVENTS = ['bot_import', 'bot_copy_prompt', 'bot_copy_starter', 'squad_copy', 'prompt_copy', 'skill_copy'] as const satisfies readonly EventName[]

export const EVENT_LIMITS = {
  bodyBytes: 16_384, // 一批请求体上限（UTF-8 字节）
  perBatch: 30, // 一批最多几条
  pathMax: 200,
  agoMaxMs: 600_000, // 事件发生到发出的最长间隔，超过按上限算
} as const

export const EVENT_RETENTION_DAYS = 400
// 搜索词原文比事件保留得短，清理时只移除 q，不影响搜索次数统计。
export const QUERY_RETENTION_DAYS = 90
export const QUERY_EVENTS = ['search', 'library_search'] as const satisfies readonly EventName[]
