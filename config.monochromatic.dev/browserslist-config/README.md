# browserslist-config

For use in both frontend web projects and small utilities for Node.js.

No `example..browserslistrc` needed.
Just add

```json
"browserslist": [
  "extends @monochromatic.dev/browserslist-config"
]
```

in `package.json`.

## Update

Entry in package.json not working for some reason.
Keeps returning empty list.

Copy `.browserslistrc` manually

**OR**

Add this to `cpfd.toml`

```toml
'\.browserslistrc' = true
```

and do not add `browserslist` field in `package.json`.
