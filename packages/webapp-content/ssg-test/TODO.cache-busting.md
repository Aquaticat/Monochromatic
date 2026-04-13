# Cache busting via content-hashed filenames

Static assets in `dist/` need content hashes appended to their filenames
(e.g. `styles.a1b2c3.css`) so that `Cache-Control: immutable` can be used safely.

Without hashed filenames, long `max-age` risks serving stale assets after deploys.
Currently Caddy serves assets with no `Cache-Control` header at all.

## Scope

- CSS (`styles.css`)
- Client JS (`index.js`)
- Any other static assets referenced by HTML

HTML documents themselves should not be hashed (they're the entry point),
but should use short TTL or `no-cache` with ETag revalidation.
