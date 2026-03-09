import {
  describe,
  expect,
  test,
} from 'bun:test';
import { $, } from './index.ts';

const $$ = '$';

describe($$, () => {
  test('creates a simple element with text content', () => {
    expect($({ tag: 'title', text: 'My Feed', }),).toBe('<title>My Feed</title>',);
  });

  test('self-closes elements with no content', () => {
    expect($({ tag: 'link', }),).toBe('<link />',);
  });

  test('self-closes elements with attrs but no content', () => {
    expect($({ tag: 'link', attrs: { href: 'https://example.com', }, }),).toBe(
      '<link href="https://example.com" />',
    );
  });

  test('does not self-close when text is provided', () => {
    expect($({ tag: 'name', text: '', }),).toBe('<name></name>',);
  });

  test('does not self-close when raw is provided', () => {
    expect($({ tag: 'content', raw: '', }),).toBe('<content></content>',);
  });

  test('does not self-close when children array is non-empty', () => {
    expect($({ tag: 'items', children: [$({ tag: 'item', text: 'a', }),], }),).toBe(
      '<items><item>a</item></items>',
    );
  });

  test('self-closes when children array is empty', () => {
    expect($({ tag: 'items', children: [], }),).toBe('<items />',);
  });

  test('escapes text content', () => {
    expect($({ tag: 'content', text: 'x < y & z > w', }),).toBe(
      '<content>x &lt; y &amp; z &gt; w</content>',
    );
  });

  test('escapes double quotes in text', () => {
    expect($({ tag: 'title', text: 'say "hello"', }),).toBe(
      '<title>say &quot;hello&quot;</title>',
    );
  });

  test('escapes single quotes (apostrophes) in text', () => {
    expect($({ tag: 'title', text: "it's", }),).toBe(
      '<title>it&apos;s</title>',
    );
  });

  test('escapes attribute values', () => {
    expect($({ tag: 'link', attrs: { href: 'a&b=c<d', }, }),).toBe(
      '<link href="a&amp;b=c&lt;d" />',
    );
  });

  test('does not escape raw content', () => {
    const inner = '<nested>raw & unescaped</nested>';
    expect($({ tag: 'wrapper', raw: inner, }),).toBe(
      `<wrapper>${inner}</wrapper>`,
    );
  });

  test('renders multiple attributes in order', () => {
    expect($({
      tag: 'entry',
      attrs: { id: '1', type: 'post', },
    }),).toBe('<entry id="1" type="post" />',);
  });

  test('renders namespaced tag names', () => {
    expect($({ tag: 'atom:title', text: 'Feed', }),).toBe(
      '<atom:title>Feed</atom:title>',
    );
  });

  test('renders namespaced attributes', () => {
    expect($({
      tag: 'feed',
      attrs: { 'xmlns:atom': 'http://www.w3.org/2005/Atom', },
      children: [$({ tag: 'atom:title', text: 'Feed', }),],
    }),).toBe(
      '<feed xmlns:atom="http://www.w3.org/2005/Atom"><atom:title>Feed</atom:title></feed>',
    );
  });

  test('concatenates text, raw, and children in order', () => {
    expect($({
      tag: 'mixed',
      text: 'hello',
      raw: '<b>world</b>',
      children: ['<i>!</i>',],
    }),).toBe('<mixed>hello<b>world</b><i>!</i></mixed>',);
  });

  test('concatenates multiple children', () => {
    expect($({
      tag: 'list',
      children: [
        $({ tag: 'item', text: 'a', }),
        $({ tag: 'item', text: 'b', }),
        $({ tag: 'item', text: 'c', }),
      ],
    }),).toBe('<list><item>a</item><item>b</item><item>c</item></list>',);
  });

  test('handles deeply nested elements', () => {
    const result = $({
      tag: 'root',
      children: [
        $({
          tag: 'parent',
          children: [
            $({ tag: 'child', text: 'leaf', }),
          ],
        }),
      ],
    });
    expect(result,).toBe('<root><parent><child>leaf</child></parent></root>',);
  });

  test('handles RSS-like structure', () => {
    const result = $({
      tag: 'rss',
      attrs: { version: '2.0', },
      children: [
        $({
          tag: 'channel',
          children: [
            $({ tag: 'title', text: 'My Blog', }),
            $({ tag: 'link', attrs: { href: 'https://example.com', }, }),
            $({
              tag: 'item',
              children: [
                $({ tag: 'title', text: 'First Post', }),
                $({ tag: 'description', text: 'Hello <world>', }),
              ],
            }),
          ],
        }),
      ],
    });
    expect(result,).toBe(
      '<rss version="2.0"><channel><title>My Blog</title><link href="https://example.com" /><item><title>First Post</title><description>Hello &lt;world&gt;</description></item></channel></rss>',
    );
  });
},);
