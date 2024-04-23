<script
  setup
  lang='ts'>
import { inject } from 'vue';

const fm: { slashSiteBase: string; slashSiteBaseWLang: string; } = inject('frontmatter')!;

const fms: { tags: string[]; }[] = inject('frontmatters')!;

const uniqueTags: ReadonlySet<string> = new Set(fms.flatMap((fm) => fm.tags));

const tagPost = new Map(
  Array.from(uniqueTags).map((tag) => [tag, fms.filter((fm) => fm.tags.includes(tag))]),
);

// TODO: Set search placeholder dynamically to different langs.
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
              placeholder='search'
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

        <a :href='`${fm.slashSiteBaseWLang}/links`'><span>Links</span></a>
      </nav>
    </div>
  </header>
</template>
