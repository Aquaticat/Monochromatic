# Plan: generate WireGuard AllowedIPs

Status:
 implementation-ready specification.
 Recovered from Pi session `019fa835-e9e8-7523-9746-e9b7a0305a84` and simplified on 2026-07-28.
 Implementation has not started.

## Goal

Build `wg-allowedips`, a CLI that computes a WireGuard `AllowedIPs` value from an allowed set and a disallowed
set:

```text
result = union(allowed) − union(disallowed)
```

Both sets may contain IPv4 addresses, IPv6 addresses, or CIDR blocks.
A domain contributes every IPv4 and IPv6 address returned for it by the operating system resolver during that
run.

The tool must preserve this direct set model.
It must not infer `0.0.0.0/0` or `::/0` from a disallowed entry.

## Package and command

Create:

- package path: `package/cli/wg-allowedips`;
- package name: `@monochromatic-dev/cli-wg-allowedips`;
- executable: `wg-allowedips`.

The command contract is:

```text
wg-allowedips --allowed <path> --disallowed <path>
```

Both flags are required.
An empty disallowed file represents an empty set.
Do not add short aliases, positional input, interactive prompts, or alternate output modes.

Use `cidr-tools` through the pnpm catalog.
Its `excludeCidr` operation already unions, subtracts, minimizes, and sorts IPv4 and IPv6 networks, so the CLI
must not build a second merge or interval layer around it.

## Input format

Each file is plain text with one entry per line.
For each line:

1. Trim surrounding whitespace.
2. Skip it when the result is empty or starts with `#`.
3. Treat a valid IP literal as one host address.
4. Treat an entry containing `/` as a CIDR block.
5. Treat any other entry as a domain for name resolution.

A range means a CIDR block such as `10.0.0.0/8`.
Start-to-end syntax such as `10.0.0.1-10.0.0.20` is unsupported.
Comments occupy their whole trimmed line; inline comments are unsupported.

Resolve domains with `lookup` from `node:dns/promises` and `{ all: true }`.
This deliberately follows the operating system's name-resolution behavior, including hosts-file and
split-horizon results.
Use every address the operating system returns and treat each as a host route.
The generated result is a point-in-time snapshot.

Do not add DNS caching, deduplication machinery, retries, backoff, TTL handling, or resolver configuration.

## Processing and output

After parsing and resolving both files:

1. Fail when the allowed set is empty.
2. Pass both sets directly to `excludeCidr`.
3. Join a nonempty result with `, ` and write one newline-terminated line to stdout.
4. Write nothing to stdout when the result is empty.

Example:

```text
# allowed.txt
10.0.0.0/8
2001:db8::/126
```

```text
# disallowed.txt
10.0.0.0/9
2001:db8::/127
```

```console
$ wg-allowedips --allowed allowed.txt --disallowed disallowed.txt
10.128.0.0/9, 2001:db8::2/127
```

The output is only the value.
It does not include `AllowedIPs =`.

## Failure behavior

A missing flag, unreadable file, malformed CIDR, or failed domain lookup must make the command fail nonzero
before it writes a result.
Let filesystem, argument-parser, CIDR-parser, and resolver failures retain their useful path or input context.
Do not add retry loops, custom line-number diagnostics, or a separate exit-code taxonomy.

Set arithmetic needs no special-case diagnostics:

- duplicate and overlapping allowed entries merge naturally;
- a disallowed entry outside the allowed set is a no-op;
- partial overlap subtracts only the intersection;
- an empty disallowed set returns the minimized allowed set without a warning;
- complete subtraction succeeds with empty stdout.

## Non-goals

Do not add:

- WireGuard or `wg-quick` configuration editing;
- non-portable `!` exclusion syntax;
- an implicit full-tunnel universe;
- arbitrary start-to-end address ranges;
- warnings for duplicates, overlap, cancellation, or no-op exclusions;
- persistent state, network watching, or automatic regeneration;
- JSON, TOML, or multiple output formats.

## Completion criteria

The package is complete only when it has its normal repository scaffolding, `README.md`, license material, zero
lint findings, and passing tests.
Tests must cover:

- IPv4 and IPv6 union and subtraction;
- individual IPs becoming host routes;
- domain results entering the correct set;
- blank and comment lines;
- duplicate, overlapping, partial-overlap, and out-of-set inputs through ordinary set arithmetic;
- empty allowed, empty disallowed, and empty result behavior;
- malformed CIDR, failed lookup, missing flag, and missing file failures;
- exact stdout formatting.

Verification must pass the package's `lint`, `lint:types`, `test:unit`, and `build` mise tasks.
Finally, invoke the built `wg-allowedips` executable against disposable input files and verify its stdout and
exit status.

## API references

- [`cidr-tools` API][cidr-tools]
- [Node.js operating-system lookup API][node-lookup]

[cidr-tools]: https://github.com/silverwind/cidr-tools#api
[node-lookup]: https://nodejs.org/api/dns.html#dnspromiseslookuphostname-options
