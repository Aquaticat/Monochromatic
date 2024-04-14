#!/usr/bin/env zx
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { $ } from 'zx';

console.log('on-create.mts taking over');

$.prefix += 'source ~/.bashrc';

await Promise.all([
  $`pnpm i -g @mdx-js/language-server remark-language-server typescript-language-server yaml-language-server vscode-langservers-extracted`,
  (async () => {
    $`zypper in -y rustup cmake autoconf automake binutils bison cpp gcc gettext-tools glibc-devel libtool m4 make ncurses-devel patch zlib-devel gcc-c++ git libstdc++-devel plantuml graphviz go helix`;

    $`cargo install ripgrep fastmod starship lsd zellij`;

    await appendFile(
      join(homedir(), '.bashrc'),
      `
alias ls="lsd"
eval "$(starship init bash)"
export TERMINAL="zellij run -c -- "
export EDITOR="helix"
alias hx="helix"
`,
    );

    await Promise.all([
      $`fastmod --version`,
      $`rg --version`,
      (async () => {
        await mkdir(join(homedir(), '.config'), { recursive: true });
        await appendFile(
          join(homedir(), '.config', 'starship.toml'),
          `
[container]
format='[$symbol](dimmed) '
`,
        );

        await $`starship --version`;
      })(),
      (async () => {
        await mkdir(join(homedir(), '.config', 'zellij'), { recursive: true });
        await appendFile(
          join(homedir(), '.config', 'zellij', 'config.kdl'),
          `
on_force_close "quit"
`,
        );
        await $`zellij --version`;
      })(),
      $`hx --version`,
      (async () => {
        await mkdir(join(homedir(), '.config', 'lsd'), { recursive: true });
        await appendFile(
          join(homedir(), '.config', 'lsd', 'config.yaml'),
          `
blocks:
  - permission
  - user
  - group
  - context
  - size
  - date
  - name
  - inode
  - links
  - git

icons:
  theme: unicode

indicators: true

layout: tree

recursion:
  enabled: true
  depth: 8

total-size: true

hyperlink: auto
`,
        );
        await $`ls --version`;
        await $`ls`;
      })(),
    ]);
  })(),
]);
