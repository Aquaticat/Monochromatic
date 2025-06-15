## Half working

### Github mcp server configuration

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
