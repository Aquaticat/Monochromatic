## Astro

instead of Nue

## Vscode/vscodium or neovide (neovim)

instead of WebStorm (JetBrains)

## Biome + dprint

instead of eslint + eslint-typescript + eslint-*

## Playwright

instead of

1.  [WebdriverIO](https://webdriver.io)

    Supports using Firefox ESR, which Playwright doesn't have,
    but doesn't support

    1.  Emulate prefers-contrast and prefers-reduced-motion

    2.  Specifying Firefox user.js and Chrome flags

        You can avoid this by configuring a browser myself in the host system but you lose reproducibility on other machines.

        Q: Write a script to install and configure those?

        A: Too much work.

2.  Vitest

    Doesn't even support prefers-color-scheme
