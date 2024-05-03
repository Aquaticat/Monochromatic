<script
  setup
  lang='ts'>
import { inject } from 'vue';

const fm: { earliest: Date; latest: Date; lang: string; } = inject('frontmatter')!;

const earliestYear = fm.earliest.getFullYear();
const latestYear = fm.latest.getFullYear();
</script>

<template>
  <span class='existence-period'>
    <time :datetime='String(earliestYear)'>{{ earliestYear }}</time>
    -
    <time :datetime='String(latestYear)'>{{ latestYear }}</time>
  </span>
</template>
