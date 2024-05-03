<script
  setup
  lang='ts'>
import { inject } from 'vue';
import PrettyDate from './PrettyDate.vue';
defineProps<
  {
    post: {
      title: string;
      slug: string;
      description: string;
      summary: string;
      published: [{ date: Date; }];
      updated: [{ date: Date; }];
      tags: string[];
    };
  }
>();
const fm: { slashSiteBaseWLang: string; } = inject('frontmatter')!;
</script>

<template>
  <li class='Post a'>
    <a
      class='overlay'
      :href='`/${post.slug}`'>{{ post.title }}</a>
    <div class='Post__content'>
      <h2>{{ post.title }}</h2>
      <p class='Post__description'>{{ post.description }}</p>
      <p class='Post__summary'>{{ post.summary }}</p>
      <aside>
        <ul class='Post__tags'>
          <li
            v-for='tag of post.tags'
            class='Post__tag'>
            <a :href='`${fm.slashSiteBaseWLang}/tags/${tag}`'>
              <span>{{ tag }}</span>
            </a>
          </li>
        </ul>
        <span class='date'>
          <PrettyDate :date='post.published.at(0)!.date'></PrettyDate>
          -
          <PrettyDate :date='post.updated.at(-1)!.date'></PrettyDate>
        </span>
      </aside>
    </div>
  </li>
</template>
