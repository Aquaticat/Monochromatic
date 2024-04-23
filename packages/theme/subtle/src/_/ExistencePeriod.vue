<script
  setup
  lang='ts'>
import { inject } from 'vue';

const fm: { earliest: Date; latest: Date; lang: string; } = inject('frontmatter')!;

const earliestYear = fm.earliest.toLocaleDateString(fm.lang, { year: 'numeric' });
const latestYear = fm.latest.toLocaleDateString(fm.lang, { year: 'numeric' });
</script>

<template>
  <span class='existence-period'>
    <time :datetime='earliestYear'>{{ earliestYear }}</time>
    -
    <time :datetime='latestYear'>{{ latestYear }}</time>
  </span>
</template>
