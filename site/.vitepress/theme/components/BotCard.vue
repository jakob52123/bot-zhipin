<script setup>
import { computed, inject, ref } from 'vue'
import { previewMode, previewDetail, previewCardActive } from '../submit/preview-mode'
import { currentAuthorPage } from '../author-context'
const authorPagePath = inject(currentAuthorPage, null)
const preview = inject(previewMode, false)
const active = inject(previewCardActive, ref(true))
const showDetail = inject(previewDetail, () => {})
import { provideBotAction } from '../live/scope'
const avatar = provideBotAction()
import { avatarColor } from '../avatar'
import { botPalette, categoryStyle } from '../color'
import BotAvatar from './BotAvatar.vue'
import BotActions from './BotActions.vue'
import BotHeat from './BotHeat.vue'
import BotName from './BotName.vue'
import BzIcon from './BzIcon.vue'
import ExternalHint from './ExternalHint.vue'
import AuthorAvatar from './AuthorAvatar.vue'
import RoleMascot from './RoleMascot.vue'
import { SEND_PERMISSION } from '../../../../scripts/lib/bot-summary.mjs'
import { OPENBOT } from '../../../../scripts/lib/platform.mjs'
// showCategory：第三行最前面的分组标签。首页按分组分段显示时不要它（组头已经说了），专题筛选、投稿预览里要。
const props = defineProps({ bot: { type: Object, required: true }, showCategory: { type: Boolean, default: true } })
// 投稿预览里的数据可能还没通过校验，元信息只在取值像样时才显示。
const quota = computed(() => typeof props.bot.quotaCost === 'string' ? props.bot.quotaCost : '')
const permissions = computed(() => Array.isArray(props.bot.permissions) ? props.bot.permissions : null)
// 门槛从权限现算：要连外部账号或借浏览器登录态的，算「要连账号」；带定时运行的，算「会自己跑」。
const needsAccount = computed(() => !!permissions.value?.some((item) => item === '外部账号' || item === '浏览器 Cookie'))
const selfRunning = computed(() => !!permissions.value?.includes('定时自动运行'))
const canSend = computed(() => !!permissions.value?.includes(SEND_PERMISSION))
// 作者自己投稿的在名字右边挂「作者投稿」标签；外部收录的不写来源（决策 78）。
</script>

<template>
  <article class="bot-card bz-bot-scope" :style="botPalette(bot.avatar ? '#8a8a93' : avatarColor(bot.slug))" data-testid="bot-card" :data-slug="bot.slug" @pointerenter="avatar?.enter($event)" @pointerleave="avatar?.leave($event)">
    <!-- article 是容器查询的容器；版式网格放在里面这层，才能按卡片自己的宽度切换。
         整张卡可点进详情：名字那个链接用伪元素铺满这一层（样式在 home.css），头像、作者、按钮在它上面。 -->
    <div class="bot-card-body">
      <BotAvatar v-if="active" ref="avatar" :bot="bot" whole-card />
      <div class="bot-head">
        <div class="bot-title">
          <h3 class="bot-name"><a data-testid="detail-link" :href="preview ? '#submit-preview-detail' : bot.detailUrl" :target="preview ? '_self' : undefined" @click="preview && ($event.preventDefault(), showDetail())"><BotName :bot="bot" /></a></h3>
          <span v-if="!bot.external" class="bz-tag source-tag">作者投稿</span>
          <span v-if="bot.platform === OPENBOT" class="bz-tag platform-tag" data-testid="platform-tag">OpenBot</span>
        </div>
        <p class="bot-byline">
          <span v-if="preview || (authorPagePath && bot.author.page === authorPagePath)" class="bot-author">by {{ bot.author.name }}</span>
          <a v-else-if="bot.author.page" data-testid="author-link" class="bot-author has-avatar" :href="bot.author.page"><AuthorAvatar class="byline-avatar" :author="{ key: bot.author.github, name: bot.author.name }" /><span class="bot-author-name">by {{ bot.author.name }}</span></a>
          <a v-else-if="bot.author.link" data-track-kind="author" data-testid="author-link" class="bot-author" :href="bot.author.link" target="_blank" rel="noopener noreferrer">by {{ bot.author.name }}<ExternalHint /></a>
          <span v-else class="bot-author">by {{ bot.author.name }}</span>
        </p>
      </div>
      <p class="bot-tagline">{{ bot.tagline }}</p>
      <div class="bot-stats">
        <span v-if="showCategory" class="bz-tag role category-tag" :style="categoryStyle(bot.category)"><RoleMascot :category="bot.category" :size="12" />{{ bot.category }}</span>
        <span v-if="quota" class="bot-stat stat-quota" :data-quota="quota"><BzIcon name="bolt" />额度 {{ quota }}</span>
        <span v-if="permissions" class="bot-stat stat-account"><BzIcon :name="needsAccount ? 'plug' : 'plug-off'" />{{ needsAccount ? '要连账号' : '不用连账号' }}</span>
        <!-- 两项自动操作提醒一起换行，继续沿用卡片原有的间距和标识样式。 -->
        <span v-if="selfRunning || canSend" class="bot-stats">
          <span v-if="selfRunning" class="bot-stat stat-auto"><BzIcon name="clock" />会自己跑</span>
          <span v-if="canSend" class="bot-stat stat-send"><BzIcon name="send" />会代你发消息</span>
        </span>
        <BotHeat :slug="bot.slug" compact />
      </div>
      <BotActions :bot="bot" compact />
    </div>
  </article>
</template>
