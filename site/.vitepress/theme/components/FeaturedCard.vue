<script setup lang="ts">
import { computed, ref } from 'vue'
import BotName from './BotName.vue'
import BotPortrait from './BotPortrait.vue'
import BzIcon from './BzIcon.vue'
import ExternalHint from './ExternalHint.vue'
import AuthorAvatar from './AuthorAvatar.vue'
import RoleMascot from './RoleMascot.vue'
import { avatarColor } from '../avatar'
import { botPalette, categoryStyle } from '../color'
import { track } from '../track'
import { reportClick } from '../heat'
import { nextPoke } from '../pitch'
import { SEND_PERMISSION } from '../../../../scripts/lib/bot-summary.mjs'
import { OPENBOT } from '../../../../scripts/lib/platform.mjs'
import BotActions from './BotActions.vue'

// 主推卡：活 Bot、名字、作者、介绍、分组和额度、导入。不带台词气泡，也不参与筛选。
// OpenBot 的 Bot 没有导入：右下角换成和列表卡同一颗「复制安装提示词」（BotActions，埋点记 featured）。
// 整张卡可点进详情：名字那个链接用伪元素铺满整卡（样式在 home.css），砖（戳）、作者、导入在它上面。
const props = defineProps<{
  bot: {
    slug: string; name: string; nameZh?: string | null; tagline: string; avatar: string | null; category: string; quotaCost: string; permissions: string[]
    templateUrl: string | null; detailUrl: string; author: { name: string; github?: string | null; link: string | null; page: string | null }; external?: boolean; official?: boolean
    platform?: string; repoFiles?: boolean
  }
}>()
const portrait = ref<InstanceType<typeof BotPortrait>>()
const hovered = ref(false)
const palette = computed(() => botPalette(props.bot.avatar ? '#8a8a93' : avatarColor(props.bot.slug)))
function enter(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  hovered.value = true
  portrait.value?.play({ state: 'wide', hold: Infinity })
}
function leave(event: PointerEvent) { if (event.pointerType === 'mouse') hovered.value = false }
function poke() { portrait.value?.play({ state: nextPoke(props.bot.slug).state }) }
function importBot(event: MouseEvent) {
  portrait.value?.play({ state: 'comet' })
  if (event.type !== 'auxclick') reportClick(props.bot.slug, 'import')
  track('bot_import', { from: 'featured', direct: false, trial: 'none', mod: event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button === 1 }, { slug: props.bot.slug })
}
</script>

<template>
  <article class="featured-card bz-bot-scope" :style="palette" data-testid="featured-card" :data-slug="bot.slug" @pointerenter="enter" @pointerleave="leave">
    <div class="featured-head">
      <div class="featured-tile bz-tile" aria-hidden="true" @click="poke">
        <BotPortrait ref="portrait" :bot="bot" :rest="hovered ? 'wide' : 'idle'" />
      </div>
      <div class="bot-head">
        <div class="bot-title">
          <h3 class="bot-name"><a :href="bot.detailUrl"><BotName :bot="bot" /></a></h3>
          <span v-if="!bot.external" class="bz-tag source-tag">作者投稿</span>
          <span v-if="bot.platform === OPENBOT" class="bz-tag platform-tag" data-testid="platform-tag">OpenBot</span>
        </div>
        <p class="bot-byline">
          <a v-if="bot.author.page" class="bot-author has-avatar" :href="bot.author.page"><AuthorAvatar class="byline-avatar" :author="{ key: bot.author.github, name: bot.author.name }" /><span class="bot-author-name">by {{ bot.author.name }}</span></a>
          <a v-else-if="bot.author.link" class="bot-author" data-track-kind="author" :href="bot.author.link" target="_blank" rel="noopener noreferrer">by {{ bot.author.name }}<ExternalHint /></a>
          <span v-else class="bot-author">by {{ bot.author.name }}</span>
        </p>
      </div>
    </div>
    <p class="bot-tagline">{{ bot.tagline }}</p>
    <div class="featured-foot">
      <div class="bot-stats">
        <span class="bz-tag role category-tag" :style="categoryStyle(bot.category)"><RoleMascot :category="bot.category" :size="12" />{{ bot.category }}</span>
        <span class="bot-stat stat-quota" :data-quota="bot.quotaCost"><BzIcon name="bolt" />额度 {{ bot.quotaCost }}</span>
        <span v-if="bot.permissions.includes(SEND_PERMISSION)" class="bot-stat stat-send"><BzIcon name="send" />会代你发消息</span>
      </div>
      <BotActions v-if="bot.platform === OPENBOT" :bot="bot" compact from="featured" />
      <a v-else data-testid="featured-import" class="bz-btn sm" :href="bot.templateUrl ?? undefined" target="_blank" rel="noopener noreferrer" data-track-own @click="importBot" @auxclick.middle="importBot"><BzIcon name="arrow-up-right" />导入<span class="bz-sr-only">（在新标签页打开）</span></a>
    </div>
  </article>
</template>
