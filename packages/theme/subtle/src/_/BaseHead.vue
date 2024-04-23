<script
  setup
  lang='ts'>
import { inject } from 'vue';

const fm: {
  description: string;
  lang: string;
  slashSiteBase: string;
  canonicalUrl: string;
  tags: string[];
  title: string;
  fullTitle: string;
  theming: { color: string; };
} = inject('frontmatter')!;
</script>

<template>
  <meta charset='utf-8' />
  <meta
    name='viewport'
    content='width=device-width,initial-scale=1'
  />
  <link
    rel='icon'
    type='image/svg+xml'
    :href='`${fm.slashSiteBase}/favicon.svg`'
  />

  <!-- Canonical URL -->
  <link
    rel='canonical'
    :href='fm.canonicalUrl'
  />

  <!-- Primary Meta Tags -->
  <title>{{ fm.fullTitle }}</title>
  <meta
    name='title'
    :content='fm.title'
  />
  <meta
    name='description'
    :content='fm.description'
  />

  <meta
    name='theme-color'
    :content='fm.theming.color'
  />

  <meta
    name='keywords'
    :content="fm.tags.join(' ')"
  />

  <link
    :href='`${fm.slashSiteBase}/index.css`'
    blocking='render'
    rel='stylesheet preload'>

  <link
    :src='`${fm.slashSiteBase}/index.js`'
    async
    type='module'>
</template>
