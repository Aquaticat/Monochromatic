<script
  setup
  lang='ts'>
import Article from './Article.vue';
import Aside from './Aside.vue';
</script>

<template>
  <main>
    <div>
      <Article>
        <slot />
      </Article>
      <Aside />
    </div>
  </main>
</template>
