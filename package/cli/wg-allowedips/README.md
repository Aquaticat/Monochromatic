# wg-allowedips

Generate the comma-separated value for a WireGuard `AllowedIPs` setting from allowed and disallowed address sets.
The command computes:

```text
union(allowed) − union(disallowed)
```

It does not infer a full-tunnel universe from disallowed entries.

## Usage

```console
$ wg-allowedips --allowed allowed.txt --disallowed disallowed.txt
10.128.0.0/9, 2001:db8::2/127
```

Both long options are required.
The command accepts no positional inputs or short aliases.
Its stdout contains only the value,
not `AllowedIPs =`.

## Input files

Each file contains one entry per line.
An entry can be:

- an IPv4 address;
- an IPv6 address;
- an IPv4 CIDR block;
- an IPv6 CIDR block;
- a domain.

Surrounding whitespace is trimmed.
Blank lines and trimmed lines beginning with `#` are skipped.
Comments must occupy the whole line;
inline comments are not supported.

A range means a CIDR block such as `10.0.0.0/8`.
Start-to-end syntax is unsupported.

Example allowed file:

```text
# Private IPv4
10.0.0.0/8

# Documentation IPv6 range
2001:db8::/126
```

Example disallowed file:

```text
10.0.0.0/9
2001:db8::/127
```

## Domains

Each domain is resolved once for that input entry through Node's operating-system lookup with `{ all: true }`.
Every returned IPv4 and IPv6 address contributes one host route.
Results therefore reflect hosts-file,
split-horizon,
and other operating-system resolution behavior at that moment.

The command does not add DNS caching,
retries,
TTL handling,
or resolver configuration.
A lookup failure fails the command before it writes a result.

## Output

The result is a minimized,
sorted set of explicit CIDRs joined by `, ` and terminated by one newline.
Individual IPv4 and IPv6 addresses become `/32` and `/128` routes.

Complete subtraction succeeds and writes nothing to stdout.
An empty disallowed file returns the minimized allowed set.
An allowed file that contributes no addresses is an error.

## Validation

CIDR syntax is parsed by `cidr-tools`.
The command separately validates the original address text with Node's `isIP` and rejects prefixes above 32 for
IPv4 or 128 for IPv6.

Missing options,
unreadable files,
invalid CIDRs,
invalid family bounds,
and resolver failures propagate as command failures.
The command does not add warning or exit-code taxonomies.

## Development

Run package checks through mise:

```console
mise run //package/cli/wg-allowedips:lint
mise run //package/cli/wg-allowedips:lint:types
mise run //package/cli/wg-allowedips:test:unit
mise run //package/cli/wg-allowedips:build
```

`buildAndTest` rebuilds the consumed artifacts before running unit and built-CLI tests:

```console
mise run //package/cli/wg-allowedips:buildAndTest
```
