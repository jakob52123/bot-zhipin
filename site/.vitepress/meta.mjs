// 站点级配置：站名、仓库地址、安装提示词、默认台词。全站只在这里改。
export const AUTHOR_COPY = {
  botsTitle: 'Bot', squadsTitle: '小队',
  botCount: (n) => `${n} 个`, squadCount: (n) => `${n} 支`,
  handle: (login) => `@${login}`,
  pageTitle: (a) => `${a.name} 的${a.bots.length && a.squads.length ? ' Bot 和小队' : a.bots.length ? ' Bot' : '小队'}`,
  description: (a) => `${a.name}（@${a.login}）在 Bot 直聘上架的 ${[a.bots.length && `${a.bots.length} 个 Bot`, a.squads.length && `${a.squads.length} 支小队`].filter(Boolean).join('、')}。`,
}

export const SITE = {
  // 占位站名，正式名字定了改这里
  name: 'Bot 直聘',
  // 只给页面的 meta description 用，界面上不显示
  tagline: 'Grok Bot 模板货架：挑一个顺手的直接导入，也欢迎把你做的 Bot 挂上来。',
  repo: 'https://github.com/jakob52123/bot-zhipin',
  // 正式域名（2026-11-15 起）。旧地址 bot-zhipin.pages.dev 还能打开，页面头部的脚本会把它跳到这里（config.mts）。
  url: 'https://bot.jiachengbo.com',
  legacyHost: 'bot-zhipin.pages.dev',
  branch: 'main',
}

// 九只吉祥物：每个分组配一只（theme/color.ts 的 CATEGORY_MASCOTS，单测保证一一对应），标签页图标的颜色也从这里取。
// 它们原先站在首屏的砖墙上；首屏换成球池（货架上的真 Bot）以后不再出现在首屏。顺序别动：单测按这个顺序检查相邻不撞色。
export const HERO_MASCOTS = [
  { key: 'amber', shape: 'hex', color: '#f5a623' },
  { key: 'teal', shape: 'star', color: '#14b8a6' },
  { key: 'orange', shape: 'blob', color: '#ff6a13' },
  { key: 'pink', shape: 'sparkle', color: '#ff2e93' },
  { key: 'blue', shape: 'cloud', color: '#3b82f6' },
  { key: 'rose', shape: 'heart', color: '#f43f5e' },
  { key: 'violet', shape: 'tablet', color: '#8b5cf6' },
  { key: 'mint', shape: 'teardrop', color: '#34d399' },
  { key: 'brown', shape: 'pebble', color: '#9a6a3a' },
]

// 首页货架的固定文案。界面上不放解释性的句子（决策 37）：这里只有标题、按钮、标签、计数和状态反馈。
// 能出现在界面上的固定文字以 B2-UI 任务书第 2 节的清单为准，要加新的先问用户。
// 搜索占位字首屏搜索框和搜索面板共用。
export const SHELF_COPY = {
  searchPlaceholder: '搜索',
  searchLabel: '搜索 Bot、Prompt 和 Skills',
  contribute: '我要投稿',
  // 区块标题
  featuredTitle: '本周主推',
  collectionsTitle: '专题',
  allTitle: '全部 Bot',
  // 工具栏：分组切换（「全部」+ 各分组名 + 数量）和排序。roleLabel、sortLabel 只给读屏。
  allRoles: '全部',
  roleLabel: '按分组筛选',
  sortLabel: '排序',
  sortRec: '推荐',
  sortNew: '最新',
  sortHot: '最热',
  // 计数
  total: (count) => `共 ${count} 个`,
  groupCount: (count) => `${count} 个`,
  collectionCount: (count) => `${count} 个 Bot`,
  // 每组先露几张，其余展开
  expand: (count) => `展开 ${count} 个`,
  collapse: '收起',
  // 专题筛选条：「专题：<标题> · N 个」+「清除」
  collectionKind: '专题：',
  filterCount: (count) => ` · ${count} 个`,
  clear: '清除',
  // 筛选为空
  emptyFilter: '这个分组还没有 Bot',
  showAll: '看看全部',
}

// 每个分组一句说明。分组的取值和顺序只认 schema（bot.schema.json 的 category）；单测保证这里一个不多、一个不少。
export const CATEGORY_COPY = {
  产品: '想清楚做什么，写出来，做出来，再挑毛病',
  市场: '盯竞品，定定位，做投放，看数据',
  销售: '找客户，备会，跟进，复盘',
  内容: '找选题，写稿，剪视频',
  运营: '办活动，管行政，招人',
  学习: '学东西，跟进展，备考',
  求职: '改简历，练面试，找机会',
  管家: '管你的 Bot：省额度、备份、接飞书、派活',
  生活: '记账、健康，还有好玩的',
}

export const POKE_PITCHES = ['哎，痒！', '再戳我就变形了', '好啦好啦，我在呢', '你找我呀？']
export const ANGRY_PITCH = '别戳啦！'
export const NOT_FOUND = {
  title: '这一页走丢了',
  back: '回货架看看',
}

export const CONTRIBUTE_URL = '/submit'

// 全站页脚。用户定（2026-11-15）：创建人「贾程博 · 深圳且曼学院」，鸣谢只写且曼学院，放开源仓库链接。
export const FOOTER = {
  creatorLabel: '创建人',
  creator: '贾程博',
  org: '深圳且曼学院',
  repoLabel: '开源项目',
  license: 'MIT 许可',
  privacy: '隐私说明',
  thanksLabel: '鸣谢',
  thanks: '且曼学院',
}

/** 投稿页的定稿提示词。 */
export const submitPrompt = () =>
  [
    `请帮我把我做的 Grok Bot 投稿到「Bot 直聘」：${SITE.repo}`,
    '1. 先完整读一遍仓库根目录的 AGENTS.md，严格按它的步骤做。',
    '2. 能从你自己（或我的 Bot 配置）里查到的信息直接用，查不到的再一次问清我；不要编造效果。',
    '3. 不要向我要 GitHub 令牌或密码。',
    `4. 最后给我一个 ${SITE.url}/submit 开头的投稿链接。`,
  ].join('\n')

/** 某个 Bot 在仓库里的地址，安装提示词里用 */
export const botRepoUrl = (slug) => `${SITE.repo}/tree/${SITE.branch}/bots/${slug}`

/** 「复制安装提示词」按钮复制的内容。文字由产品定稿，改动前先确认。 */
export const installPrompt = (slug) =>
  [
    `请帮我安装一个 Bot：${botRepoUrl(slug)}`,
    '1. 先读里面的 ROLE.md、skills/ 下的所有 SKILL.md 和 routines.md，用几句话告诉我它会做什么、需要哪些权限、会访问哪些外部服务。',
    '2. 等我确认后，把这些技能保存为你的技能，按 routines.md 创建定时任务，并记住 ROLE.md 里的岗位职责。',
    '3. 装完告诉我装了什么、怎么用。',
  ].join('\n')

/** 没写 pitch 的 Bot，悬停时从这里随机挑一句。都是本站自己写的。 */
export const DEFAULT_PITCHES = [
  '挑我吧，上岗不用培训。',
  '重复的活交给我，你去想更重要的事。',
  '不画大饼，只交能用的结果。',
  '导入一次，天天替你跑腿。',
  '简历就在详情页，欢迎来面试。',
  '额度花在刀刃上，这事我在行。',
  '别急着走，点开看看我会什么。',
]

// 小队：首页区块、小队页、搜索面板里的固定文字。界面上不放解释性的句子，这里只有标题、标签、按钮和状态反馈。
export const SQUAD_COPY = {
  title: '小队',
  tag: '小队',
  count: (n) => `${n} 个 Bot`,
  recruit: '投稿小队',
  start: '开始组队',
  roster: '阵容',
  flow: '怎么配合',
  setup: '组队步骤',
  cost: '整队的代价',
  notes: '要知道的事',
  optional: '可选',
  missing: '未收录',
  import: '导入',
  imported: (done, total) => `已导入 ${done} / ${total}`,
  // 队里有新写岗位时，进度不只算导入，也算新建
  ready: (done, total) => `已就位 ${done} / ${total}`,
  // 只给读屏：每个成员前面那个打勾按钮的名字
  importedLabel: '已导入',
  readyLabel: '已就位',
  // 新写岗位：货架上没有，用户在 Grok Bot 里新建一个 Bot，把岗位说明发给它
  custom: '新建',
  copyBrief: '复制岗位说明',
  briefStep: (title) => `新建「${title}」`,
  briefHint: '在 Grok Bot 里新建一个 Bot，把下面这段岗位说明发给它。',
  copy: '复制',
  copied: '已复制',
  quota: '额度',
  permissions: '权限',
  prerequisites: '导入前准备',
  you: '你',
}
/** 招募卡上「投稿小队」链到仓库里的投稿说明。 */
export const SQUAD_CONTRIBUTE_URL = `${SITE.repo}/blob/${SITE.branch}/CONTRIBUTING.md#${encodeURIComponent('投稿小队')}`
