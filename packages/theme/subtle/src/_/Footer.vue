<script
  setup
  lang='ts'>
import ExistencePeriod from '@_/ExistencePeriod.vue';
import Socials from '@_/Socials.vue';
import { inject } from 'vue';

const fm: {
  author: { name: string; url: string; };
  license: { name: string; url: string; };
} = inject('frontmatter')!;
</script>

<template>
  <footer>
    <div>
      <small>
        <span>
          <a :href='fm.license.url'>
            <span>{{ fm.license.name }}</span>
          </a>
          <ExistencePeriod></ExistencePeriod>
        </span>
        <span>
          <span>by</span>
          <a :href='fm.author.url'>
            <span>{{ fm.author.name }}</span>
          </a>
        </span>
      </small>
      <Socials></Socials>
      <small>
        <span>
          <a href='https://monochromatic.dev/subtle'>
            <span>Subtle</span>
          </a>
          <span>@</span>
          <a href='https://vuejs.org'>
            <span>Vue JS</span>
          </a>
        </span>
        <span>
          <span>by</span>
          <a href='https://aquati.cat'>
            <span>Aquaticat</span>
          </a>
        </span>
      </small>
    </div>
  </footer>
</template>
