<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, ref } from 'vue'
import { previewMode } from '../submit/preview-mode'
const preview = inject(previewMode, false)
import { installPrompt } from '../../meta.mjs'
import { OPENBOT } from '../../../../scripts/lib/platform.mjs'
import { track } from '../track'
import { reportClick } from '../heat'
import { announce, announceCopy } from '../announce'
import { useBotAction } from '../live/scope'
const play = useBotAction()
import BzIcon from './BzIcon.vue'

// compact：列表卡用小号按钮（「导入」+ 幽灵款的复制）；详情页侧栏用实心的「一键导入」+ 次级的复制，都撑满一行。
// 按钮一律「图标 + 动词」：导入是右上箭头（会开新标签页，读屏另有一句），复制是 copy，复制成功换成对勾。
// OpenBot 的 Bot 没有模板链接，没有「导入」：「复制安装提示词」升成主按钮（列表卡实心小号、详情页实心撑满）。
// from：埋点里记从哪儿点的，不传就按 compact 算（列表卡 / 详情页）；主推卡传 featured。
const props = defineProps<{
  bot: {
    slug: string; templateUrl: string | null; external: boolean; platform?: string; repoFiles?: boolean
    trial?: string | null; about?: { trial?: string | null; starters?: string[] } | null
  }
  compact?: boolean
  from?: 'card' | 'featured' | 'detail'
}>()
const openbot = computed(() => props.bot.platform === OPENBOT)
// 仓库里有没有这个 Bot 的文件：投稿预览的旧数据没有 repoFiles 时，照旧按「作者投稿才有」算。
const repoFiles = computed(() => props.bot.repoFiles ?? !props.bot.external)
const prompt = computed(() => installPrompt(props.bot.slug, openbot.value ? OPENBOT : undefined))

// 导入：复制试跑句（没写就用第一条开场白），再直接唤起 App 的导入窗口。
// x.ai 模板页 https://x.ai/bot/<id> 上的「Add to Grok Bot」就是 grokbot://app/v1/bot-template?id=<id>，这里直接用它，省掉英文中转页。
// 带修饰键点（新标签页打开等）照旧去 x.ai 模板页。
const trial = computed(() => {
  if (typeof props.bot.trial === 'string' && props.bot.trial) return props.bot.trial
  const about = props.bot.about
  if (!about) return ''
  if (typeof about.trial === 'string' && about.trial) return about.trial
  return Array.isArray(about.starters) && typeof about.starters[0] === 'string' ? about.starters[0] : ''
})
const appUrl = computed(() => {
  const id = props.bot.templateUrl?.split('/bot/')[1]
  return id ? `grokbot://app/v1/bot-template?id=${id}` : ''
})
const launched = ref(false)
let launchTimer: ReturnType<typeof setTimeout> | undefined
async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
    document.body.append(field)
    field.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { ok = false }
    field.remove()
    return ok
  }
}
const copied = ref(false)
const fallback = ref(false)
const dialog = ref<HTMLDialogElement>()
const field = ref<HTMLTextAreaElement>()
const copyButton = ref<HTMLButtonElement>()
let timer: ReturnType<typeof setTimeout> | undefined
const from = computed(() => props.from ?? (props.compact ? 'card' : 'detail'))
async function copyPrompt() {
  if (preview) return
  reportClick(props.bot.slug, 'prompt')
  try {
    await navigator.clipboard.writeText(prompt.value)
    track('bot_copy_prompt', { from: from.value, ok: true }, { slug: props.bot.slug })
    copied.value = true
    play({ state: 'wink' })
    void announceCopy()
    clearTimeout(timer)
    timer = setTimeout(() => { copied.value = false }, 1800)
  } catch {
    track('bot_copy_prompt', { from: from.value, ok: false }, { slug: props.bot.slug })
    fallback.value = true
    await nextTick()
    dialog.value?.showModal()
    field.value?.focus()
    field.value?.select()
  }
}
// 没装 Grok Bot 的人点了不会有反应：点完 3 秒内窗口一直没失焦（App 没被唤起），就在按钮下面给出下载入口。
const GET_APP_URL = 'https://x.ai/bot#download'
const getApp = ref(false)
let getAppTimer: ReturnType<typeof setTimeout> | undefined
let stopWatching: (() => void) | undefined
function watchLaunch() {
  stopWatching?.()
  clearTimeout(getAppTimer)
  let left = false
  const onLeave = () => { left = true }
  window.addEventListener('blur', onLeave)
  document.addEventListener('visibilitychange', onLeave)
  stopWatching = () => {
    window.removeEventListener('blur', onLeave)
    document.removeEventListener('visibilitychange', onLeave)
  }
  getAppTimer = setTimeout(() => {
    stopWatching?.()
    if (!left && !getApp.value) {
      getApp.value = true
      track('bot_no_app', {}, { slug: props.bot.slug })
    }
  }, 3000)
}
// 手机和平板：交给 x.ai 模板页（新标签页）去唤起手机 App，这里只顺手复制试跑句。
const isTouch = () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent))

async function importBot(event: MouseEvent) {
  if (preview) return
  play({ state: 'comet' })
  if (event.type !== 'auxclick') reportClick(props.bot.slug, 'import')
  const mod = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0
  const direct = !mod && Boolean(appUrl.value) && !isTouch()
  if (direct) event.preventDefault()
  // 先复制再唤起：浏览器弹「打开 Grok Bot？」以后页面失焦，剪贴板就写不进去了。
  const result = mod ? undefined : !trial.value ? 'none' : await writeClipboard(trial.value) ? 'copied' : 'failed'
  track('bot_import', { from: from.value, direct, ...(mod ? {} : { trial: result }), mod }, { slug: props.bot.slug })
  if (mod) return
  if (result === 'copied') {
    launched.value = true
    void announce('已复制开场白')
    clearTimeout(launchTimer)
    launchTimer = setTimeout(() => { launched.value = false }, 8000)
  }
  if (!direct) return
  // 用隐藏 iframe 唤起：浏览器不认这个协议时，失败的只是 iframe，当前页面还在（直接改 location 会把整页换成错误页）。
  const frame = document.createElement('iframe')
  frame.style.display = 'none'
  frame.src = appUrl.value
  document.body.append(frame)
  setTimeout(() => frame.remove(), 3000)
  watchLaunch()
}
function backdrop(event: MouseEvent) {
  if (event.target !== dialog.value) return
  const bounds = dialog.value.getBoundingClientRect()
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.value.close()
}
onBeforeUnmount(() => { clearTimeout(timer); clearTimeout(launchTimer); clearTimeout(getAppTimer); stopWatching?.() })
</script>

<template>
  <div class="bot-actions" :data-platform="openbot ? 'openbot' : undefined">
    <template v-if="!openbot">
      <button v-if="preview" data-testid="btn-import" type="button" class="bz-btn action-import" :class="compact ? 'sm' : 'primary block'" aria-disabled="true"><BzIcon name="arrow-up-right" />{{ compact ? '导入' : '一键导入' }}</button>
      <a v-else data-testid="btn-import" class="bz-btn action-import" :class="[compact ? 'sm' : 'primary block', { copied: launched }]" :href="bot.templateUrl ?? undefined" target="_blank" rel="noopener noreferrer" data-track-own @click="importBot" @auxclick.middle="importBot"><BzIcon :name="launched ? 'check' : 'arrow-up-right'" />{{ launched ? (compact ? '已复制' : '已复制开场白') : (compact ? '导入' : '一键导入') }}<span v-if="!launched" class="bz-sr-only">（打开 Grok Bot）</span></a>
      <a v-if="getApp && !preview" data-testid="get-app" class="bz-btn ghost get-app" :class="compact ? 'sm' : 'block'" :href="GET_APP_URL" target="_blank" rel="noopener noreferrer"><BzIcon name="arrow-up-right" />{{ compact ? '下载 Grok Bot' : '没装 Grok Bot？去下载' }}<span class="bz-sr-only">（在新标签页打开）</span></a>
    </template>
    <button v-if="repoFiles" ref="copyButton" data-testid="btn-prompt" type="button" class="bz-btn action-prompt" :class="[openbot ? (compact ? 'sm' : 'primary block') : (compact ? 'ghost sm' : 'block'), { copied }]" :aria-disabled="preview || undefined" @click="copyPrompt"><BzIcon :name="copied ? 'check' : 'copy'" />{{ copied ? '已复制' : '复制安装提示词' }}<span v-if="openbot && !copied" class="bz-sr-only">（发给 OpenBot）</span></button>
  </div>
  <p v-if="preview" class="bot-actions-note" data-testid="preview-actions-note">上架后可用</p>
  <dialog v-if="fallback && repoFiles" ref="dialog" class="prompt-fallback" data-testid="prompt-fallback" :aria-labelledby="`copy-title-${bot.slug}`" :aria-describedby="`copy-help-${bot.slug}`" @click="backdrop" @close="fallback = false; copyButton?.focus()">
    <h2 :id="`copy-title-${bot.slug}`">复制没成功，请手动复制</h2>
    <p :id="`copy-help-${bot.slug}`">{{ openbot ? '全选下面的文字，复制后发给 OpenBot 里的任意一个 Agent' : '全选下面的文字，复制后发给你的 Grok Bot' }}</p>
    <textarea ref="field" aria-label="安装提示词" readonly :value="prompt" rows="7" />
    <button type="button" class="bz-btn" @click="dialog?.close()">关闭</button>
  </dialog>
</template>
