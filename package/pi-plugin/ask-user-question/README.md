# Pi ask-user-question

Pi extension that lets the model ask one free-form question,
then blocks that model turn until the user finishes a multiline answer.

The question remains fully visible in Pi's transcript.
The answer opens in the configured editor inside a separate default-terminal window,
so Pi keeps its normal transcript controls while the answer is pending.

## Installation

Build the package,
then add its repository path to global Pi settings at `~/.pi/agent/settings.json`:

```json
{
  "packages": [
    "/var/home/user/Monochromatic/package/pi-plugin/ask-user-question"
  ]
}
```

The extension is user-specific.
Do not add it to project `.pi/settings.json`.

## Tool

The extension registers `ask_user_question` with one parameter:

```ts
ask_user_question({
  question: string,
})
```

The complete question is rendered in the Pi transcript without a line-count preview.
The tool is sequential,
so Pi does not open competing answer windows for sibling calls.

The tool works only in interactive TUI mode.
RPC,
JSON,
and print modes receive an unavailable-tool error rather than opening a desktop terminal.

## Answer workflow

The extension resolves the preferred terminal through
`@monochromatic-dev/cli-terminal-exec`.
It resolves the editor in this order:

1. `$VISUAL`
2. `$EDITOR`
3. `notepad.exe` on Windows or `vi` elsewhere

The editor command must remain attached until editing finishes.
For graphical editors,
configure a wait flag such as `code --wait` in `$VISUAL` or `$EDITOR`.

The editor opens an empty,
answer-only UTF-8 file.
The question stays in Pi,
where scrolling,
search,
tool expansion,
selection,
copying,
and links remain available.

Save and exit to submit.
In Helix,
Vim,
and Neovim,
use `:wq`.
The launched terminal title also carries the `:wq` reminder.

An empty or whitespace-only file cancels.
A nonzero editor exit,
a closed answer terminal,
or a disconnected helper also cancels.
The returned answer removes at most one final `\n` or `\r\n` added by the editor.
Every other character and line break is preserved.

Answers are ordinary,
non-secret model input.
Do not enter passwords,
tokens,
or credentials.

## Blocking and cleanup

A private request file transfers a random channel token and loopback endpoint to the detached helper.
The helper authenticates immediately,
then keeps the channel open for the editor lifetime.
The Pi tool awaits that channel,
which blocks the model without taking input focus from the original Pi terminal.

A connection-start deadline detects a terminal that starts without running the helper.
There is no editing deadline after authentication.
Aborting the tool or shutting down the session closes the channel and removes its answer workspace.

Long answers follow Pi's tool-output limits.
The visible result is truncated when needed,
and the complete answer is retained in a private temporary file whose path is returned to the model.

## Validation

Run package validation from the repository root:

```sh
cd package/pi-plugin/ask-user-question
mise run build
mise run test:unit
mise run lint
mise run verify:extension
```

End-to-end verification must also call the installed tool from a fresh interactive Pi session,
inspect the transcript while the editor remains open,
then exercise `:wq`,
empty cancellation,
and an overflowing question.
