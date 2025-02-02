import { exec as execOriginal } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execOriginal);

const shell = '/bin/bash';

console.log('on-create.mjs taking over', (await exec('node --version', { shell })).stdout);

console.log(
  'pnpm and zypper',
  await Promise.all([
    console.log(
      'pnpm',
      (
        await exec(
          'pnpm i -g @mdx-js/language-server remark-language-server typescript-language-server yaml-language-server vscode-langservers-extracted && pnpm la -g',
          { shell },
        )
      ).stdout,
    ),
    // MAYBE: Could've simplified this, but it ain't broken, so #priority:low
    (async () => {
      console.log(
        'zypper rustup',
        (
          await exec(
            'zypper install -y rustup cmake autoconf automake binutils bison cpp gcc gettext-tools glibc-devel libtool m4 make ncurses-devel patch zlib-devel gcc-c++ git libstdc++-devel',
            { shell },
          )
        ).stdout,
      );

      console.log(
        'rust and zypper other',
        await Promise.all([
          (async () => {
            console.log(
              'rust',
              (
                await exec(
                  `mkdir -p ~/.cargo/bin && echo 'export CARGO_HOME="$HOME/.cargo"' >> ~/.bashrc && source ~/.bashrc && rustup default stable && ls $HOME/.cargo/bin && echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc && cargo --version && cargo install ripgrep fastmod starship lsd zellij && echo $CARGO_HOME && ls $HOME/.cargo && ls $HOME/.cargo/bin && echo $PATH`,
                  { shell },
                )
              ).stdout,
            );

            await Promise.all([
              console.log('fastmod', (await exec('source ~/.bashrc && fastmod --version', { shell })).stdout),
              console.log('ripgrep', (await exec('source ~/.bashrc && rg --version', { shell })).stdout),
              console.log(
                'lsd',
                (
                  await exec(
                    `source ~/.bashrc && lsd --version && echo 'alias ls="lsd"' >> ~/.bashrc && source ~/.bashrc && ls --version`,
                    {
                      shell,
                    },
                  )
                ).stdout,
              ),
              console.log(
                'starship',
                (
                  await exec(
                    `source ~/.bashrc && starship --version && echo 'eval "$(starship init bash)"' >> ~/.bashrc && mkdir -p ~/.config && touch ~/.config/starship.toml && echo "[container]" >> ~/.config/starship.toml && echo "format='[$symbol](dimmed) '" >> ~/.config/starship.toml && source ~/.bashrc && starship --version`,
                    { shell },
                  )
                ).stdout,
              ),
              console.log(
                'zellij',
                (
                  await exec(
                    `source ~/.bashrc && mkdir ~/.config/zellij && touch ~/.config/zellij/config.kdl && echo 'on_force_close "quit"' >> ~/.config/zellij/config.kdl && echo 'export TERMINAL="zellij run -c -- "' >> ~/.bashrc && source ~/.bashrc && zellij --version`,
                    { shell },
                  )
                ).stdout,
              ),
            ]);
          })(),
          console.log(
            'zypper other',
            (
              await exec(
                `zypper install -y plantuml graphviz go helix && echo 'alias hx="helix"' >> ~/.bashrc && echo 'export EDITOR="helix"' >> ~/.bashrc`,
                {
                  shell,
                },
              )
            ).stdout,
          ),
        ]),
      );
    })(),
  ]),
);
