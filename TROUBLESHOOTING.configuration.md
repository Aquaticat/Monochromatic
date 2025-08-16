# Configuration Snippets & Examples

## GitHub MCP Server Configuration (Half Working)

```json
"github.com/github/github-mcp-server": {
"autoApprove": [
"get_me"
],

"disabled": false,
"timeout": 60,
"type": "stdio",
"command": "podman",
"args": [
"--remote=true",
"--url",
"ssh://core@127.0.0.1:62090/run/user/1000/podman/podman.sock",
"--identity",
"C:\\Users\\user\\.local\\share\\containers\\podman\\machine\\machine",
"run",
"-i",
"--rm",
"-e",
"GITHUB_PERSONAL_ACCESS_TOKEN",
"ghcr.io/github/github-mcp-server"
],
"env": {
"GITHUB_PERSONAL_ACCESS_TOKEN": "REDACTED"
}
}
```

## Building Caddy with Extensions

```bash
./xcaddy build --with github.com/mholt/caddy-events-exec --with github.com/mholt/caddy-webdav --with github.com/mholt/caddy-l4 --with github.com/porech/caddy-maxmind-geolocation --with github.com/mholt/caddy-ratelimit --with github.com/caddyserver/cache-handler --with github.com/caddyserver/jsonc-adapter --with github.com/caddy-dns/porkbun --with github.com/caddy-dns/njalla