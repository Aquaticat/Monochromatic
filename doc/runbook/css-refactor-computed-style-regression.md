# Regression-test a CSS refactor with a computed-style diff

Purpose: prove a stylesheet or class-name refactor changes nothing a visitor can see, deterministically,
on a static site served by two local servers (before and after).
Verified 2026-10-18 on the Xinyan Chen portfolio (six pages, 4 widths, about 1,300 element pseudos per page).

## Why not screenshots

Full-page screenshots of the same commit, taken twice, differed in 12 of 66 captures (up to 2 percent of pixels):
lazy images below the fold were sometimes unpainted, and an extra wait for every image to load and decode still left
7 differing captures. A probe that differs from itself cannot show "no difference".
Computed styles do not depend on paint timing, and a cascade flip, which is the refactor's real risk, shows up there
directly as a changed property value. Keep screenshots only to look at a difference the diff already found.

## Method

- Load each page at each width in two `agent-browser` sessions, one per server, and wait for network idle
  (plus any intro animation; computed `opacity` changes while it runs).
- In the page, walk `document.documentElement` and every descendant, and for each element and its `::before`,
  `::after` and `::marker`, serialise every standard property from `getComputedStyle`, sorted.
  Key each element by its DOM position (tag and child index per level), so renamed classes do not change keys.
- Return only a hash per key, then fetch full values for the keys whose hashes differ.
- Skip custom properties: a refactor renames them on purpose, and their effects already show in real properties.
- Strip `location.origin` from values: resolved `url()` values carry the server's port, which differs per side.
- States: `getComputedStyle` cannot see `:hover` or `:focus-visible` unless the browser is in that state, so
  `agent-browser hover <selector>` and `focus <selector>` each candidate element, then read the stateful properties
  of the element and its pseudo-elements. Check the selector exists on both sides first, and do not print the
  action's error text: it names the session, so it differs by side.

## Validate the probe before trusting a zero

1. Run it with the same server on both sides: it must print `summary: 0 differences`.
2. Positive control: copy the site, change one ordinary property (here `padding-block: 2rem` to `calc(2rem + 1px)`
   on a note) and one hover-only colour, serve the copy, and confirm both are reported.

## Tool

```js
// Computed-style regression between two servers of the portfolio: every element and its ::before, ::after and
// ::marker, every standard property, at each width, plus hover and focus states of interactive elements.
// Usage: node style-diff.mjs <base-url> <candidate-url> [page ...]
// Exit code 1 when anything differs; prints each difference as element, pseudo, property, base and candidate value.
import { execFileSync } from 'node:child_process';

const [base, candidate, ...only] = process.argv.slice(2);
const PAGES = only.length ? only : ['index', 'about', 'contact', 'tales-for-safer-trails', 'menume', 'scotties'];
const WIDTHS = [390, 744, 1440, 1920];
// Interactive elements whose state rules the refactor rewrites; the first match of each selector is tested.
const STATES = [
  'a[href="about.html"]:not(#portfolio-primary-navigation a)', '#portfolio-primary-navigation>a', '.portfolio-back-to-top-link',
  'form button[type=submit]', 'a[href^="mailto:"]', 'a[href$=".pdf"]', 'main a[href$=".html"]', '[popovertarget]',
  'nav ul a', 'a[target="_blank"]', 'input', 'textarea',
];
const browser = (session, ...args) => execFileSync('agent-browser', ['--session', session, ...args], {
  encoding: 'utf8', timeout: 180_000, maxBuffer: 256 * 1024 * 1024,
});

const COLLECT = `(() => {
  const PSEUDOS = ['', '::before', '::after', '::marker'];
  const key = (element) => {
    const parts = [];
    for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
      parts.unshift(node.tagName.toLowerCase() + ':' + [...node.parentElement.children].indexOf(node));
    }
    return parts.join('>');
  };
  const serialise = (style) => {
    const out = [];
    for (let index = 0; index < style.length; index += 1) {
      const name = style[index];
      // Resolved url() values carry the server's origin, which differs between the two sides.
      if (!name.startsWith('--')) out.push(name + ':' + style.getPropertyValue(name).replaceAll(location.origin, ''));
    }
    return out.sort().join(';');
  };
  const hash = (text) => {
    let value = 2166136261;
    for (let index = 0; index < text.length; index += 1) value = Math.imul(value ^ text.charCodeAt(index), 16777619);
    return (value >>> 0).toString(36);
  };
  window.__styleDump = {};
  const result = {};
  for (const element of [document.documentElement, ...document.documentElement.querySelectorAll('*')]) {
    const id = element === document.documentElement ? 'html' : key(element);
    for (const pseudo of PSEUDOS) {
      const text = serialise(getComputedStyle(element, pseudo || null));
      window.__styleDump[id + pseudo] = text;
      result[id + pseudo] = hash(text);
    }
  }
  return JSON.stringify(result);
})()`;
const detail = (ids) => `JSON.stringify(Object.fromEntries(${JSON.stringify(ids)}.map((id) => [id, window.__styleDump[id]])))`;
const stateProbe = (selector) => `(() => {
  const element = document.querySelector(${JSON.stringify(selector)});
  if (!element) return 'none';
  return [getComputedStyle(element), getComputedStyle(element, '::before'), getComputedStyle(element, '::after')]
    .map((style) => ['color', 'background-color', 'text-decoration-line', 'outline-style', 'outline-color', 'outline-width',
      'outline-offset', 'box-shadow', 'opacity', 'border-color', 'cursor'].map((name) => style.getPropertyValue(name)).join('|'))
    .join(' / ');
})()`;

const load = (session, url, page, width) => {
  browser(session, 'set', 'viewport', String(width), '900', '1');
  browser(session, 'open', `${url}/${page}.html?s=${Date.now()}`);
  browser(session, 'wait', '--load', 'networkidle');
  // Home's intro animation ends at 7.25 s; computed opacity changes until then.
  browser(session, 'wait', page === 'index' ? '8500' : '800');
};
const parse = (output) => JSON.parse(JSON.parse(output));

let differences = 0;
for (const page of PAGES) {
  for (const width of WIDTHS) {
    load('style-base', base, page, width);
    load('style-cand', candidate, page, width);
    const a = parse(browser('style-base', 'eval', COLLECT));
    const b = parse(browser('style-cand', 'eval', COLLECT));
    const ids = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((id) => a[id] !== b[id]);
    if (ids.length) {
      const da = parse(browser('style-base', 'eval', detail(ids.slice(0, 40))));
      const db = parse(browser('style-cand', 'eval', detail(ids.slice(0, 40))));
      for (const id of ids.slice(0, 40)) {
        const pa = new Map((da[id] ?? '').split(';').map((entry) => [entry.slice(0, entry.indexOf(':')), entry.slice(entry.indexOf(':') + 1)]));
        const pb = new Map((db[id] ?? '').split(';').map((entry) => [entry.slice(0, entry.indexOf(':')), entry.slice(entry.indexOf(':') + 1)]));
        for (const name of new Set([...pa.keys(), ...pb.keys()])) {
          if (pa.get(name) !== pb.get(name)) console.log(`${page}@${width} ${id} ${name}: ${pa.get(name)} -> ${pb.get(name)}`);
        }
      }
      if (ids.length > 40) console.log(`${page}@${width} ... ${ids.length - 40} more differing element pseudos`);
    }
    differences += ids.length;
    // Hover and focus states, measured on the live element after the browser applies each state.
    for (const selector of STATES) {
      for (const action of ['hover', 'focus']) {
        const present = [['style-base'], ['style-cand']].map(([session]) =>
          browser(session, 'eval', `!!document.querySelector(${JSON.stringify(selector)})`).trim());
        if (present[0] !== present[1]) {
          differences += 1;
          console.log(`${page}@${width} ${selector}: present ${present[0]} -> ${present[1]}`);
          continue;
        }
        if (present[0] !== 'true') continue;
        const states = [['style-base', base], ['style-cand', candidate]].map(([session]) => {
          try {
            browser(session, action, selector);
          } catch (error) {
            // Report only that the action failed; the message names the session, which differs by side.
            console.error(`${session} ${action} ${selector}: ${String(error.message).split('\n')[0]}`);
            return `not ${action}able`;
          }
          browser(session, 'wait', '300');
          return browser(session, 'eval', stateProbe(selector)).trim();
        });
        if (states[0] !== states[1]) {
          differences += 1;
          console.log(`${page}@${width} ${action} ${selector}: ${states[0]} -> ${states[1]}`);
        }
      }
    }
    console.log(`checked ${page}@${width}: ${Object.keys(a).length} element pseudos, ${ids.length} differ`);
  }
}
browser('style-base', 'close');
browser('style-cand', 'close');
console.log(`summary: ${differences} differences`);
process.exitCode = differences ? 1 : 0;
```
