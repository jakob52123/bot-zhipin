<script setup>
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue'
import { previewMode, previewUpdate } from '../submit/preview-mode'
const preview = inject(previewMode, false)
const update = inject(previewUpdate, ref(false))
import { provideBotAction } from '../live/scope'
const avatar = provideBotAction()
import { avatarColor } from '../avatar'
import { botPalette, categoryStyle } from '../color'
import BotAvatar from './BotAvatar.vue'
import BotActions from './BotActions.vue'
import BotMini from './BotMini.vue'
import BotName from './BotName.vue'
import DetailStarters from './DetailStarters.vue'
import { heatState, loadHeat } from '../heat'
// 侧栏用到的权限名从 Bot 摘要复用。
import { ACCOUNT_PERMISSIONS, SELF_RUNNING_PERMISSION, SEND_PERMISSION } from '../../../../scripts/lib/bot-summary.mjs'
// 读屏和替代文字里怎么称呼它：有中文叫法用中文叫法。
import { displayName } from '../../../../scripts/lib/bot-name.mjs'
import { OPENBOT } from '../../../../scripts/lib/platform.mjs'
import BzIcon from './BzIcon.vue'
import ExternalHint from './ExternalHint.vue'
import LiveAnnouncer from './LiveAnnouncer.vue'
import BotScreenshot from './BotScreenshot.vue'

// 详情页是一份「简历」：左边主栏一块块往下读，右边侧栏吸顶（导入、四项属性、作者和来源）。
// related（同组的 Bot）和 lineups（所在小队的成员小头像）由路由参数给；投稿预览不传，对应的区块不出现。
const props = defineProps({
  bot: { type: Object, required: true },
  copy: { type: Object, required: true },
  designHtml: { type: String, default: '' },
  related: { type: Array, default: () => [] },
  lineups: { type: Object, default: () => ({}) },
})
const paletteOf = (bot) => botPalette(bot.avatar ? '#8a8a93' : avatarColor(bot.slug))
const palette = computed(() => paletteOf(props.bot))
const called = computed(() => displayName(props.bot))

// 投稿预览里的数据可能还没通过校验：下面只认类型对的值，其余当作没写，页面不报错。
const list = (value) => Array.isArray(value) ? value : []
const text = (value) => typeof value === 'string' && value ? value : ''
const about = computed(() => props.bot.about && typeof props.bot.about === 'object' ? props.bot.about : {})
const intro = computed(() => text(about.value.intro))
const does = computed(() => list(about.value.does))
const starters = computed(() => [text(about.value.trial), ...list(about.value.starters)].filter(Boolean))
const routines = computed(() => list(about.value.routines).filter((item) => item && (item.what || item.when)))
const prerequisites = computed(() => list(props.bot.prerequisites))
const permissions = computed(() => list(props.bot.permissions))
const squads = computed(() => list(props.bot.squads))
const fit = computed(() => text(about.value.fit))
const notFit = computed(() => text(about.value.notFit))
const cnNote = computed(() => text(about.value.cnNote))
// 技能：仓库里有这个 Bot 的文件时（作者投稿的、OpenBot 的）以 skills/ 目录为准（带源码链接）；
// 外部收录的 Grok Bot 没有源码，用 about.skills 里整理好的名字和一句话。投稿预览的旧数据没有 repoFiles，按「作者投稿才有」算。
const repoFiles = computed(() => props.bot.repoFiles ?? !props.bot.external)
const realSkills = computed(() => repoFiles.value ? list(props.bot.skills) : [])
const skills = computed(() => realSkills.value.length
  ? realSkills.value.map((skill) => ({ name: skill.name, does: skill.description, sourceUrl: skill.sourceUrl }))
  : list(about.value.skills).filter((skill) => skill && skill.name).map((skill) => ({ name: skill.name, does: skill.does })))
const hasRoutinesFile = computed(() => repoFiles.value && !!props.bot.hasRoutines)
const openbot = computed(() => props.bot.platform === OPENBOT)
// 源项目：GitHub 上的写成「owner/仓库」，别的只写域名，侧栏放得下。
const project = computed(() => {
  const url = text(props.bot.projectUrl)
  if (!url) return null
  try {
    const { protocol, hostname, pathname } = new URL(url)
    if (protocol !== 'https:') return null
    const repo = hostname === 'github.com' ? pathname.split('/').filter(Boolean).slice(0, 2).join('/') : ''
    return { url, label: repo || hostname }
  } catch { return null }
})

// 侧栏的四项属性：额度、要不要连账号、定时任务数、会不会代发消息。
const quota = computed(() => text(props.bot.quotaCost))
// 要连账号：权限里第一个算「要连账号」的那一项（它的说明放进悬停提示）；一项都没有就是不用连。
const accountPermission = computed(() => permissions.value.find((item) => ACCOUNT_PERMISSIONS.includes(item)))
// 只知道「有」、数不出几个的（有 routines.md 或带定时运行权限，但没写 about.routines）：显示一个对勾。
const runsUncounted = computed(() => !routines.value.length && (hasRoutinesFile.value || permissions.value.includes(SELF_RUNNING_PERMISSION)))
const canSend = computed(() => permissions.value.includes(SEND_PERMISSION))
const sendDescription = computed(() => canSend.value ? props.copy.permissions[SEND_PERMISSION] : undefined)
// 来源：外部收录分官方市场和社区收录；作者自己投稿的写「作者投稿」。
const origin = computed(() => props.bot.external ? (props.bot.official ? '官方市场' : '社区收录') : '作者投稿')
const heat = computed(() => heatState.values[props.bot.slug] ?? (heatState.status === 'ready' ? 0 : heatState.status === 'failed' ? '—' : '…'))
const heatPending = computed(() => !preview && (heatState.status === 'loading' || heatState.status === 'idle'))

// 同组的 Bot：鼠标移到哪张卡，哪只 Bot 睁大眼。
const peeking = ref('')
const peek = (slug, event) => { if (event.pointerType === 'mouse') peeking.value = slug }

// 头部滚出视野（钻到导航条下面）以后，侧栏卡片的上沿探出一只小的它：侧栏吸顶跟着走，一眼还认得出这是谁的导入按钮。
const header = ref()
const headerGone = ref(false)
const railHover = ref(false)
const overRail = (inside, event) => { if (event.pointerType === 'mouse') railHover.value = inside }
let watcher
onMounted(() => {
  if (preview) return
  loadHeat()
  if (!header.value || typeof IntersectionObserver === 'undefined') return
  // 88 是导航条占的高度（--vp-nav-height）：头部整个进了导航条下面才算看不见。
  watcher = new IntersectionObserver(([entry]) => { headerGone.value = !entry.isIntersecting }, { rootMargin: '-88px 0px 0px 0px' })
  watcher.observe(header.value)
})
onBeforeUnmount(() => watcher?.disconnect())
</script>

<template>
  <component :is="preview ? 'div' : 'main'" class="shelf-page bot-detail bz-bot-scope" :class="{ 'is-preview': preview }" :style="palette" data-testid="bot-detail">
    <LiveAnnouncer v-if="!preview" />
    <a v-if="!preview" class="bz-btn ghost sm back-link" href="/"><BzIcon name="arrow-left" />返回货架</a>
    <div class="detail-layout">
      <header ref="header" class="detail-header">
        <BotAvatar ref="avatar" :bot="bot" />
        <div class="detail-info">
          <component :is="preview ? 'h2' : 'h1'"><BotName :bot="bot" wrap /></component>
          <p class="detail-tagline">{{ bot.tagline }}</p>
          <p class="detail-tags"><span class="bz-tag category-tag" :style="categoryStyle(bot.category)">{{ bot.category }}</span><span v-if="openbot" class="bz-tag platform-tag" data-testid="platform-tag">OpenBot</span></p>
        </div>
      </header>

      <!-- 侧栏：一键导入、四项属性、作者和来源。宽屏吸顶；窄屏排在头部下面。 -->
      <aside class="detail-rail" data-testid="detail-rail" :aria-label="`${called} 的导入和基本信息`" @pointerenter="overRail(true, $event)" @pointerleave="overRail(false, $event)">
        <span v-if="!preview" class="rail-peek" data-testid="rail-peek" :data-show="String(headerGone)" aria-hidden="true"><BotMini :bot="bot" :size="28" :rest="railHover ? 'wide' : 'idle'" bare /></span>
        <BotActions :bot="bot" />
        <!-- 档位和权限的含义不直接显示，放在 title 和读屏文本里。 -->
        <dl class="rail-facts">
          <div class="rail-fact">
            <dt>额度</dt>
            <dd class="quota-meter" data-testid="quota-meter" :data-quota="quota" :title="copy.quota[quota]">
              <span class="quota-bars" aria-hidden="true"><i /><i /><i /></span>
              <span class="quota-level">{{ quota || '—' }}</span>
              <span v-if="copy.quota[quota]" class="bz-sr-only">：{{ copy.quota[quota] }}</span>
            </dd>
          </div>
          <div class="rail-fact">
            <dt>账号</dt>
            <dd data-testid="fact-account" :title="accountPermission ? copy.permissions[accountPermission] : undefined"><BzIcon :name="accountPermission ? 'plug' : 'plug-off'" />{{ accountPermission ? '要连' : '不用连' }}</dd>
          </div>
          <div class="rail-fact">
            <dt>定时任务</dt>
            <dd data-testid="fact-routines" :class="{ none: !routines.length && !runsUncounted }" :title="routines.length || runsUncounted ? copy.permissions[SELF_RUNNING_PERMISSION] : undefined">
              <BzIcon name="clock" />
              <template v-if="runsUncounted"><BzIcon name="check" /><span class="bz-sr-only">有</span></template>
              <template v-else>{{ routines.length }} 个</template>
            </dd>
          </div>
          <div class="rail-fact">
            <dt>代发消息</dt>
            <dd data-testid="fact-send" :class="{ none: !canSend }" :title="sendDescription" :aria-description="sendDescription"><BzIcon name="send" />{{ canSend ? '会' : '不会' }}</dd>
          </div>
        </dl>
        <dl class="rail-meta">
          <div>
            <dt>作者</dt>
            <dd>
              <span v-if="preview || !bot.author?.link">{{ bot.author?.name }}</span>
              <a v-else-if="bot.author.page" data-testid="author-link" :href="bot.author.page">{{ bot.author.name }}</a>
              <a v-else data-track-kind="author" data-testid="author-link" :href="bot.author.link" target="_blank" rel="noopener noreferrer">{{ bot.author.name }}<ExternalHint /></a>
            </dd>
          </div>
          <div>
            <dt>来源</dt>
            <dd class="bot-origin">{{ origin }}</dd>
          </div>
          <div v-if="project" data-testid="project-link">
            <dt>项目</dt>
            <dd><a data-track-kind="source" :href="project.url" target="_blank" rel="noopener noreferrer">{{ project.label }}<ExternalHint /></a></dd>
          </div>
          <div>
            <dt>上架</dt>
            <dd><time :datetime="bot.addedAt">{{ bot.addedAt }}</time></dd>
          </div>
          <div>
            <dt>热度</dt>
            <dd data-testid="heat" class="rail-heat" :class="{ 'is-loading': heatPending }" :title="!preview && heatState.status === 'failed' ? '热度暂时获取不到' : undefined">
              <BzIcon name="flame" :class="{ 'is-hot': !preview && heat > 0 }" />{{ preview ? (update ? '—' : '新上架') : heat }}
            </dd>
          </div>
          <div v-if="bot.forkedFrom" data-testid="forked-from">
            <dt>改编自</dt>
            <dd><a :href="`/bots/${bot.forkedFrom}`" :target="preview ? '_blank' : undefined" :rel="preview ? 'noopener noreferrer' : undefined"><BotName :bot="{ name: bot.forkedFromName, nameZh: bot.forkedFromNameZh }" small /><ExternalHint v-if="preview" /></a></dd>
          </div>
        </dl>
      </aside>

      <!-- 主栏：没有数据的区块整块不渲染；投稿预览里照旧显示「还缺什么」的提示。 -->
      <div class="detail-main">
        <section v-if="intro || does.length" data-testid="section-about">
          <h2>能做什么</h2>
          <p v-if="intro" class="about-intro">{{ intro }}</p>
          <ul v-if="does.length" class="does-list"><li v-for="(item, index) in does" :key="index">{{ item }}</li></ul>
        </section>

        <section v-if="starters.length" data-testid="section-starters">
          <h2>开场白</h2>
          <DetailStarters :slug="bot.slug" :lines="starters" />
        </section>

        <!-- 截图可选（DECISIONS 第 43 条）：投稿不收截图，只有仓库里放了截图的 Bot 才显示这一区。 -->
        <section v-if="!bot.external && list(bot.screenshots).length" data-testid="section-screenshots">
          <h2>截图</h2>
          <div class="bot-screenshots">
            <BotScreenshot v-for="(url, index) in list(bot.screenshots)" :key="index" :url="url" :alt="`${called}截图 ${index + 1}`" />
          </div>
        </section>

        <section v-if="skills.length || (preview && repoFiles)" data-testid="section-skills">
          <h2>技能<span v-if="skills.length" class="section-count">{{ skills.length }}</span></h2>
          <ul v-if="skills.length" class="skill-grid">
            <li v-for="(skill, index) in skills" :key="skill.sourceUrl || index" data-testid="skill-item">
              <code v-if="realSkills.length" class="skill-name">{{ skill.name }}</code>
              <strong v-else class="skill-name">{{ skill.name }}</strong>
              <p v-if="skill.does">{{ skill.does }}</p>
              <template v-if="realSkills.length">
                <span v-if="preview" class="skill-source">上架后可查看源码</span>
                <a v-else class="skill-source" :href="skill.sourceUrl" target="_blank" rel="noopener noreferrer">查看源码<ExternalHint /></a>
              </template>
            </li>
          </ul>
          <p v-else>暂无技能说明。</p>
        </section>

        <!-- 定时任务：每条是时间、做什么、默认开还是关。一条都没有、也没有 routines.md 的，整块不显示。 -->
        <section v-if="routines.length || hasRoutinesFile" data-testid="section-routines">
          <h2>定时任务<span v-if="routines.length" class="section-count">{{ routines.length }}</span></h2>
          <ul v-if="routines.length" class="routine-list">
            <li v-for="(routine, index) in routines" :key="index" data-testid="routine-item">
              <div class="routine-body">
                <span v-if="routine.when" class="routine-when">{{ routine.when }}</span>
                <span v-if="routine.what" class="routine-what">{{ routine.what }}</span>
              </div>
              <span v-if="routine.default === '开' || routine.default === '关' || routine.quiet === '不打扰'" class="routine-tags">
                <span v-if="routine.default === '开'" class="routine-flag routine-state on">默认开</span>
                <span v-else-if="routine.default === '关'" class="routine-flag routine-state">默认关</span>
                <span v-if="routine.quiet === '不打扰'" class="routine-flag">没事不打扰</span>
              </span>
            </li>
          </ul>
          <template v-if="hasRoutinesFile">
            <span v-if="preview" class="routine-source">上架后可查看</span>
            <a v-else class="routine-source" :href="bot.routinesUrl" target="_blank" rel="noopener noreferrer">查看定时任务<ExternalHint /></a>
          </template>
        </section>

        <section v-if="prerequisites.length || cnNote" data-testid="section-prereq">
          <h2>导入前准备</h2>
          <ul v-if="prerequisites.length" class="dot-list"><li v-for="(item, index) in prerequisites" :key="index">{{ item }}</li></ul>
          <!-- 国内使用要知道的事：前面一个地球图标，含义在 title 和读屏文本里。 -->
          <p v-if="cnNote" class="prereq-cn" data-testid="prereq-cn" title="国内使用"><BzIcon name="globe" /><span><span class="bz-sr-only">国内使用：</span>{{ cnNote }}</span></p>
        </section>

        <section v-if="permissions.length" data-testid="section-permissions">
          <h2>权限</h2>
          <ul class="permission-list">
            <li v-for="permission in permissions" :key="permission" class="bz-tag" :title="copy.permissions[permission]">{{ permission }}<span v-if="copy.permissions[permission]" class="bz-sr-only">：{{ copy.permissions[permission] }}</span></li>
          </ul>
        </section>

        <!-- 适合谁：左边对勾是适合的人，右边叉是不适合的人，不另加小标题。 -->
        <section v-if="fit || notFit" data-testid="section-fit">
          <h2>适合谁</h2>
          <div class="fit-grid">
            <p v-if="fit" class="fit-yes" data-testid="fit-yes"><span class="fit-mark"><BzIcon name="check" :size="14" /></span><span><span class="bz-sr-only">适合：</span>{{ fit }}</span></p>
            <p v-if="notFit" class="fit-no" data-testid="fit-no"><span class="fit-mark"><BzIcon name="x" :size="14" /></span><span><span class="bz-sr-only">不适合：</span>{{ notFit }}</span></p>
          </div>
        </section>

        <section v-if="text(bot.editorNote)" data-testid="section-editor">
          <h2>编辑点评</h2>
          <blockquote class="editor-note"><BzIcon name="quote" :size="24" /><p>{{ bot.editorNote }}</p></blockquote>
        </section>

        <section v-if="!bot.external && (preview || designHtml)" data-testid="section-design">
          <h2>设计说明</h2>
          <!-- 仅插入 paths 加载器安全渲染的 HTML，绝不编译投稿内容。 -->
          <div v-if="designHtml" class="vp-doc design-body" v-html="designHtml" />
          <p v-else>暂无设计说明。</p>
        </section>

        <!-- 所在小队：每支一行，整行可点进小队页。链接只有小队名那一个，用伪元素铺满整行。 -->
        <section v-if="squads.length" data-testid="section-squads">
          <h2>所在小队</h2>
          <ul class="squad-links">
            <li v-for="squad in squads" :key="squad.slug" class="squad-link" data-testid="squad-link">
              <span v-if="list(lineups[squad.slug]).length" class="squad-faces" aria-hidden="true">
                <BotMini v-for="member in list(lineups[squad.slug])" :key="member.slug" :bot="member" :size="28" bare />
              </span>
              <h3 class="squad-name"><a :href="squad.detailUrl">{{ squad.name }}</a></h3>
              <span v-if="squad.title" class="bz-tag" :class="{ solid: squad.lead }">{{ squad.title }}</span>
              <BzIcon name="chevron-right" />
            </li>
          </ul>
        </section>

        <!-- 同组的 Bot：同一个分组里另外几个，按推荐顺序。整张卡可点。 -->
        <section v-if="related.length" data-testid="section-related">
          <h2>同组的 Bot</h2>
          <ul class="related-grid">
            <li v-for="other in related" :key="other.slug" class="related-card bz-bot-scope" :style="paletteOf(other)" data-testid="related-card" :data-slug="other.slug" @pointerenter="peek(other.slug, $event)" @pointerleave="peek('', $event)">
              <BotMini :bot="other" :size="40" :rest="peeking === other.slug ? 'wide' : 'idle'" bare />
              <h3 class="related-name"><a :href="other.detailUrl"><BotName :bot="other" /></a></h3>
              <p class="related-tagline">{{ other.tagline }}</p>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </component>
</template>
