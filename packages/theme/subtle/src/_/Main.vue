<script
  setup
  lang='ts'>
import Article from '@_/Article.vue';
import Aside from '@_/Aside.vue';
</script>

<template>
  <main>
    <div>
      <Article>
        <slot></slot>
      </Article>
      <Aside></Aside>
    </div>
  </main>
</template>
