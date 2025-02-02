<script
  setup
  lang='ts'>
import Posts from '@_/Posts.vue';

import { inject } from 'vue';

const fm: {
  slashSiteBase: string;
  slashSiteBaseWLang: string;
  lang: string;
  defaultLang: string;
} = inject(
  'frontmatter',
)!;

const fms: {
  title: string;
  slug: string;
  description: string;
  summary: string;
  published: [{ date: Date; }];
  updated: [{ date: Date; }];
  tags: string[];
  isLinks: boolean;
  isPost: boolean;
  lang: string;
  is404: boolean;
}[] = inject('frontmatters')!;

const uniqueTags: ReadonlySet<string> = new Set(fms.flatMap((fm) => fm.tags));

const tagPost = new Map(
  Array.from(uniqueTags).map((
    tag,
  ) => [tag, fms.filter((fm) => !fm.is404 && fm.isPost && fm.tags.includes(tag))]),
);

const searchPlaceholder = new Map([['en', 'Search keyword, topic, or text'], [
  'zh',
  '搜索关键词，话题，或文段',
]]);
</script>

<template>
  <header>
    <div>
      <a :href='fm.slashSiteBaseWLang'>
        <img
          :src='`${fm.slashSiteBase}/favicon.svg`'
          alt='avatar'>
      </a>
      <nav>
        <button popovertarget='search'>
          <svg
            width='20'
            height='20'
            viewBox='0 0 20 20'
            fill='none'
            xmlns='http://www.w3.org/2000/svg'>
            <path
              d='M18.7441 19.0893L14.03 14.3752M16.8333 9.33333C16.8333 13.0152 13.8486 16 10.1667 16C6.48477 16 3.5 13.0152 3.5 9.33333C3.5 5.65143 6.48477 2.66666 10.1667 2.66666C13.8486 2.66666 16.8333 5.65143 16.8333 9.33333Z'
              stroke='currentColor'
              stroke-width='2.5'
            />
          </svg>
        </button>
        <div
          popover
          id='search'>
          <form method='get'>
            <input
              name='q'
              type='search'
              required
              :placeholder='searchPlaceholder.get(fm.lang)
              || searchPlaceholder
                .get(fm.lang.slice(0, 2))
              || searchPlaceholder
                .get(fm.defaultLang)
              || searchPlaceholder
                .get(fm.defaultLang.slice(0, 2))!'
            />
          </form>
          <ul class='Header__tags'>
            <li v-for='([tag, posts]) of tagPost'>
              <details>
                <summary>
                  <span>{{ tag }}</span>
                </summary>

                <Posts :posts></Posts>
              </details>
            </li>
          </ul>
        </div>

        <a :href='`${fm.slashSiteBaseWLang}/links`'><span>{{
            fms
            .find((potentialLinks) => potentialLinks.isLinks && potentialLinks.lang === fm.lang)
            ?.title
            || fms
              .find((potentialLinks) =>
                potentialLinks.isLinks && potentialLinks.lang === fm.defaultLang
              )!
              .title
          }}</span></a>
      </nav>
    </div>
  </header>
</template>
