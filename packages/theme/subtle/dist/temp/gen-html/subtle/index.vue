<script
  setup
  lang='ts'>
import Footer from '@_/Footer.vue';
import Header from '@_/Header.vue';
import Main from '@_/Main.vue';
</script>

<template>
  <Header></Header>
  <Main>
    <slot></slot>
  </Main>
  <Footer></Footer>
</template>
