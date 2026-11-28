<!--
  首页首屏以下的全部区块：本周主推 → 小队 → 专题 → 全部 Bot（工具栏 + 列表）→ 页尾。
  「全部 Bot」有三种状态：按分组分段（默认）、选中单个分组、专题筛选。分组和专题写进地址栏（?role= / ?c=）。
-->
<script lang="ts">
import type { ShelfSort } from '../shelf'

// 这一页在本次打开期间记住的东西：点进详情再退回来，排序和展开过的分组都还在。
// 存在 window 上而不是模块变量里：VitePress 的生产构建给同一个页面出了两份代码（首次加载用的精简版、
// 站内跳转用的完整版），模块变量会各有一份、互相看不见。只在浏览器里读写。
interface ShelfMemory { visited: boolean; sort: ShelfSort; expanded: string[] }
function shelfMemory(): ShelfMemory {
  const host = window as unknown as { __bzShelfMemory?: ShelfMemory }
  return host.__bzShelfMemory ??= { visited: false, sort: 'rec', expanded: [] }
}
</script>

<script setup lang="ts">
import { track } from '../track'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { inBrowser } from 'vitepress'
import { data as bots } from '../../data/bots.data.mjs'
import { data as curation } from '../../data/curation.data.mjs'
import { data as enums } from '../enums.data.mjs'
import { CONTRIBUTE_URL, SHELF_COPY } from '../../meta.mjs'
import { heatState, loadHeat } from '../heat'
import { announce } from '../announce'
import { isReducedMotion } from '../live/clock'
import { ALL_ROLES, GROUP_PREVIEW, GROUP_PREVIEW_NARROW, NARROW_QUERY, collectionBots, groupBots, readShelfQuery, sortBots, writeShelfQuery } from '../shelf'
import BotCard from './BotCard.vue'
import BzIcon from './BzIcon.vue'
import DefaultAvatar from './DefaultAvatar.vue'
import FeaturedCard from './FeaturedCard.vue'
import HomeCollections from './HomeCollections.vue'
import HomeSquads from './HomeSquads.vue'
import RoleGroup from './RoleGroup.vue'
import ShelfToolbar from './ShelfToolbar.vue'

const bySlug = new Map(bots.map((bot) => [bot.slug, bot]))
const known = { categories: enums.categories as string[], collections: curation.collections.map((item) => item.slug) }
// 站内跳转回到首页时（不是首次加载）可以直接按地址栏和记忆还原，赶在 VitePress 恢复滚动位置之前。
// 首次加载要接管服务端渲染出来的页面，先按默认状态渲染，挂载以后再还原，免得和服务端的首帧对不上。
const memory = inBrowser ? shelfMemory() : null
const restore = !!memory?.visited
const initial = restore ? readShelfQuery(window.location.search, known) : { role: ALL_ROLES, collection: null }

const sort = ref<ShelfSort>(memory && restore ? memory.sort : 'rec')
const role = ref(initial.role)
const collection = ref<string | null>(initial.collection)
const expanded = ref(new Set<string>(memory && restore ? memory.expanded : []))
const entering = ref(false)
// 每组先露两行：两列时 4 张，单列时 2 张。服务端按两列渲染，单列时多出来的两张先由 CSS 藏住，接管以后再按实际宽度来。
const narrow = ref(restore && window.matchMedia(NARROW_QUERY).matches)
const preview = computed(() => narrow.value ? GROUP_PREVIEW_NARROW : GROUP_PREVIEW)
let media: MediaQueryList | undefined
const section = ref<HTMLElement>()
const title = ref<HTMLElement>()
const list = ref<HTMLElement>()
let alive = true

// 排序只在这几个时刻拍快照：进入页面、首次拿到热度、主动切换排序。之后的点击只改数字，卡片不跳位。
const ordered = shallowRef(sortBots(bots, sort.value, heatState.values))
const slugs = () => ordered.value.map((bot) => bot.slug).join(',')
function reorder() { ordered.value = sortBots(bots, sort.value, heatState.values) }

// 主推：编辑在策展文件里定的（最多三个，按写的顺序）。
const featured = computed(() => curation.featured.flatMap((item) => bySlug.get(item.bot) ?? []))
const collections = computed(() => curation.collections
  .map((item) => ({ ...item, bots: item.bots.flatMap((slug) => bySlug.get(slug) ?? []) }))
  .filter((item) => item.bots.length))
// 分组切换只列货架上有 Bot 的分组，顺序跟 schema 枚举走。
const tabs = computed(() => groupBots(bots, known.categories).map((group) => ({ category: group.category, count: group.bots.length })))

const activeCollection = computed(() => curation.collections.find((item) => item.slug === collection.value) ?? null)
const listed = computed(() => activeCollection.value ? collectionBots(activeCollection.value, ordered.value, sort.value) : [])
const groups = computed(() => role.value === ALL_ROLES
  ? groupBots(ordered.value, known.categories)
  : groupBots(ordered.value, [role.value]))
const shown = computed(() => activeCollection.value ? listed.value.length : groups.value.reduce((sum, group) => sum + group.bots.length, 0))

function syncUrl() {
  const filtered = !!collection.value || role.value !== ALL_ROLES
  const { pathname, search, hash } = window.location
  // 带着筛选的地址落在「全部 Bot」上：分享出去、刷新回来都直接看到筛选后的列表。
  const url = pathname + writeShelfQuery(search, { role: role.value, collection: collection.value }) + (filtered ? '#all' : hash === '#all' ? '' : hash)
  if (url !== pathname + search + hash) history.replaceState(history.state, '', url)
}
function describe() {
  const label = activeCollection.value ? `${SHELF_COPY.collectionKind}${activeCollection.value.title}` : role.value === ALL_ROLES ? SHELF_COPY.allTitle : role.value
  void announce(`${label}，${SHELF_COPY.total(shown.value)}`)
}
/** 列表换了内容以后：要是列表开头已经滚到工具栏上面去了，退回到开头（工具栏还吸着，不跳）。 */
async function settle() {
  await nextTick()
  const el = list.value
  if (el && el.getBoundingClientRect().top < (parseFloat(getComputedStyle(el).scrollMarginTop) || 0)) el.scrollIntoView({ block: 'start', behavior: 'instant' })
}
function apply(next: { role: string; collection: string | null }) {
  role.value = next.role
  collection.value = next.collection
  entering.value = !isReducedMotion()
  syncUrl()
  describe()
}
async function recordFilter(where: 'shelf_role' | 'shelf_sort' | 'collection', value: string) {
  await nextTick()
  track('filter', { where, value, results: list.value?.querySelectorAll('.bot-card').length ?? 0 })
}
function chooseRole(value: string) {
  if (role.value === value && !collection.value) return
  apply({ role: value, collection: null })
  void recordFilter('shelf_role', value === ALL_ROLES ? '全部' : value)
  void settle()
}
async function pickCollection(slug: string) {
  apply({ role: ALL_ROLES, collection: slug })
  void recordFilter('collection', slug)
  await nextTick()
  // 焦点交给「全部 Bot」的标题：键盘和读屏用户跟着来到筛选后的列表。
  title.value?.focus({ preventScroll: true })
  section.value?.scrollIntoView({ block: 'start', behavior: isReducedMotion() ? 'instant' : 'smooth' })
}
function clearCollection() {
  apply({ role: ALL_ROLES, collection: null })
  void recordFilter('collection', 'none')
  title.value?.focus({ preventScroll: true })
  void settle()
}
function chooseSort(value: ShelfSort) {
  if (sort.value === value) return
  sort.value = value
  if (memory) memory.sort = value
  reorder()
  void recordFilter('shelf_sort', value)
  entering.value = !isReducedMotion()
}
function resized(event: MediaQueryListEvent) { narrow.value = event.matches }
function toggleGroup(category: string) {
  const next = new Set(expanded.value)
  if (!next.delete(category)) next.add(category)
  expanded.value = next
  if (memory) memory.expanded = [...next]
}

onMounted(async () => {
  media = window.matchMedia(NARROW_QUERY)
  narrow.value = media.matches
  media.addEventListener('change', resized)
  if (memory && !memory.visited) {
    // 首次加载：服务端渲染的是默认状态，接管以后再按地址栏还原。
    memory.visited = true
    const fromUrl = readShelfQuery(window.location.search, known)
    role.value = fromUrl.role
    collection.value = fromUrl.collection
    // 带着筛选打开、地址里又没写锚点：直接落到筛选后的列表上（写了 #all 的由 VitePress 自己滚过去）。
    const land = (fromUrl.collection || fromUrl.role !== ALL_ROLES) && !window.location.hash
    // 地址栏里不认识的筛选值顺手清掉；认识的补上 #all。
    syncUrl()
    if (land) void nextTick(() => section.value?.scrollIntoView({ block: 'start', behavior: 'instant' }))
  }
  const success = await loadHeat()
  if (!alive || !success) return
  const previous = slugs()
  reorder()
  entering.value = previous !== slugs() && !isReducedMotion()
})
onBeforeUnmount(() => {
  alive = false
  media?.removeEventListener('change', resized)
})
</script>

<template>
  <section v-if="featured.length" class="shelf-section" aria-labelledby="featured-title">
    <header class="bz-section-head">
      <div><h2 id="featured-title">{{ SHELF_COPY.featuredTitle }}</h2></div>
    </header>
    <div class="featured-grid">
      <FeaturedCard v-for="bot in featured" :key="bot.slug" :bot="bot" />
    </div>
  </section>

  <HomeSquads />

  <HomeCollections :collections="collections" :active="collection" @pick="pickCollection" />

  <section id="all" ref="section" class="shelf-section shelf-all" aria-labelledby="all-title">
    <header class="bz-section-head">
      <div><h2 id="all-title" ref="title" tabindex="-1">{{ SHELF_COPY.allTitle }}</h2></div>
      <span v-if="bots.length" class="bot-count">{{ SHELF_COPY.total(shown) }}</span>
    </header>
    <template v-if="bots.length">
      <ShelfToolbar :tabs="tabs" :total="bots.length" :role="role" :sort="sort" @role="chooseRole" @sort="chooseSort" />
      <div ref="list" class="shelf-list" :class="{ 'grid-enter': entering }" @animationend.self="entering = false">
        <template v-if="activeCollection">
          <div class="filter-bar" data-testid="filter-bar">
            <p><span class="filter-kind">{{ SHELF_COPY.collectionKind }}</span><strong>{{ activeCollection.title }}</strong><span class="filter-total">{{ SHELF_COPY.filterCount(listed.length) }}</span></p>
            <button type="button" class="bz-btn ghost sm" data-testid="filter-clear" @click="clearCollection"><BzIcon name="x" />{{ SHELF_COPY.clear }}</button>
          </div>
          <div class="bot-grid">
            <BotCard v-for="bot in listed" :key="bot.slug" :bot="bot" />
          </div>
        </template>
        <template v-else-if="groups.length">
          <RoleGroup
            v-for="group in groups" :key="group.category" :category="group.category" :bots="group.bots"
            :collapsible="role === ALL_ROLES" :expanded="expanded.has(group.category)" :preview="preview" @toggle="toggleGroup(group.category)"
          />
        </template>
        <div v-else data-testid="empty-filter" class="empty-state">
          <DefaultAvatar slug="empty-shelf" rest="sleep" :size="96" />
          <p>{{ SHELF_COPY.emptyFilter }}</p>
          <button type="button" class="bz-btn" @click="chooseRole(ALL_ROLES)"><BzIcon name="grid" />{{ SHELF_COPY.showAll }}</button>
        </div>
      </div>
    </template>
    <div v-else data-testid="empty-state" class="empty-state">
      <DefaultAvatar slug="empty-shelf" rest="sleep" :size="120" />
      <p>货架上还没有 Bot</p>
      <a class="bz-btn" :href="CONTRIBUTE_URL"><BzIcon name="plus" />做第一个投稿的人</a>
    </div>
  </section>

  <footer v-if="bots.length" class="shelf-footer">
    <a data-testid="contribute-link" class="bz-btn" :href="CONTRIBUTE_URL"><BzIcon name="plus" />{{ SHELF_COPY.contribute }}</a>
  </footer>
</template>
