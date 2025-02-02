## Shell aliases

### `yarn run -T -B `

```fish
alias --save yr='yarn run -T -B '
```

### `yarn dlx @yarnpkg/sdks vscode typescript`

Use `y` for installing dependencies, building sdks, and cleaning up `.vscode` dir.
Don't forget to make sure the necessary configurations are defined in `.code-workspace` file.
Warning: will delete your `.vscode` dir.
Always run it at the top level of your workspace.

Use `yarn install` for installing dependencies only.

```fish
alias --save y='yarn install && yarn dlx @yarnpkg/sdks vscode && rm -r .vscode'
```
