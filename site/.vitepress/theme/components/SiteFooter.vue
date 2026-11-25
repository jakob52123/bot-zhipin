<!--
  全站页脚：站名、创建人、开源仓库、鸣谢。文字在 meta.mjs 的 FOOTER；和内容区同宽，小字、灰色，不抢正文。
  放在主题 Layout 的 layout-bottom 插槽里，每一页都有。
-->
<script setup lang="ts">
import { FOOTER, HERO_MASCOTS, SITE } from '../../meta.mjs'
import { shapeRadii } from '../face'
import BzIcon from './BzIcon.vue'
import StaticBot from './StaticBot.vue'

// 和导航条上的站标同一只（橙色那只）
const logo = HERO_MASCOTS.find((mascot) => mascot.key === 'orange')!
const repoPath = SITE.repo.replace(/^https:\/\/github\.com\//, '')
</script>

<template>
  <footer class="site-footer" data-testid="site-footer">
    <div class="site-footer-inner">
      <div class="site-footer-brand">
        <p class="site-footer-name"><StaticBot :radii="shapeRadii(logo.shape)" :color="logo.color" :size="20" aria-hidden="true" />{{ SITE.name }}</p>
        <p data-testid="footer-creator">{{ FOOTER.creatorLabel }}：{{ FOOTER.creator }} · {{ FOOTER.org }}</p>
      </div>
      <dl class="site-footer-meta">
        <div>
          <dt>{{ FOOTER.repoLabel }}</dt>
          <dd class="site-footer-project"><a data-testid="footer-repo" :href="SITE.repo" target="_blank" rel="noopener noreferrer">{{ repoPath }}<BzIcon name="arrow-up-right" /></a><span class="site-footer-license"><span class="site-footer-sep" aria-hidden="true">·</span>{{ FOOTER.license }}</span><span class="site-footer-license"><span class="site-footer-sep" aria-hidden="true">·</span><a data-testid="footer-privacy" href="/privacy">{{ FOOTER.privacy }}</a></span></dd>
        </div>
        <div>
          <dt>{{ FOOTER.thanksLabel }}</dt>
          <dd data-testid="footer-thanks">{{ FOOTER.thanks }}</dd>
        </div>
      </dl>
    </div>
  </footer>
</template>
