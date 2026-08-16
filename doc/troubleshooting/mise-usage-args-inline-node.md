# Mise usage arguments are not Node eval process arguments

## Symptom

A mise task declares variadic usage arguments,
but its inline Node runner receives no arguments.
The nested compositor then emits:

```txt
Error: parsing command-line arguments
Caused by:
    no client command given
```

The affected invocation supplied compositor and child arguments after `--`,
but `//package/cli/nested-wayland-session:run` launched its release executable with an empty array.

## Cause

Mise's usage parser stores declared task arguments in `usage_args`.
For a task shell such as:

```toml
shell = "node --input-type=module-typescript -e"
```

those values are not ordinary trailing entries in Node's `process.argv`.
Reading `process.argv.slice(1)` therefore produced an empty list in the observed task.

The root `mise.toml` already provides `vars.parse_usage_args` because `usage_args` is shell-encoded.
Splitting that string on spaces would corrupt quoted paths and arguments.

## Fix

Interpolate the shared parser and read mise's environment value:

```toml
run = """
{{vars.cargo_dispatch}}
{{vars.parse_usage_args}}
runCargo(['build', '--release'])
const args = parseUsageArgs(process.env.usage_args ?? '')
execFileSync('./target/release/monochromatic-nested-wayland-session', args, { stdio: 'inherit' })
"""
```

This preserves spaces,
quotes,
backslashes,
and empty arguments according to the repository's shared task encoding.

## Verification

Invoke the actual task with arguments that must reach the executable:

```sh
mise run //package/cli/nested-wayland-session:run -- \
  --socket /tmp/nested.sock \
  --color-scheme dark \
  -- app
```

The compositor must parse the socket,
start its private appearance portal,
and launch `app` rather than reporting that no client command was given.
