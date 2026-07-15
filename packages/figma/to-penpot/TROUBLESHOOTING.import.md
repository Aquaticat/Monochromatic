# Penpot Import Verification Troubleshooting

## Goal

Upload a generated `.penpot` file to a running Penpot instance at
`https://penpot.c.aquati.cat` to verify the converter output is valid.

## Files

- `/tmp/final-fig.penpot`:
   36 KB (Figma .
  fig conversion)
- `/tmp/final-deck.penpot`:
   9.7 KB (Figma .
  deck conversion)
- `/tmp/final-jam.penpot`:
   100 KB (Figma .
  jam conversion)

## Penpot instance details

- URL:
   `https://penpot.c.aquati.cat`
- Credentials:
   `an@aquati.cat` / `uhb\u201cM2Ry;B]0Mq[Fs3` (password contains a Unicode left double quotation mark U+201C)
- Team ID:
   `30932f05-8350-819c-8007-540c98666896`
- Default project ID:
   `30932f05-8350-819c-8007-540c98696800`
- Import API:
   `POST /api/main/methods/import-binfile` (FormData:
   name,
   project-id,
   version=3,
   file)
- Upload API:
   `POST /api/main/methods/create-upload-session` then `POST /api/main/methods/upload-chunk`
- Auth:
   httpOnly session cookies set by `POST /api/main/methods/login-with-password`

## Approaches tried

### 1. Penpot API login via curl/transit+json

Sent `POST /api/main/methods/login-with-password` with transit+json encoded
body `["^ ","~:email","an@aquati.cat","~:password",...]`.

**Result**:
 `400 wrong-credentials` for every password encoding variant:

- Raw ASCII double quote:
   `uhb"M2Ry;B]0Mq[Fs3`
- Unicode left double quotation mark (U+201C):
   `uhb\u201cM2Ry;B]0Mq[Fs3`
- Unicode right double quotation mark (U+201D):
   `uhb\u201dM2Ry;B]0Mq[Fs3`
- Escaped double quote:
   `uhb\"M2Ry;B]0Mq[Fs3`
- Single quote:
   `uhb'M2Ry;B]0Mq[Fs3`

**Root cause**:
 The password likely contains a Unicode smart quote that gets
mangled in transit encoding,
 or Penpot's password hashing does not match the
raw bytes sent.
 The browseros browser IS logged in (get-profile returns the
real profile),
 so the credentials work in the UI.

**Possible fix**:
 Intercept the actual login request from the browser using
CDP Network.
requestWillBeSent to capture the exact transit-encoded body that
the frontend sends,
 then replay it with curl.

### 2. Browser file input click

Clicked the hidden `<input type="file" accept=".penpot,.zip">` elements
found in the Penpot dashboard DOM.

**Result**:
 Opens the OS file chooser dialog,
 which browseros/CDP cannot
interact with programmatically.

### 3. browseros_upload_file with search_dom node IDs

Found file inputs via `browseros_search_dom` (node IDs 52 and 63),
 then
called `browseros_upload_file` with those IDs.

**Result**:
 `CDP error: Node is not a file input element`.

**Root cause**:
 The search_dom node IDs are accessibility-tree IDs,
 not CDP
backend node IDs.
 The browseros_upload_file tool expects CDP
`DOM.backendNodeId` values,
 which are different.

**Possible fix**:
 Use CDP `DOM.getDocument` + `DOM.querySelector` to get the
actual backend node IDs,
 then call `DOM.setFileInputFiles` directly.

### 4. Drag-and-drop simulation

Attempted to construct a `DataTransfer` object with a File and dispatch
`drop` and `dragover` events on the Penpot dashboard.

**Result**:
 Browser security prevents creating `DataTransfer` with files from
JS.
 The `DataTransfer` constructor ignores `data` property;
 `items.add(file)`
requires a user-gesture context.

### 5. Fetch from localhost HTTP server

Started an HTTP server on port 8443 serving the .
penpot files,
 then tried
`fetch('http://localhost:8443/deck.penpot')` from the browser.

**Result**:
 Mixed content blocked.
 The Penpot page is served over HTTPS,
 and
`fetch()` from HTTPS to `http://localhost` is blocked by Chrome's mixed
content policy.

### 6. Fetch from HTTPS server with self-signed cert

Generated a self-signed certificate and served files via HTTPS on port 8443.

**Result**:
 Chrome blocks self-signed certificates.
 The "Proceed to localhost
(unsafe)" link on the interstitial page is not clickable via browseros.

**Possible fix**:
 Use `--ignore-certificate-errors` flag when launching Chrome,
or use mkcert to generate a locally-trusted certificate.

### 7. Base64 chunking into browser

Split the 9.7 KB file into base64 chunks (4 chunks of ~4 KB each) and loaded
them into the browser via `browseros_evaluate_script`,
 then reconstructed
with `atob()`.

**Result**:
 `atob()` fails because `+` characters in the base64 string get
URL-decoded to spaces during evaluate_script parameter passing.
 One `+` sign
in the base64 output causes a corrupted string.

**Possible fix**:
 Use hex encoding instead of base64 (only 0-9,
 a-f chars),
or URL-encode the base64 string before passing to evaluate_script.

### 8. Hex chunking into browser (via browseros_evaluate_script)

Split the file as hex (19,392 chars = 5 chunks of ~4 KB).
 Successfully
loaded chunk 0 (4,000 chars confirmed).
 Started loading chunk 1.

**Result**:
 Partially successful but slow;
 each 4 KB chunk requires a
separate evaluate_script call,
 and the full upload JS (reconstruct blob,
create FormData,
 fetch) still needs the auth cookies to be present.

### 9. CDP Runtime.evaluate for file upload

Used Python + websockets to connect to the Chrome DevTools Protocol port
(45221) directly.
 Loaded hex chunks via `Runtime.evaluate`,
 then called
fetch with `credentials: 'include'`.

**Result**:
 `401 authentication-required`.
 The CDP `Runtime.evaluate`
context does not have the Penpot session cookies,
 even with
`credentials: 'include'`.
 The `get-profile` API returns "Anonymous User"
instead of the real profile.

**Root cause**:
 The browseros browser is a Playwright-managed Chrome with
`--remote-debugging-port=0`.
 The CDP target shows the URL as
`#/auth/login` (the initial load URL) even though the page has been
navigated to the dashboard via hash routing.
 The session cookies are
set but invisible to CDP's `Network.getCookies` and
`Network.getAllCookies` (returns 0 cookies).
 Browseros's
`evaluate_script` somehow has access to the authenticated session,
 but
CDP `Runtime.evaluate` does not.

**Hypothesis**:
 browseros may use Playwright's `page.evaluate()` which
runs in the page's main world with the correct cookie jar.
 CDP's
`Runtime.evaluate` with the default execution context may be running in
a different world or the cookies are partitioned (Chrome's
partitioned cookies / CHIPS feature) and only accessible from the
page's own JS context.

**Possible fix**:
 Use CDP's `Runtime.evaluate` with the correct
`executionContextId` that matches the page's main world.
 Find the
context that has the auth cookies by testing `get-profile` in each
context.
 Or use Playwright directly instead of raw CDP.

### 10. Agent-browser upload

Attempted to use the `agent-browser` CLI's `upload` command to set files
on the Penpot file input.

**Result**:
 Agent-browser opened a new tab and showed the login page
(unauthenticated).
 The `--auto-connect` and `--cdp` flags connected to
the Chrome instance,
 but agent-browser's accessibility snapshot shows
the login page (stale URL),
 and logging in with the password also
failed (same wrong-credentials issue as curl).

## Summary of blockers

1. **No authenticated API access outside browseros**:
    Transit+json login
   fails with wrong-credentials for all password encodings tried.

2. **No binary data transfer into browseros**:
    The browseros
   evaluate_script tool can't reliably transfer binary or base64 data
   (special chars get mangled).
    Hex encoding works but is verbose.

3. **CDP context lacks auth cookies**:
    Raw CDP Runtime.
   evaluate runs in
   an unauthenticated context,
    even with `credentials: 'include'` on
   fetch.
    The session cookies are invisible to CDP.

4. **No CDP file input support**:
    browseros_upload_file expects CDP
   backend node IDs that don't match search_dom node IDs.
    Direct
   `DOM.setFileInputFiles` via CDP is the right approach but needs the
   correct backend node ID.

## Recommended next steps

### Option A: CDP setFileInputFiles (most promising)

1. Use CDP `DOM.getDocument` to get the root node
2. Use CDP `DOM.querySelector` with selector `input[type=file]` to get
   the backend node ID
3. Use CDP `DOM.setFileInputFiles` with the backend node ID and the
   .
   penpot file path
4. This triggers the file input's change event,
    which Penpot's
   ClojureScript handler picks up for import

This bypasses all cookie/auth issues because the file input handler
runs in the page's own JS context.

### Option B: Playwright direct

1. Use Playwright's `page.setInputFiles()` method directly
2. This is the canonical way to set files on file inputs in Playwright
3. The browseros tool wraps Playwright but doesn't expose setInputFiles
4. Could write a small Playwright script that connects to the existing
   browser via `browser.connectOverCDP()`

### Option C: Intercept and replay login

1. Navigate to Penpot login page in a CDP-controlled browser
2. Use CDP `Network.requestWillBeSent` to intercept the login request
3. Type credentials via CDP Input.
   dispatchKeyEvent or DOM.
   focus + type
4. Capture the exact transit-encoded request body the frontend sends
5. Use curl with the captured cookies for subsequent API calls

### Option D: Hex loading via browseros + fetch upload

1. Load the .
   penpot file as hex via browseros_evaluate_script (5 calls
   of 4 KB each for the deck file)
2. Reconstruct as Uint8Array in the browser
3. Create a Blob and File from the Uint8Array
4. Call `fetch('/api/main/methods/import-binfile', ...)` from
   browseros_evaluate_script (this IS authenticated unlike CDP)
5. This approach was partially implemented:
    hex loading works,
   but the full upload JS was not yet tested

## Structural verification (completed)

Despite not completing the browser import,
 the converter output was
structurally verified against a reference Penpot file (Teto.
penpot,
1,934 entries,
 Penpot 2.14.3 export).
 See the Verification section
in `packages/figma/to-penpot/README.md` for details.
