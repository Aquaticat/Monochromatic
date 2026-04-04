import {
  hCss as $,
  cssCompounded,
  type CssDeclarations,
  cssNum,
  cssOklch,
  cssRem,
  type CssValue,
  cssVar,
} from '@monochromatic-dev/module-hyperscript/ts';
import {
  describe,
  expect,
  test,
} from 'bun:test';

const $$ = '$';

describe($$, () => {
  //region Style rules

  test('creates a simple rule with declarations', () => {
    expect($({ rule: '.card', decls: { display: 'flex', gap: cssRem(1,), }, },),).toBe(
      '.card{display:flex;gap:1rem}',
    );
  });

  test('creates a rule with no declarations', () => {
    expect($({ rule: '.empty', },),).toBe('.empty{}',);
  });

  test('creates a rule with a single declaration', () => {
    expect($({ rule: 'body', decls: { margin: '0', }, },),).toBe('body{margin:0}',);
  });

  test('preserves CSS custom property names', () => {
    expect($({ rule: ':root', decls: { '--color-fg': 'oklch(0.2 0 0)', }, },),).toBe(
      ':root{--color-fg:oklch(0.2 0 0)}',
    );
  });

  test('handles complex selectors', () => {
    expect(
      $({ rule: '.card > .title:first-child', decls: { 'font-weight': 'bold', }, },),
    )
      .toBe(
        '.card > .title:first-child{font-weight:bold}',
      );
  });

  //endregion

  //region Nested rules

  test('nests child rules inside a parent', () => {
    expect($({
      rule: '.card',
      decls: { display: 'flex', },
      children: [
        $({ rule: '&:hover', decls: { opacity: cssNum(0.8,), }, },),
      ],
    },),)
      .toBe('.card{display:flex;&:hover{opacity:0.8}}',);
  });

  test('nests multiple children', () => {
    expect($({
      rule: '.btn',
      decls: { padding: '0.5rem' as CssValue, },
      children: [
        $({ rule: '&:hover',
          decls: { 'background-color': cssOklch({ l: 0.45, c: 0.31, h: 264, },), }, },),
        $({ rule: '&:focus-visible', decls: { outline: '2px solid' as CssValue, }, },),
      ],
    },),)
      .toBe(
        '.btn{padding:0.5rem;&:hover{background-color:oklch(0.45 0.31 264)}&:focus-visible{outline:2px solid}}',
      );
  });

  test('nests children without parent declarations', () => {
    expect($({
      rule: '.wrapper',
      children: [
        $({ rule: '& > *', decls: { flex: '1', }, },),
      ],
    },),)
      .toBe('.wrapper{& > *{flex:1}}',);
  });

  test('deeply nests rules', () => {
    expect($({
      rule: '.a',
      children: [
        $({
          rule: '& .b',
          children: [
            $({ rule: '& .c', decls: { color: cssVar('fg',), }, },),
          ],
        },),
      ],
    },),)
      .toBe('.a{& .b{& .c{color:var(--fg)}}}',);
  });

  //endregion

  //region At-rules with children

  test('creates a media query with child rules', () => {
    expect($({
      at: 'media',
      params: '(prefers-color-scheme: dark)',
      children: [
        $({ rule: ':root', decls: { '--color-fg': 'oklch(0.9 0 0)', }, },),
      ],
    },),)
      .toBe('@media (prefers-color-scheme: dark){:root{--color-fg:oklch(0.9 0 0)}}',);
  });

  test('creates a layer block with rules', () => {
    expect($({
      at: 'layer',
      params: 'components',
      children: [
        $({ rule: '.btn', decls: { display: 'inline-flex', }, },),
      ],
    },),)
      .toBe('@layer components{.btn{display:inline-flex}}',);
  });

  test('creates a scope block', () => {
    expect($({
      at: 'scope',
      params: '(.card)',
      children: [
        $({ rule: '.title', decls: { 'font-size': cssRem(1.5,), }, },),
      ],
    },),)
      .toBe('@scope (.card){.title{font-size:1.5rem}}',);
  });

  test('nests at-rules inside at-rules', () => {
    expect($({
      at: 'layer',
      params: 'theme',
      children: [
        $({
          at: 'media',
          params: '(prefers-color-scheme: dark)',
          children: [
            $({ rule: ':root', decls: { '--bg': 'black', }, },),
          ],
        },),
      ],
    },),)
      .toBe('@layer theme{@media (prefers-color-scheme: dark){:root{--bg:black}}}',);
  });

  //endregion

  //region At-rules with declarations

  test('creates a @property rule', () => {
    expect($({
      at: 'property',
      params: '--color-fg',
      decls: {
        syntax: '"<color>"',
        inherits: 'true',
        'initial-value': 'black',
      },
    },),)
      .toBe('@property --color-fg{syntax:"<color>";inherits:true;initial-value:black}',);
  });

  test('creates a @font-face rule', () => {
    expect($({
      at: 'font-face',
      decls: {
        'font-family': '"Aquaticat"',
        src: 'url("aquaticat.woff2") format("woff2")',
        'font-display': 'swap',
      },
    },),)
      .toBe(
        '@font-face{font-family:"Aquaticat";src:url("aquaticat.woff2") format("woff2");font-display:swap}',
      );
  });

  test('creates a @counter-style rule', () => {
    expect($({
      at: 'counter-style',
      params: 'dash',
      decls: { system: 'cyclic', symbols: '"–"', suffix: '" "', },
    },),)
      .toBe('@counter-style dash{system:cyclic;symbols:"–";suffix:" "}',);
  });

  //endregion

  //region Statement at-rules

  test('creates a @layer statement', () => {
    expect($({ at: 'layer', params: 'tokens, base, components', },),).toBe(
      '@layer tokens, base, components;',
    );
  });

  test('creates a @charset statement', () => {
    expect($({ at: 'charset', params: '"UTF-8"', },),).toBe('@charset "UTF-8";',);
  });

  test('creates an @import statement', () => {
    expect($({ at: 'import', params: 'url("reset.css")', },),).toBe(
      '@import url("reset.css");',
    );
  });

  test('creates an @import with layer', () => {
    expect($({ at: 'import', params: 'url("theme.css") layer(theme)', },),).toBe(
      '@import url("theme.css") layer(theme);',
    );
  });

  test('creates a @namespace statement', () => {
    expect($({ at: 'namespace', params: 'url("http://www.w3.org/1999/xhtml")', },),).toBe(
      '@namespace url("http://www.w3.org/1999/xhtml");',
    );
  });

  test('creates an at-rule with no params', () => {
    expect($({ at: 'layer', },),).toBe('@layer;',);
  });

  //endregion

  //region Raw content

  test('injects raw CSS inside a rule', () => {
    expect($({ rule: '.card', raw: 'display:flex;gap:1rem', },),).toBe(
      '.card{display:flex;gap:1rem}',
    );
  });

  test('injects raw CSS inside an at-rule', () => {
    expect($({
      at: 'media',
      params: '(width >= 768px)',
      raw: '.sidebar{display:block}',
    },),)
      .toBe('@media (width >= 768px){.sidebar{display:block}}',);
  });

  //endregion

  //region Composition patterns (mixin replacement)

  test('composes declarations via object spread', () => {
    function flexCenter(): CssDeclarations {
      return { display: 'flex', 'align-items': 'center', 'justify-content': 'center', };
    }

    expect($({ rule: '.hero', decls: { ...flexCenter(), gap: cssRem(2,), }, },),).toBe(
      '.hero{display:flex;align-items:center;justify-content:center;gap:2rem}',
    );
  });

  test('composes parameterized declarations', () => {
    function touchTarget(
      { size = '48px' as CssValue, }: { size?: CssValue; } = {},
    ): CssDeclarations {
      return { 'min-inline-size': size, 'min-block-size': size, };
    }

    expect(
      $({ rule: '.btn',
        decls: { ...touchTarget({ size: '44px' as CssValue, },),
          cursor: 'pointer', }, },),
    )
      .toBe(
        '.btn{min-inline-size:44px;min-block-size:44px;cursor:pointer}',
      );
  });

  //endregion

  //region Real-world patterns from existing CSS

  test('generates a design token layer', () => {
    const result = $({
      at: 'layer',
      params: 'tokens',
      children: [
        $({
          rule: ':root',
          decls: {
            '--color-fg': 'oklch(0.2 0 0)',
            '--color-bg': 'oklch(0.98 0 0)',
            '--gap-md': '1rem',
          },
        },),
        $({
          at: 'media',
          params: '(prefers-color-scheme: dark)',
          children: [
            $({
              rule: ':root',
              decls: {
                '--color-fg': 'oklch(0.9 0 0)',
                '--color-bg': 'oklch(0.1 0 0)',
              },
            },),
          ],
        },),
      ],
    },);
    expect(result,).toBe(
      '@layer tokens{:root{--color-fg:oklch(0.2 0 0);--color-bg:oklch(0.98 0 0);--gap-md:1rem}@media (prefers-color-scheme: dark){:root{--color-fg:oklch(0.9 0 0);--color-bg:oklch(0.1 0 0)}}}',
    );
  });

  test('generates a component with nested hover and focus', () => {
    const result = $({
      rule: '.card',
      decls: {
        display: 'flex',
        'flex-direction': 'column',
        gap: cssVar('gap-md',),
        'border-radius': cssRem(0.5,),
      },
      children: [
        $({ rule: '&:hover', decls: {
          'box-shadow': cssCompounded([0, '2px' as CssValue, '8px' as CssValue,
            cssOklch({ l: 0, c: 0, h: 0, a: 0.1, },),],),
        }, },),
        $({ rule: '&:focus-visible', decls: {
          outline: cssCompounded(['2px' as CssValue, 'solid', cssVar('color-accent',),],),
        }, },),
        $({ rule: '& > .title',
          decls: { 'font-size': cssRem(1.25,), 'font-weight': 600, }, },),
      ],
    },);
    expect(result,).toBe(
      '.card{display:flex;flex-direction:column;gap:var(--gap-md);border-radius:0.5rem;&:hover{box-shadow:0 2px 8px oklch(0 0 0 / 0.1)}&:focus-visible{outline:2px solid var(--color-accent)}& > .title{font-size:1.25rem;font-weight:600}}',
    );
  });

  //endregion
},);
