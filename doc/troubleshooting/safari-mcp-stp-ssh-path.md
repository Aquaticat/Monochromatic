# Safari Technology Preview 247 MCP over SSH: bare `safaridriver --mcp` resolves to system Safari and pi reports `Connection closed`

Tool under test: Safari Technology Preview 247 (`22625.1.22.19.1`) on `m1`, launched through pi's stdio MCP
transport over SSH. Surface trigger: `~/.pi/agent/mcp.json` configured `ssh m1 "safaridriver --mcp"`. Failure mode:
pi's MCP gateway reports `MCP error -32000: Connection closed` because the remote command exits before speaking MCP.

## Symptom

The pi MCP gateway sees the server name but cannot connect:

```text
Server "safari-mcp-stp" is configured but not connected.
Failed to connect to "safari-mcp-stp": MCP error -32000: Connection closed
```

Running the configured command directly reproduces the same failure. The remote shell resolves `safaridriver` to the
system Safari binary, which does not support `--mcp`:

```bash
# /var/home/user/Monochromatic
ssh -o BatchMode=yes -o ConnectTimeout=5 m1 'command -v safaridriver; safaridriver --mcp'
```

```text
/usr/bin/safaridriver
safaridriver: unrecognized option `--mcp'
```

## Root cause

The command in pi's MCP config relied on `PATH` resolution inside a non-interactive SSH command:

```json
{
  "type": "stdio",
  "command": "ssh",
  "args": ["-o", "BatchMode=yes", "-o", "ConnectTimeout=5", "m1", "safaridriver --mcp"]
}
```

On `m1`, that command finds `/usr/bin/safaridriver`, which is the system Safari driver. The `--mcp` option is only
present on the Safari Technology Preview driver in this setup:

```bash
# /var/home/user/Monochromatic
ssh -o BatchMode=yes -o ConnectTimeout=5 m1 \
  '"/Applications/Safari Technology Preview.app/Contents/MacOS/safaridriver" --help | grep -- --mcp'
```

```text
	--mcp                     Run as an MCP (Model Context Protocol) server using stdio
```

WebKit's setup instructions also use the full Safari Technology Preview path for generic MCP configs:

```json
"safari-mcp-stp": {
  "command": "/Applications/Safari Technology Preview.app/Contents/MacOS/safaridriver",
  "args": ["--mcp"]
}
```

Because the wrong binary exits with code 1 after printing usage text, the stdio MCP handshake never begins. The pi
MCP gateway then surfaces the child process exit as `Connection closed`.

## Verification

Version under test:

```bash
# /var/home/user/Monochromatic
ssh -o BatchMode=yes -o ConnectTimeout=5 m1 \
  '"/Applications/Safari Technology Preview.app/Contents/MacOS/safaridriver" --version'
```

```text
Included with Safari Technology Preview (Release 247, 22625.1.22.19.1)
```

A direct JSON-RPC handshake over the fixed SSH command returns the Safari MCP server info and tool list:

```bash
# /var/home/user/Monochromatic
python - <<'PY'
import json
import subprocess

process = subprocess.Popen(
    [
        'ssh',
        '-o', 'BatchMode=yes',
        '-o', 'ConnectTimeout=5',
        'm1',
        '"/Applications/Safari Technology Preview.app/Contents/MacOS/safaridriver" --mcp',
    ],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    text=True,
)
process.stdin.write(json.dumps({
    'jsonrpc': '2.0',
    'id': 1,
    'method': 'initialize',
    'params': {
        'protocolVersion': '2024-11-05',
        'capabilities': {},
        'clientInfo': {'name': 'pi-debug', 'version': '0'},
    },
}) + '\n')
process.stdin.write(json.dumps({'jsonrpc': '2.0', 'method': 'notifications/initialized', 'params': {}}) + '\n')
process.stdin.write(json.dumps({'jsonrpc': '2.0', 'id': 2, 'method': 'tools/list', 'params': {}}) + '\n')
process.stdin.flush()
print(process.stdout.readline())
print(process.stdout.readline()[:200])
process.terminate()
PY
```

```text
{"id":1,"jsonrpc":"2.0","result":{"capabilities":{"tools":{}},"protocolVersion":"2024-11-05","serverInfo":{"name":"Safari","version":"1.0.0"}}}
{"id":2,"jsonrpc":"2.0","result":{"tools":[{"description":"Return buffered console logs for the current or specified tab.
```

After updating `~/.pi/agent/mcp.json` to call the full STP path and restarting pi, `mcp({ connect:
"safari-mcp-stp" })` listed all `17` Safari MCP tools. A browser boundary check loaded `https://example.com` through
`navigate_to_url` and saved a PNG through `screenshot`:

```text
navigate_to_url: {"title":"Example Domain","url":"https://example.com/"}
screenshot: Saved screenshot to '/tmp/safari-mcp-stp-example.png' (79.5 kB).
```

The screenshot path is on `m1`, because the Safari MCP process runs there. Copying it back with `scp` and reading the
local copy confirmed the image shows the Example Domain page, including the `Example Domain` heading, explanatory text,
and `Learn more` link.

## Verified workarounds

Use the absolute Safari Technology Preview driver path in the SSH command:

```json
{
  "type": "stdio",
  "command": "ssh",
  "args": [
    "-o",
    "BatchMode=yes",
    "-o",
    "ConnectTimeout=5",
    "m1",
    "\"/Applications/Safari Technology Preview.app/Contents/MacOS/safaridriver\" --mcp"
  ]
}
```

Tradeoff: the config is tied to Safari Technology Preview's application bundle path. That is appropriate for MCP,
because the installed system Safari driver on `m1` lacks `--mcp`.

## What does not work

Bare `safaridriver --mcp` does not work in this SSH setup. It finds `/usr/bin/safaridriver`, not the STP driver, and
exits before the MCP server starts.

Adding an HTTP bridge or SSH port forward is unnecessary for this failure. The stdio-over-SSH transport works once the
remote command launches the STP driver.

## Upstream filing decision

No upstream issue should be filed. This was local wiring, not an Apple or WebKit defect.

- `.out-of-scope/` was checked on 2026-07-05; no Safari or WebKit exemption exists.
- Duplicate upstream search is intentionally skipped because the failure is caused by local MCP config resolving the
  wrong binary.
- Constraint 1, upstream fault: no. The STP binary supports `--mcp`, and WebKit's instructions use the full STP path.
- Constraint 2, upstream can fix it: no relevant upstream fix. The consumer config selected the wrong executable.
- Constraint 3, supported use case: yes. WebKit documents MCP setup for generic MCP clients.
- Constraint 4, contribution welcome: not evaluated beyond WebKit's published bug-report link, because constraint 1
  fails.
- Constraint 5, likely fix: not applicable, because no upstream fix is needed.
- Constraint 6, minimal fix prototyped: yes, at the consumer boundary. Updating pi's MCP config to the STP path made
  `tools/list`, navigation, and screenshot capture work.

Upstream filing artifact: nothing to file.
