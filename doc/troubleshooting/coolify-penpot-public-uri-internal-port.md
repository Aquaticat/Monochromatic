# Coolify Penpot 2.17.2 port-suffixed public URI sends browser API requests to unreachable port 8080

A Penpot frontend behind an HTTPS reverse proxy can load its initial page but time out on API requests
when `PENPOT_PUBLIC_URI` contains Penpot's internal container port.
The internal listener and browser-facing origin are different values:
Coolify's port-specific frontend declaration identifies container port `8080`,
but the browser must use `https://penpot.c.aquati.cat` on standard HTTPS port `443`.

Investigated on 2026-09-03.

## Symptom

The browser console reports:

```text
:8080/api/main/methods/get-enabled-flags:1 Failed to load resource: net::ERR_CONNECTION_TIMED_OUT
logging.cljc:294 WRN [app.main.repo] hint="retrying request", attempt=1, delay=1000, error="Failed to fetch"
```

Penpot's startup log identifies the unexpected origin:

```text
public-uri="https://penpot.c.aquati.cat:8080/"
```

The deployed frontend configuration confirms this is not only a stale browser value:

```javascript
var penpotPublicURI = "https://penpot.c.aquati.cat:8080";
```

The initial page still loads through standard HTTPS,
and its response contains `Via: 1.1 Caddy`.
API requests fail after Penpot JavaScript constructs their URLs from the injected public URI.
This evidence makes Caddy an unlikely cause of the observed `:8080` request,
but it does not rule out an independent Caddy configuration or caching issue.

## Root cause

### Coolify distinguishes the external base URL from its port-suffixed value

Current Coolify source creates a base `SERVICE_URL_<SERVICE>` without a port at
[`bootstrap/helpers/services.php:350-381`][coolify-base-url]:

```php
$urlValue = getFqdnWithoutPort($firstFqdn);
$fqdnValue = getHostWithoutPort($firstFqdn);

$resource->service->environment_variables()->updateOrCreate([
    'key' => "SERVICE_URL_{$serviceName}",
], [
    'value' => $urlValue,
]);
```

It separately appends each internal-port suffix to the generated value at
[`bootstrap/helpers/services.php:383-409`][coolify-port-url]:

```php
foreach ($allPorts as $portNum) {
    $urlWithPort = $urlValue.':'.$portNum;

    $resource->service->environment_variables()->updateOrCreate([
        'key' => "SERVICE_URL_{$serviceName}_{$portNum}",
    ], [
        'value' => $urlWithPort,
    ]);
}
```

For this service,
`SERVICE_URL_FRONTEND` represents `https://penpot.c.aquati.cat`,
while `SERVICE_URL_FRONTEND_8080` represents `https://penpot.c.aquati.cat:8080`.
The standalone `SERVICE_URL_FRONTEND_8080` declaration is still needed
to tell Coolify which container port to route to.
It is not the correct value for Penpot's browser-facing public URI.

Coolify's current Penpot template keeps that routing declaration at
[`templates/compose/penpot.yaml:18-20`][coolify-template-frontend],
but also assigns the port-suffixed URL to backend and exporter `PENPOT_PUBLIC_URI` at
[`templates/compose/penpot.yaml:37-41`][coolify-template-backend] and
[`templates/compose/penpot.yaml:64-68`][coolify-template-exporter]:

```yaml
frontend:
  environment:
    - SERVICE_URL_FRONTEND_8080

penpot-backend:
  environment:
    - PENPOT_PUBLIC_URI=$SERVICE_URL_FRONTEND_8080

penpot-exporter:
  environment:
    - PENPOT_PUBLIC_URI=$SERVICE_URL_FRONTEND_8080
```

The current template does not assign `PENPOT_PUBLIC_URI` to the frontend.
The live source or deployable Compose must therefore be inspected to locate the frontend assignment that produced the
observed `config.js`.
Do not infer its exact stored expression from the public response alone.

### Penpot writes the environment value into browser configuration

Penpot `2.17.2` frontend startup appends a non-empty `PENPOT_PUBLIC_URI` directly to `config.js` at
[`docker/images/files/nginx-entrypoint.sh:27-48`][penpot-entrypoint]:

```bash
if [ -n "$PENPOT_PUBLIC_URI" ]; then
    echo "var penpotPublicURI = \"$PENPOT_PUBLIC_URI\";" >> "$1";
fi

update_flags /var/www/app/js/config.js
```

The frontend then prefers that global over the browser's actual origin at
[`frontend/src/app/config.cljs:175-183`][penpot-public-uri]:

```clojure
(def public-uri
  (normalize-uri (or (obj/get global "penpotPublicURI")
                     (obj/get location "origin"))))
```

A configured value therefore overrides the otherwise-correct `https://penpot.c.aquati.cat` browser origin.
The API repository joins requests onto that value at
[`frontend/src/app/main/repo.cljs:173-195`][penpot-api-uri]:

```clojure
(let [id     (or rename-to id)
      nid    (name id)
      method (cond
               (= query-params :all)  :get
               (str/starts-with? nid "get-") :get
               :else :post)
      request
      {:method method
       :uri (u/join cf/public-uri "api/main/methods/" nid)
       :credentials "include"}]
```

This call chain produces the observed request to external port `8080`.
The effective Caddy upstream was not captured.
Regardless of that upstream,
a browser request to external port `8080` does not use the working standard HTTPS origin.

The statement that this worked before does not identify which configuration changed.
Two source-supported possibilities are that the prior frontend omitted `PENPOT_PUBLIC_URI` and fell back to
`location.origin`,
or that it received the unsuffixed base URL.
The previous source and deployable Compose are needed to distinguish them.

## Verification

### Versions and source under test

- Live endpoint `https://penpot.c.aquati.cat`,
   probed on 2026-09-03.
- Published image `penpotapp/frontend:2.17.2`.
- Penpot tag `2.17.2`,
   commit `1d2c37e52c733f74017d90b0fd1ae2d074a5c33d`.
- Coolify commit `b8866b87e8e855e041c21330352ca615521afed3`.

### Live failure probe

```bash
for attempt in 1 2 3; do
  curl --fail --silent --show-error https://penpot.c.aquati.cat/js/config.js \
    | grep --fixed-strings 'var penpotPublicURI'
done

curl --silent --show-error --output /dev/null \
  --write-out 'status=%{http_code} remote_port=%{remote_port}\n' \
  https://penpot.c.aquati.cat/api/main/methods/get-enabled-flags

curl --silent --show-error --connect-timeout 5 --max-time 8 --output /dev/null \
  --write-out 'status=%{http_code} remote_port=%{remote_port} error=%{errormsg}\n' \
  https://penpot.c.aquati.cat:8080/api/main/methods/get-enabled-flags
```

Observed output:

```text
var penpotPublicURI = "https://penpot.c.aquati.cat:8080";
var penpotPublicURI = "https://penpot.c.aquati.cat:8080";
var penpotPublicURI = "https://penpot.c.aquati.cat:8080";
status=401 remote_port=443
status=000 remote_port=-1 error=Connection timed out after 5000 milliseconds
```

Status `401` proves that the standard HTTPS route returns an immediate HTTP response through Caddy.
The response body was not captured,
so status alone does not prove which component emitted it.
The timeout on external port `8080` reproduces the browser's network failure.

### Corrected frontend probe

A disposable `penpotapp/frontend:2.17.2` container was limited to one CPU and `512` MiB memory.
It received `PENPOT_PUBLIC_URI=https://penpot.c.aquati.cat`,
and its generated endpoint returned:

```javascript
// Frontend configuration
//var penpotFlags = "";
//var penpotOIDCName = "";
var penpotPublicURI = "https://penpot.c.aquati.cat";
```

Penpot normalizes this to the expected startup value:

```text
public-uri="https://penpot.c.aquati.cat/"
```

### Configurations that work

- `PENPOT_PUBLIC_URI=https://penpot.c.aquati.cat` generated the correct frontend `config.js` in the disposable image.
- Omitting frontend `PENPOT_PUBLIC_URI` lets the cited Penpot source use the browser's `location.origin`.
- Keeping `SERVICE_URL_FRONTEND_8080` separate preserves Coolify's port-specific frontend declaration.

Current Coolify source supports `$SERVICE_URL_FRONTEND` as an unsuffixed alternative,
but that expansion has not been observed in this live service and is not in the verified catalog.

### Configurations that fail

- `PENPOT_PUBLIC_URI=$SERVICE_URL_FRONTEND_8080` produces external browser requests to port `8080`.
- `PENPOT_PUBLIC_URI=https://penpot.c.aquati.cat:8080` produces the same failure.
- Exposing only standard HTTPS while injecting either failed value leaves API requests to time out.

## Verified workarounds

### Use the literal external origin

Keep the port-specific Coolify declaration,
and set the same literal on all Penpot application components:

```yaml
services:
  frontend:
    environment:
      - SERVICE_URL_FRONTEND_8080
      - PENPOT_PUBLIC_URI=https://penpot.c.aquati.cat

  penpot-backend:
    environment:
      - PENPOT_PUBLIC_URI=https://penpot.c.aquati.cat

  penpot-exporter:
    environment:
      - PENPOT_PUBLIC_URI=https://penpot.c.aquati.cat
```

The published frontend image generated the expected browser configuration from this literal.
Penpot's release guide lists the same public value for all three components at
[`docs/technical-guide/configuration.md:313-327`][penpot-uri-guide]:

```yaml
# Backend
PENPOT_PUBLIC_URI: https://penpot.mycompany.com

# Frontend
PENPOT_PUBLIC_URI: https://penpot.mycompany.com

# Exporter
PENPOT_PUBLIC_URI: https://penpot.mycompany.com
```

Tradeoff:
this does not depend on Coolify's magic-variable behavior,
but a future domain change requires another Compose edit.
The complete live deployment remains to be verified after recreation.

### Conditionally use Coolify's unsuffixed base URL

Current Coolify source creates `SERVICE_URL_FRONTEND` without the port.
A domain-tracking alternative is:

```yaml
- PENPOT_PUBLIC_URI=$SERVICE_URL_FRONTEND
```

Tradeoff:
this tracks future domain changes,
but the user's live Coolify version and generated deployment have not yet shown that expansion.
Do not use it for immediate recovery unless **Deployable Compose** resolves it to
`https://penpot.c.aquati.cat` without `:8080` in all three components.

Both forms require container recreation so the frontend startup entrypoint regenerates `config.js`.
Neither form requires a volume mutation.
Leave Caddy unchanged for this narrow test,
then investigate it separately only if requests still fail with the corrected browser origin.

## What does not work

- **Changing Caddy's internal upstream away from port `8080`.**
  Penpot frontend listens on `8080` inside its container;
  the defect is the browser-facing origin rather than Caddy's upstream target.
- **Exposing external port `8080`.**
  This makes a noncanonical second origin reachable instead of correcting Penpot's configured public origin.
- **Removing the standalone `SERVICE_URL_FRONTEND_8080` declaration.**
  It identifies Coolify's internal target port and serves a different purpose from `PENPOT_PUBLIC_URI`.
- **Refreshing or clearing browser storage without correcting Compose.**
  Repeated command-line requests to `js/config.js` returned the wrong value.
  After correction,
  use a cache-busting query or private browser window because the response advertises a seven-day cache lifetime.
- **Editing Compose without recreating the frontend container.**
  The startup entrypoint generates `config.js` inside the container;
  an existing container does not gain a new environment from a file edit.
- **Changing PostgreSQL,
   Redis,
   or asset volumes.**
  The failure occurs before the request reaches Caddy or Penpot's backend and does not involve persistent data.

## Upstream filing artifact

### Upstream filing decision

No `.out-of-scope/` entry covers Coolify,
Penpot,
Compose public URIs,
or reverse-proxy port handling.

Tracker searches covered open and closed Coolify issues and pull requests for
`penpot public uri 8080` and `SERVICE_URL port suffix`.
Coolify issue [#4957][coolify-issue-4957] is related:
its comments discuss Penpot's frontend port change and recommend adding `:8080` to URLs,
but they do not distinguish the internal proxy target from the browser-facing public origin.
All comments were reviewed.
The measured browser failure and base-versus-suffixed source trace are additive to that thread.

The filing constraints resolve as follows:

1. **Is it really upstream's fault?**
   Not proven for the exact frontend failure.
   Current Coolify source assigns the suffixed URL to backend and exporter,
   but its template does not assign `PENPOT_PUBLIC_URI` to frontend.
   The live source or deployable Compose that injected the frontend value has not been captured.
2. **Can upstream fix it?**
   Yes.
   Coolify could use the base generated URL for Penpot public URI values
   while retaining the suffixed routing declaration.
3. **Are they supporting this use case?**
   Yes.
   Coolify ships the Penpot service template,
   and Penpot documents reverse-proxy deployment with an external public URI.
4. **Would the repo welcome our contribution?**
   Yes with disclosure.
   `CONTRIBUTING.md:221` permits verified AI-assisted contributions,
   and `.github/pull_request_template.md:25-34` requires disclosure.
5. **Will they likely fix it?**
   No refusal was found.
   Issue `#4957` and prior Penpot template changes show maintainer and contributor activity on this integration.
6. **Have we prototyped a minimal fix compatible with their architecture?**
   No upstream patch was retained because constraint 1 fails for the exact incident.
   The consumer-side Compose correction was verified against the published frontend image instead.

Do not post the following draft until the live source and deployable Compose confirm which frontend expression injected
`SERVICE_URL_FRONTEND_8080`.

### Additive comment draft (do not file as-is)

~~~md
The internal frontend port and Penpot's browser-facing public URI need separate values.

On a Penpot 2.17.2 service behind standard HTTPS,
`js/config.js` contained:

```js
var penpotPublicURI = "https://penpot.example.com:8080";
```

The page loaded through the reverse proxy,
but the browser's `get-enabled-flags` request timed out because it was sent to external port 8080.
Current Coolify source creates both `SERVICE_URL_FRONTEND` without a port and
`SERVICE_URL_FRONTEND_8080` with `:8080`.
Penpot uses `PENPOT_PUBLIC_URI` to construct browser API URLs.

The consumer-side correction is to retain `SERVICE_URL_FRONTEND_8080` as the port-specific declaration,
but pass the literal external origin as `PENPOT_PUBLIC_URI` to frontend,
backend,
and exporter.
Current Coolify source also creates an unsuffixed `SERVICE_URL_FRONTEND`,
but that expansion should be confirmed in Deployable Compose before use.

Before treating this as a current-template defect,
the affected service's source and deployable Compose should be captured:
the current template assigns the suffixed value to backend and exporter but does not set frontend
`PENPOT_PUBLIC_URI`.

AI assistance disclosure:
an AI-assisted investigation traced current Coolify and Penpot source,
repeated the live HTTP failure probe,
and verified the corrected environment against a disposable published frontend container.
A human should verify the affected live Compose before posting this comment.
~~~

[coolify-base-url]: https://github.com/coollabsio/coolify/blob/b8866b87e8e855e041c21330352ca615521afed3/bootstrap/helpers/services.php#L350-L381
[coolify-issue-4957]: https://github.com/coollabsio/coolify/issues/4957
[coolify-port-url]: https://github.com/coollabsio/coolify/blob/b8866b87e8e855e041c21330352ca615521afed3/bootstrap/helpers/services.php#L383-L409
[coolify-template-backend]: https://github.com/coollabsio/coolify/blob/b8866b87e8e855e041c21330352ca615521afed3/templates/compose/penpot.yaml#L37-L41
[coolify-template-exporter]: https://github.com/coollabsio/coolify/blob/b8866b87e8e855e041c21330352ca615521afed3/templates/compose/penpot.yaml#L64-L68
[coolify-template-frontend]: https://github.com/coollabsio/coolify/blob/b8866b87e8e855e041c21330352ca615521afed3/templates/compose/penpot.yaml#L18-L20
[penpot-api-uri]: https://github.com/penpot/penpot/blob/1d2c37e52c733f74017d90b0fd1ae2d074a5c33d/frontend/src/app/main/repo.cljs#L173-L195
[penpot-entrypoint]: https://github.com/penpot/penpot/blob/1d2c37e52c733f74017d90b0fd1ae2d074a5c33d/docker/images/files/nginx-entrypoint.sh#L27-L48
[penpot-public-uri]: https://github.com/penpot/penpot/blob/1d2c37e52c733f74017d90b0fd1ae2d074a5c33d/frontend/src/app/config.cljs#L175-L183
[penpot-uri-guide]: https://github.com/penpot/penpot/blob/1d2c37e52c733f74017d90b0fd1ae2d074a5c33d/docs/technical-guide/configuration.md#L313-L327
