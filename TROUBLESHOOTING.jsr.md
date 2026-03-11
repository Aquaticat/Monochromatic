# JSR registry troubleshooting

## `bun install` fails with 502 for all JSR packages

### Symptoms

```
error: GET https://npm.jsr.io/@jsr%2fzod__zod - 502
error: zod@catalog: failed to resolve
```

Every JSR-hosted package (`@logtape/*`, `@optique/*`, `@cspotcode/outdent`, `zod`) fails with 502 Bad Gateway.
Non-JSR packages resolve fine.
`curl https://npm.jsr.io/@jsr/zod__zod` returns 200.

### Root cause

JSR's npm compatibility layer (Cloudflare edge) returns **502 Bad Gateway** when the request includes an `If-None-Match` header,
regardless of whether the etag is valid, stale, or garbage.
Bun sends `If-None-Match` from its local HTTP cache (`~/.bun/install/cache/`).
`curl` does not send conditional headers by default, which is why manual requests succeed.

Per RFC 9110 Section 13.1.2, the server must return 304 (match) or 200 (no match).
502 is never a valid response to a conditional GET.

Tracked upstream: [jsr-io/jsr#1323](https://github.com/jsr-io/jsr/issues/1323)

### Workaround

Clear bun's HTTP cache so it stops sending the cached etags:

```sh
bun pm cache rm
bun install
```

Or use the mise task:

```sh
mise run fix:jsr
```

### Verification

Confirm the bug is still active:

```sh
curl -s -o /dev/null -w "%{http_code}" \
  -H 'If-None-Match: "any-value"' \
  "https://npm.jsr.io/@jsr/zod__zod"
```

If this returns **502**, the JSR bug is still present.
If it returns **200** or **304**, the upstream fix has landed and the workaround is no longer needed.
