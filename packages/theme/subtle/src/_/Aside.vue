<script
  setup
  lang='ts'>
import Links from '@_/Links.vue';
import Posts from '@_/Posts.vue';
import { inject } from 'vue';
const fm: { title: string; isHome: boolean; isLinks: boolean; is404: boolean; } = inject(
  'frontmatter',
)!;
</script>

<template>
  <aside class='Aside'>
    <Posts v-if='fm.isHome'></Posts>
    <Links v-else-if='fm.isLinks'></Links>
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
