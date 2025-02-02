<script
  setup
  lang='ts'>
import Article from '@_/Article.vue';
import Aside from '@_/Aside.vue';
import { inject } from 'vue';
const fm: {
  path: { name: string; };
  lang: string;
  slug: string;
  title: string;
  defaultLang: string;
} = inject(
  'frontmatter',
)!;
const fms: (typeof fm)[] = inject('frontmatters')!;
const matchingFms = fms.filter((potentialMatchingFm) =>
  potentialMatchingFm.path.name === fm.path.name
);
const youCanCheckOut = new Map([
  [
    'en',
    'This page is not yet available in your language. Meanwhile, you can check out',
  ],
  [
    'zh',
    '此页尚未适配你的语言。在此期间，请查看',
  ],
]);
</script>

<template>
  <main>
    <div>
      <Article>
        <slot>
          <ul>
            <li v-for='matchingFm of matchingFms'>
              <p>
                {{
                  youCanCheckOut.get(fm.lang)
                  || youCanCheckOut
                    .get(fm.lang.slice(0, 2))
                  || youCanCheckOut
                    .get(fm.defaultLang)
                  || youCanCheckOut
                    .get(fm.defaultLang.slice(0, 2))!
                }}
              </p>
              <a
                :href='`/${matchingFm.slug}`'
                :data-lang='matchingFm.lang'>{{ matchingFm.title }}</a>
            </li>
          </ul>
        </slot>
      </Article>
      <Aside></Aside>
    </div>
  </main>
</template>
