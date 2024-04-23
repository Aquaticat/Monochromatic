<script
  setup
  lang='ts'>
import { inject } from 'vue';
import Links from './Links.vue';
import Posts from './Posts.vue';
const fm: { title: string; isHome: boolean; isLinks: boolean; is404: boolean; } = inject('frontmatter')!;
</script>

<template>
  <aside class='Aside'>
    <Posts v-if='fm.isHome' />
    <Links v-else-if='fm.isLinks' />
    <div
      v-else-if='fm.is404'
      class='FourOFour'>
      404
    </div>
    <div
      v-else
      class='Related'>
      not
    </div>
  </aside>
</template>
