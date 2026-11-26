<!--
  小队详情页：合影舞台 → 阵容 → 怎么配合 → 组队步骤 → 整队的代价 → 要知道的事。
  squad 的字段见 scripts/lib/squad-summary.mjs；copy 是权限和额度的说明（和 Bot 详情页同一份），只放在 title 和读屏文本里。
  Grok Bot 没有批量导入：成员逐个导入，页面记住哪些已经点过（localStorage，键 bz-squad-<slug>）。
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import SquadLineup from './SquadLineup.vue'
import SquadFlow from './SquadFlow.vue'
import BotName from './BotName.vue'
import BotPortrait from './BotPortrait.vue'
import SquadStill from './SquadStill.vue'
import BzIcon from './BzIcon.vue'
import ExternalHint from './ExternalHint.vue'
import LiveAnnouncer from './LiveAnnouncer.vue'
import { SQUAD_COPY } from '../../meta.mjs'
import { avatarColor } from '../avatar'
import { botPalette } from '../color'
import { track } from '../track'
import { reportClick } from '../heat'
import { announce } from '../announce'
import { nextPoke } from '../pitch'
import { isReducedMotion } from '../live/clock'
import { parseImported, squadStorageKey } from '../squad'
// 读屏文本和悬停提示里怎么称呼成员：有中文叫法用中文叫法。
import { displayName } from '../../../../scripts/lib/bot-name.mjs'

interface Member {
  bot: string; name: string; nameZh?: string | null; title: string | null; does: string | null; lead: boolean; optional: boolean
  avatar: string | null; detailUrl: string | null; templateUrl: string | null; quotaCost: string | null
  // 新写岗位：bot 是它的 role 代号，没有详情页和模板，brief 是新建时发给它的岗位说明
  custom?: boolean; brief?: string | null
}
interface Squad {
  slug: string; name: string; tagline: string; formation: string; origin: string; addedAt: string
  author: { name: string; link: string | null; page: string | null }
  members: Member[]; leader: string | null
  flow: { from: string; to: string; what: string | null }[]
  setup: { title: string | null; detail: string | null }[]
  kickoff: string | null; tryout: string | null; notes: string[]
  missing: { name: string | null; does: string | null }[]
  quota: { max: string | null; perMember: { bot: string; quotaCost: string }[] }
  permissions: { permission: string; bots: string[] }[]
  prerequisites: { bot: string; items: string[] }[]
}
const props = withDefaults(defineProps<{ squad: Squad; copy?: { permissions: Record<string, string>; quota: Record<string, string> } }>(), {
  copy: () => ({ permissions: {}, quota: {} }),
})

const bySlug = computed(() => new Map(props.squad.members.map((member) => [member.bot, member])))
const member = (slug: string) => bySlug.value.get(slug)!
const leader = computed(() => props.squad.leader ? bySlug.value.get(props.squad.leader) ?? null : null)
const palette = (item: Member) => botPalette(item.avatar ? '#8a8a93' : avatarColor(item.bot))
const portrait = (item: Member) => ({ slug: item.bot, name: item.name, nameZh: item.nameZh, avatar: item.avatar })
const hasFlow = computed(() => props.squad.flow.some((step) => step.what))

/* ---------- 已导入的成员：只在本机记住 ---------- */
const imported = ref<string[]>([])
const done = (slug: string) => imported.value.includes(slug)
const slugs = computed(() => props.squad.members.map((item) => item.bot))
function save() {
  try { localStorage.setItem(squadStorageKey(props.squad.slug), JSON.stringify(imported.value)) } catch { /* 隐私模式存不了：这次访问里照常打勾 */ }
}
function mark(slug: string, value: boolean) {
  if (done(slug) === value) return
  imported.value = slugs.value.filter((item) => item === slug ? value : done(item))
  save()
}
function toggle(slug: string) {
  mark(slug, !done(slug))
  void announce(progress(imported.value.length, slugs.value.length))
}
function sync(event: StorageEvent) {
  if (event.key === squadStorageKey(props.squad.slug)) imported.value = parseImported(event.newValue, slugs.value)
}

/* ---------- 活的：点谁戳谁，导入的那只「嗖」一下 ---------- */
const photo = ref<InstanceType<typeof SquadLineup>>()
const rowPortraits = new Map<string, InstanceType<typeof BotPortrait>>()
const keep = (slug: string) => (el: unknown) => { if (el) rowPortraits.set(slug, el as InstanceType<typeof BotPortrait>); else rowPortraits.delete(slug) }
const hoveredRow = ref<string | null>(null)
function enterRow(event: PointerEvent, slug: string) { if (event.pointerType === 'mouse') hoveredRow.value = slug }
function leaveRow(event: PointerEvent) { if (event.pointerType === 'mouse') hoveredRow.value = null }
function poke(slug: string) { rowPortraits.get(slug)?.play({ state: nextPoke(slug).state }) }
function importMember(slug: string, from: 'squad_lineup' | 'squad_setup', event: MouseEvent) {
  // 和货架上的「导入」一样：只在 click 时上报热度，新标签页由链接自己打开。
  if (event.type !== 'auxclick') reportClick(slug, 'import')
  track('bot_import', { from, squad: props.squad.slug, direct: false, trial: 'none', mod: event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button === 1 }, { slug })
  photo.value?.play(slug, { state: 'comet' })
  rowPortraits.get(slug)?.play({ state: 'comet' })
  mark(slug, true)
}

/* ---------- 开始组队：滚到组队步骤 ---------- */
const setup = ref<HTMLElement>()
function start() {
  track('squad_start')
  setup.value?.scrollIntoView({ behavior: isReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  setup.value?.focus({ preventScroll: true })
  history.replaceState(history.state, '', '#setup')
}

/* ---------- 复制口令 ---------- */
const copied = ref<string | null>(null)
const blocks = new Map<string, HTMLElement>()
const keepBlock = (key: string) => (el: unknown) => { if (el) blocks.set(key, el as HTMLElement); else blocks.delete(key) }
let timer: ReturnType<typeof setTimeout> | undefined
// key 是 kickoff、tryout，或者 brief:<成员代号>（新写岗位的岗位说明，复制成功就算这个成员就位了）
async function copyText(key: string) {
  const owner = key.startsWith('brief:') ? bySlug.value.get(key.slice(6)) : undefined
  const text = owner ? owner.brief : key === 'kickoff' || key === 'tryout' ? props.squad[key] : null
  if (!text) return
  const which = owner ? 'brief' : key as 'kickoff' | 'tryout'
  if (key === 'kickoff') reportClick(props.squad.slug, 'kickoff')
  try {
    await navigator.clipboard.writeText(text)
    track('squad_copy', { which, ok: true })
    copied.value = key
    if (owner) {
      photo.value?.play(owner.bot, { state: 'comet' })
      rowPortraits.get(owner.bot)?.play({ state: 'comet' })
      mark(owner.bot, true)
    } else if (leader.value) photo.value?.play(leader.value.bot, { state: 'wink' })
    void announce(SQUAD_COPY.copied)
    clearTimeout(timer)
    timer = setTimeout(() => { copied.value = null }, 1800)
  } catch {
    // 复制不了（权限、旧浏览器）：把这段文字选中，按 ⌘C / Ctrl+C 就能带走。
    track('squad_copy', { which, ok: false })
    const block = blocks.get(key)
    if (!block) return
    const range = document.createRange()
    range.selectNodeContents(block)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }
}

/* ---------- 步骤编号：导入 → 新建新写岗位（每个一步）→ 接线 → 口令 → 试一句 ---------- */
const hasCustom = computed(() => props.squad.members.some((item) => item.custom))
const progress = (count: number, total: number) => hasCustom.value ? SQUAD_COPY.ready(count, total) : SQUAD_COPY.imported(count, total)
type Step = { kind: 'import' } | { kind: 'brief'; key: string; member: Member } | { kind: 'setup'; title: string | null; detail: string | null } | { kind: 'kickoff' | 'tryout'; text: string }
const steps = computed(() => {
  const list: Step[] = [{ kind: 'import' }]
  for (const item of props.squad.members) if (item.custom && item.brief) list.push({ kind: 'brief', key: `brief:${item.bot}`, member: item })
  for (const step of props.squad.setup) list.push({ kind: 'setup', ...step })
  if (props.squad.kickoff) list.push({ kind: 'kickoff', text: props.squad.kickoff })
  if (props.squad.tryout) list.push({ kind: 'tryout', text: props.squad.tryout })
  return list
})

/* ---------- 要知道的事：第一句是要点，单独提出来 ---------- */
const notes = computed(() => props.squad.notes.map((note) => {
  const cut = note.indexOf('。')
  return cut > 0 && cut < note.length - 1 ? { lead: note.slice(0, cut + 1), rest: note.slice(cut + 1) } : { lead: note, rest: '' }
}))

onMounted(() => {
  try { imported.value = parseImported(localStorage.getItem(squadStorageKey(props.squad.slug)), slugs.value) } catch { /* 读不了就当都没导入 */ }
  window.addEventListener('storage', sync)
})
onBeforeUnmount(() => {
  window.removeEventListener('storage', sync)
  clearTimeout(timer)
})
</script>

<template>
  <main class="shelf-page squad-detail" data-testid="squad-detail" :data-slug="squad.slug">
    <LiveAnnouncer />
    <a class="bz-btn ghost sm back-link" href="/"><BzIcon name="arrow-left" />返回货架</a>

    <header class="squad-header" data-testid="squad-header">
      <SquadLineup ref="photo" class="squad-stage" data-testid="squad-stage" variant="stage" :members="squad.members" :formation="squad.formation" />
      <div class="squad-intro">
        <div class="squad-intro-text">
          <p class="squad-tags" data-testid="squad-meta">
            <span class="bz-tag squad-tag"><BzIcon name="users" :size="12" />{{ SQUAD_COPY.tag }}</span>
            <span class="bz-tag" data-testid="squad-formation">{{ squad.formation }}</span>
            <span class="squad-count" data-testid="squad-count">{{ SQUAD_COPY.count(squad.members.length) }}</span>
            <span class="squad-byline">
              <a v-if="squad.author.page" data-testid="squad-author" :href="squad.author.page">by {{ squad.author.name }}</a>
              <a v-else-if="squad.author.link" data-track-kind="author" data-testid="squad-author" :href="squad.author.link" target="_blank" rel="noopener noreferrer">by {{ squad.author.name }}<ExternalHint /></a>
              <span v-else data-testid="squad-author">by {{ squad.author.name }}</span>
              <span data-testid="squad-origin"> · {{ squad.origin }}</span>
            </span>
          </p>
          <h1>{{ squad.name }}</h1>
          <p class="squad-tagline" data-testid="squad-tagline">{{ squad.tagline }}</p>
        </div>
        <a class="bz-btn primary squad-start" data-testid="squad-start" href="#setup" @click.prevent="start"><BzIcon name="arrow-down" />{{ SQUAD_COPY.start }}</a>
      </div>
    </header>

    <!-- 阵容：一张编制表，一行一个成员。整行点进它自己的详情页；每行一个「导入」。 -->
    <section class="squad-section" data-testid="squad-roster" aria-labelledby="squad-roster-title">
      <header class="squad-section-head">
        <h2 id="squad-roster-title">{{ SQUAD_COPY.roster }}</h2>
      </header>
      <ul class="roster">
        <li
          v-for="item in squad.members" :key="item.bot" class="roster-row bz-bot-scope" :class="{ 'is-done': done(item.bot) }" :style="palette(item)"
          data-testid="squad-member" :data-slug="item.bot" :data-lead="String(item.lead)"
          @pointerenter="enterRow($event, item.bot)" @pointerleave="leaveRow"
        >
          <div class="roster-tile bz-tile" aria-hidden="true" @click="poke(item.bot)">
            <BotPortrait :ref="keep(item.bot)" :bot="portrait(item)" :rest="hoveredRow === item.bot ? 'wide' : 'idle'" />
          </div>
          <div class="roster-who">
            <!-- 新写岗位：名字就是岗位名，没有详情页可链，标「新建」代替岗位标签 -->
            <h3 v-if="item.custom" class="roster-name" data-testid="member-custom-name">{{ item.name }}</h3>
            <h3 v-else class="roster-name"><a data-testid="member-link" :href="item.detailUrl ?? undefined"><BotName :bot="item" /></a></h3>
            <span v-if="item.custom" class="bz-tag" :class="{ solid: item.lead }" data-testid="member-custom">{{ SQUAD_COPY.custom }}</span>
            <span v-else-if="item.title" class="bz-tag" :class="{ solid: item.lead }" data-testid="member-title">{{ item.title }}</span>
            <span v-if="item.optional" class="bz-tag" data-testid="member-optional">{{ SQUAD_COPY.optional }}</span>
          </div>
          <p class="roster-does" data-testid="member-does">{{ item.does }}</p>
          <button
            v-if="item.custom" type="button" class="bz-btn sm roster-import" data-testid="member-brief" :data-done="String(done(item.bot))"
            @click="copyText(`brief:${item.bot}`)"
          ><BzIcon :name="copied === `brief:${item.bot}` || done(item.bot) ? 'check' : 'copy'" />{{ copied === `brief:${item.bot}` ? SQUAD_COPY.copied : SQUAD_COPY.copyBrief }}<span class="bz-sr-only">：{{ item.name }}</span></button>
          <a
            v-else class="bz-btn sm roster-import" data-testid="member-import" :data-done="String(done(item.bot))"
            :href="item.templateUrl" target="_blank" rel="noopener noreferrer" data-track-own @click="importMember(item.bot, 'squad_lineup', $event)" @auxclick.middle="importMember(item.bot, 'squad_lineup', $event)"
          ><BzIcon :name="done(item.bot) ? 'check' : 'arrow-up-right'" />{{ SQUAD_COPY.import }}<span class="bz-sr-only">{{ displayName(item) }}（在新标签页打开）</span></a>
        </li>
        <li v-for="item in squad.missing" :key="`missing-${item.name}`" class="roster-row is-missing" data-testid="squad-missing">
          <div class="roster-tile bz-tile" aria-hidden="true"><SquadStill ghost shape="pebble" /></div>
          <div class="roster-who">
            <h3 class="roster-name">{{ item.name }}</h3>
            <span class="bz-tag">{{ SQUAD_COPY.missing }}</span>
          </div>
          <p class="roster-does">{{ item.does }}</p>
        </li>
      </ul>
    </section>

    <!-- 怎么配合：一张图 + 一份同样内容的文字版（窄屏和读屏读文字版）。 -->
    <section v-if="hasFlow" class="squad-section" data-testid="squad-flow" aria-labelledby="squad-flow-title">
      <header class="squad-section-head">
        <h2 id="squad-flow-title">{{ SQUAD_COPY.flow }}</h2>
      </header>
      <SquadFlow :squad="squad" />
    </section>

    <!-- 组队步骤：编号往下走。第一步是把成员逐个导入，带进度；后面是数据里的接线步骤、发给队长的口令、组好以后的第一句。 -->
    <section id="setup" ref="setup" class="squad-section" data-testid="squad-setup" aria-labelledby="squad-setup-title" tabindex="-1">
      <header class="squad-section-head">
        <h2 id="squad-setup-title">{{ SQUAD_COPY.setup }}</h2>
      </header>
      <ol class="setup-steps">
        <li v-for="(step, index) in steps" :key="index" class="setup-step" :class="[`is-${step.kind}`, { 'is-complete': step.kind === 'import' && imported.length === slugs.length }]" :data-step="step.kind">
          <span class="step-no" aria-hidden="true"><BzIcon v-if="step.kind === 'import' && imported.length === slugs.length" name="check" /><template v-else>{{ index + 1 }}</template></span>
          <div v-if="step.kind === 'import'" class="step-body">
            <div class="setup-progress">
              <p class="step-title" data-testid="setup-progress">{{ progress(imported.length, slugs.length) }}</p>
              <div class="progress-track" aria-hidden="true">
                <i v-for="item in squad.members" :key="item.bot" class="bz-bot-scope" :class="{ on: done(item.bot) }" :style="palette(item)" />
              </div>
            </div>
            <ul class="setup-members">
              <li v-for="item in squad.members" :key="item.bot" class="setup-member bz-bot-scope" :class="{ 'is-done': done(item.bot) }" :style="palette(item)" data-testid="setup-member" :data-slug="item.bot">
                <button
                  type="button" class="member-check" data-testid="member-check" :aria-pressed="done(item.bot)"
                  :aria-label="`${displayName(item)} ${hasCustom ? SQUAD_COPY.readyLabel : SQUAD_COPY.importedLabel}`" @click="toggle(item.bot)"
                ><BzIcon name="check" :size="12" /></button>
                <SquadStill :bot="portrait(item)" />
                <span v-if="item.custom" class="setup-member-name">{{ item.name }}</span>
                <span v-else class="setup-member-name"><BotName :bot="item" small /></span>
                <button
                  v-if="item.custom" type="button" class="bz-btn sm ghost" data-testid="setup-brief" @click="copyText(`brief:${item.bot}`)"
                ><BzIcon :name="copied === `brief:${item.bot}` ? 'check' : 'copy'" />{{ copied === `brief:${item.bot}` ? SQUAD_COPY.copied : SQUAD_COPY.copyBrief }}<span class="bz-sr-only">：{{ item.name }}</span></button>
                <a
                  v-else class="bz-btn sm ghost" data-testid="setup-import" :href="item.templateUrl" target="_blank" rel="noopener noreferrer" data-track-own @click="importMember(item.bot, 'squad_setup', $event)" @auxclick.middle="importMember(item.bot, 'squad_setup', $event)"
                ><BzIcon name="arrow-up-right" />{{ SQUAD_COPY.import }}<span class="bz-sr-only">{{ displayName(item) }}（在新标签页打开）</span></a>
              </li>
            </ul>
          </div>
          <!-- 新写岗位：一段可复制的岗位说明，用户新建一个 Bot 发给它 -->
          <div v-else-if="step.kind === 'brief'" class="step-body">
            <h3 class="step-title">{{ SQUAD_COPY.briefStep(step.member.name) }}</h3>
            <p class="step-detail">{{ SQUAD_COPY.briefHint }}</p>
            <div class="squad-message" data-testid="squad-brief" :data-slug="step.member.bot">
              <header>
                <span class="message-to bz-bot-scope" :style="palette(step.member)"><BzIcon name="send" /><SquadStill :bot="portrait(step.member)" /><b>{{ step.member.name }}</b></span>
                <button type="button" class="bz-btn sm ghost" :class="{ copied: copied === step.key }" data-testid="copy-brief" @click="copyText(step.key)">
                  <BzIcon :name="copied === step.key ? 'check' : 'copy'" />{{ copied === step.key ? SQUAD_COPY.copied : SQUAD_COPY.copy }}
                </button>
              </header>
              <p :ref="keepBlock(step.key)" class="message-text">{{ step.member.brief }}</p>
            </div>
          </div>
          <div v-else-if="step.kind === 'setup'" class="step-body">
            <h3 class="step-title">{{ step.title }}</h3>
            <p class="step-detail">{{ step.detail }}</p>
          </div>
          <!-- 口令和试一句：做成一条「发给队长」的消息，收件人就是队长的头像和名字，不另写说明。 -->
          <div v-else class="step-body">
            <div class="squad-message" :data-testid="`squad-${step.kind}`">
              <header>
                <span v-if="leader" class="message-to bz-bot-scope" :style="palette(leader)"><BzIcon name="send" /><SquadStill :bot="portrait(leader)" /><b><BotName :bot="leader" short /></b></span>
                <button type="button" class="bz-btn sm ghost" :class="{ copied: copied === step.kind }" :data-testid="`copy-${step.kind}`" @click="copyText(step.kind)">
                  <BzIcon :name="copied === step.kind ? 'check' : 'copy'" />{{ copied === step.kind ? SQUAD_COPY.copied : SQUAD_COPY.copy }}
                </button>
              </header>
              <p :ref="keepBlock(step.kind)" class="message-text">{{ step.text }}</p>
            </div>
          </div>
        </li>
      </ol>
    </section>

    <!-- 整队的代价：额度、权限并集、导入前准备。档位和权限的含义在 title 和读屏文本里。 -->
    <section class="squad-section" data-testid="squad-cost" aria-labelledby="squad-cost-title">
      <header class="squad-section-head">
        <h2 id="squad-cost-title">{{ SQUAD_COPY.cost }}</h2>
      </header>
      <div class="cost-grid">
        <div class="cost-side">
        <div class="cost-col" data-testid="squad-quota">
          <h3>{{ SQUAD_COPY.quota }}</h3>
          <ul class="cost-list">
            <li v-for="item in squad.quota.perMember" :key="item.bot" class="cost-row" :title="copy.quota[item.quotaCost]">
              <SquadStill :bot="portrait(member(item.bot))" />
              <span class="cost-name"><BotName :bot="member(item.bot)" short /></span>
              <span class="squad-quota" :data-quota="item.quotaCost">
                <span class="squad-quota-bars" aria-hidden="true"><i /><i /><i /></span>{{ item.quotaCost }}
                <span v-if="copy.quota[item.quotaCost]" class="bz-sr-only">：{{ copy.quota[item.quotaCost] }}</span>
              </span>
            </li>
          </ul>
        </div>
        <div class="cost-col" data-testid="squad-permissions">
          <h3>{{ SQUAD_COPY.permissions }}</h3>
          <ul class="cost-list">
            <li v-for="item in squad.permissions" :key="item.permission" class="cost-row" :title="copy.permissions[item.permission]">
              <span class="cost-name">{{ item.permission }}<span v-if="copy.permissions[item.permission]" class="bz-sr-only">：{{ copy.permissions[item.permission] }}</span></span>
              <span class="cost-bots">
                <span v-for="slug in item.bots" :key="slug" :title="displayName(member(slug))"><SquadStill :bot="portrait(member(slug))" /><span class="bz-sr-only">{{ displayName(member(slug)) }}</span></span>
              </span>
            </li>
          </ul>
        </div>
        </div>
        <div v-if="squad.prerequisites.length" class="cost-col" data-testid="squad-prereq">
          <h3>{{ SQUAD_COPY.prerequisites }}</h3>
          <ul class="prereq-list">
            <li v-for="entry in squad.prerequisites" :key="entry.bot">
              <p class="prereq-who"><SquadStill :bot="portrait(member(entry.bot))" /><BotName :bot="member(entry.bot)" short /></p>
              <ul><li v-for="(item, index) in entry.items" :key="index">{{ item }}</li></ul>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <section v-if="notes.length" class="squad-section" data-testid="squad-notes" aria-labelledby="squad-notes-title">
      <header class="squad-section-head">
        <h2 id="squad-notes-title">{{ SQUAD_COPY.notes }}</h2>
      </header>
      <ul class="squad-notes">
        <li v-for="(note, index) in notes" :key="index"><strong>{{ note.lead }}</strong>{{ note.rest }}</li>
      </ul>
    </section>
  </main>
</template>
