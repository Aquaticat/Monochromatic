<script
  setup
  lang='ts'>
import { inject } from 'vue';
import ExistencePeriod from './ExistencePeriod.vue';
import Socials from './Socials.vue';

const fm: { author: { name: string; url: string; }; license: { name: string; url: string; }; } = inject('frontmatter')!;
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
          <a href='https://astro.build'>
            <span>Astro</span>
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
