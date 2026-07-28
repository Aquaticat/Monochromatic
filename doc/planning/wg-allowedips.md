# Plan: generate WireGuard AllowedIPs

Status:
 implementation-ready specification.
 Recovered from Pi session `019fa835-e9e8-7523-9746-e9b7a0305a84` and simplified on 2026-07-28.
 Implementation has not started.

## Goal

The `wg-allowedips` CLI computes a WireGuard `AllowedIPs` value from an allowed set and a disallowed set:

```text
result = union(allowed) − union(disallowed)
```

Each set may contain:

- IPv4 addresses;
- IPv6 addresses;
- IPv4 CIDR blocks;
- IPv6 CIDR blocks;
- domains.

A domain contributes every address returned for it by the operating system resolver during that run.
The tool must preserve this direct set model.
It must not infer `0.0.0.0/0` or `::/0` from a disallowed entry.

## Package and command

Create the package with these identities:

- Path is `package/cli/wg-allowedips`.
- Package name is `@monochromatic-dev/cli-wg-allowedips`.
- Executable name is `wg-allowedips`.

The command contract is:

```text
wg-allowedips --allowed <path> --disallowed <path>
```

Both flags are required.
An empty disallowed file represents an empty set.
Do not add short aliases or positional input.
Do not add interactive prompts or alternate output modes.

Use `cidr-tools` through the pnpm catalog.
Call its `excludeCidr` operation directly.
The operation unions both inputs before subtraction and returns a minimized sorted set of IPv4 and IPv6
networks.
Do not build another merge or interval layer around it.

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
Comments occupy a whole trimmed line.
Inline comments are unsupported.

Resolve domains with `lookup` from `node:dns/promises` and `{ all: true }`.
This follows the operating system's name-resolution behavior.
That behavior includes hosts-file and split-horizon results.
Use every returned address as a host route.
The generated result is a point-in-time snapshot.

Do not add:

- DNS caching;
- domain deduplication machinery;
- retries or backoff;
- TTL handling;
- resolver configuration.

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

These conditions must fail the command before it writes a result:

- a required flag is missing;
- an input file cannot be read;
- a CIDR parser rejects an entry;
- a domain lookup fails.

Preserve useful input or path context from the argument parser and filesystem.
Preserve the same context from the CIDR parser and resolver.
Do not add retry loops or custom line-number diagnostics.
Do not add a separate exit-code taxonomy.

Set arithmetic needs no special diagnostics:

- Duplicate and overlapping allowed entries merge naturally.
- A disallowed entry outside the allowed set is a no-op.
- Partial overlap subtracts only the intersection.
- An empty disallowed set returns the minimized allowed set without a warning.
- Complete subtraction succeeds with empty stdout.

## Non-goals

Do not add:

- WireGuard or `wg-quick` configuration editing;
- non-portable `!` exclusion syntax;
- an implicit full-tunnel universe;
- arbitrary start-to-end address ranges;
- warnings for duplicates or overlap;
- warnings for cancellation or no-op exclusions;
- persistent state or network watching;
- automatic regeneration;
- JSON or TOML input;
- multiple output formats.

## Completion criteria

The package must include:

- normal repository scaffolding;
- `README.md`;
- license material;
- tests for every exported code path.

Tests must cover:

- IPv4 union and subtraction;
- IPv6 union and subtraction;
- individual IPs becoming host routes;
- domain results entering the correct set;
- blank and comment lines;
- duplicate and overlapping inputs;
- partial-overlap and out-of-set inputs;
- empty allowed behavior;
- empty disallowed behavior;
- empty result behavior;
- CIDR parser failure;
- lookup failure;
- missing flag and missing file failures;
- exact stdout formatting.

These package tasks must pass with zero lint findings:

- `lint`;
- `lint:types`;
- `test:unit`;
- `build`.

Finally invoke the built `wg-allowedips` executable against disposable input files.
Verify its stdout and exit status.

## API references

- [`cidr-tools` API][cidr-tools]
- [Node.js operating-system lookup API][node-lookup]

[cidr-tools]: https://github.com/silverwind/cidr-tools#api
[node-lookup]: https://nodejs.org/api/dns.html#dnspromiseslookuphostname-options
