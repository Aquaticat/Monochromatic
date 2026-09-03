# Correct a Coolify Penpot public URI that exposes internal port 8080

## What this proves

This procedure repairs a running Penpot service whose browser log contains:

```text
public-uri="https://penpot.c.aquati.cat:8080/"
```

The resulting browser request fails with:

```text
:8080/api/main/methods/get-enabled-flags:1 Failed to load resource: net::ERR_CONNECTION_TIMED_OUT
```

The diagnosed call chain is documented in
[`doc/troubleshooting/coolify-penpot-public-uri-internal-port.md`][public-uri-diagnosis].
The repair keeps frontend port `8080` as Coolify's internal proxy target,
but gives Penpot the browser-facing origin `https://penpot.c.aquati.cat`.
It does not change Caddy,
application versions,
healthchecks,
databases,
or volumes.

The public application and configuration endpoint were reachable for read-only probes,
but this repository has no Coolify endpoint or authorization for deployment mutation.
The live Compose edit must therefore be performed in the authorized Coolify dashboard.

## Setup

Status:
TODO

Prerequisites:

- Browser with network access to the Coolify dashboard that owns `https://penpot.c.aquati.cat`.
- Coolify account allowed to view source and deployable Compose,
  update the service,
  and recreate its containers.
- Running or degraded Penpot service with frontend,
  backend,
  exporter,
  PostgreSQL,
  and Redis components.
- No concurrent Penpot deployment or backup.

1. Open the deployment's Coolify dashboard in a browser.
   The Coolify sign-in page or dashboard appears.
2. Sign in with the authorized Coolify account.
   The dashboard appears without an authorization error.
3. Open **Projects**.
   The project list appears.
4. Open the project and environment containing `penpot.c.aquati.cat`.
   The environment's resource list appears.
5. Open the Penpot service.
   Component cards for frontend,
   backend,
   exporter,
   PostgreSQL,
   and Redis appear.
6. Record the service's current status.
   The status is available for choosing one recreation action later.

## Steps

Status:
TODO

1. Open **Configuration** and then **General**.
   The service's general configuration appears.
2. Click **Edit Compose File**.
   The **Source Compose** editor opens.
3. Copy the complete source Compose text to a local file outside Coolify.
   The file preserves the exact pre-repair configuration for rollback.
4. Confirm the saved and editable definitions still contain these volume names:

   ```text
   penpot-assets
   penpot-postgresql-data
   penpot-redis-data
   ```

   All persistent data sources remain represented before the edit.
5. Find every `PENPOT_PUBLIC_URI` entry in **Source Compose**.
   The editor shows the frontend,
   backend,
   and exporter values that will be replaced.
6. Remove duplicate `PENPOT_PUBLIC_URI` entries within each component's environment.
   Frontend,
   backend,
   and exporter each have at most one such entry.
7. Keep this standalone frontend declaration unchanged:

   ```yaml
   - SERVICE_URL_FRONTEND_8080
   ```

   Coolify retains port `8080` as the frontend container's internal target.
8. Set the frontend public URI to this list-style environment entry:

   ```yaml
   - PENPOT_PUBLIC_URI=https://penpot.c.aquati.cat
   ```

   The frontend environment contains the literal public origin without `:8080`.
9. Set the backend public URI to the same list-style environment entry:

   ```yaml
   - PENPOT_PUBLIC_URI=https://penpot.c.aquati.cat
   ```

   The backend environment contains the literal public origin without `:8080`.
10. Set the exporter public URI to the same list-style environment entry:

    ```yaml
    - PENPOT_PUBLIC_URI=https://penpot.c.aquati.cat
    ```

    The exporter environment contains the literal public origin without `:8080`.
11. Confirm the editable Compose text still contains these mounts exactly:

    ```yaml
    - 'penpot-assets:/opt/data/assets'
    - 'penpot-postgresql-data:/var/lib/postgresql/data'
    - 'penpot-redis-data:/data'
    ```

    No persistent mount was renamed or removed.
12. Click **Save changes**.
    Coolify confirms the Compose update and reparses the service.
13. Open **Deployable Compose**.
    The generated definition appears.
14. Find every generated `PENPOT_PUBLIC_URI` entry.
    Frontend,
    backend,
    and exporter each show `https://penpot.c.aquati.cat` without `:8080`.
15. If any generated value is absent or includes `:8080`,
    copy the complete **Deployable Compose** text to a local file and stop this runbook.
    The file preserves evidence of a separate Coolify parsing or override problem.
16. If the recorded service status was **Stopped**,
    click **Actions** and then **Force Deploy**.
    The **Service Startup** deployment log opens and Coolify recreates the containers.
17. If the recorded service status was not **Stopped**,
    click **Actions** and then **Force Restart**.
    The **Service Startup** deployment log opens and Coolify recreates the containers.
18. Leave the deployment log open until it finishes.
    The final deployment line reports success rather than an unhealthy dependency.
19. Open `https://penpot.c.aquati.cat/js/config.js?public-uri-check=20260903` in a new browser tab.
    The cache-busting URL returns
    `var penpotPublicURI = "https://penpot.c.aquati.cat";` without `:8080`.
20. Open a new private browser window with **Ctrl+Shift+N** in Chromium-based browsers.
    A private window appears with a separate browser cache.
21. Open `https://penpot.c.aquati.cat` in the private window.
    The Penpot login page appears through normal HTTPS without a timeout.
22. Open browser developer tools with **F12**.
    Developer tools appear.
23. Select **Console**.
    Penpot's startup messages appear.
24. Find the startup message containing `public-uri=`.
    It contains `public-uri="https://penpot.c.aquati.cat/"` without `:8080`.
25. Select **Network**.
    The network request list appears.
26. Reload the page with **Ctrl+R**.
    New Penpot requests populate the list.
27. Filter for `get-enabled-flags`.
    Its request URL starts with
    `https://penpot.c.aquati.cat/api/main/methods/get-enabled-flags` and has no `:8080`.

Only one recreation branch in steps 16 and 17 applies.
Do not run both.
A Compose save does not change an existing container's environment,
so container recreation is required for the frontend entrypoint to regenerate `js/config.js`.

## What to check

Status:
TODO

Confirm all of the following before closing the incident:

- `https://penpot.c.aquati.cat/js/config.js?public-uri-check=20260903` contains
  `var penpotPublicURI = "https://penpot.c.aquati.cat";`.
- Browser logs contain `public-uri="https://penpot.c.aquati.cat/"` without `:8080`.
- Browser requests use `https://penpot.c.aquati.cat/api/` without `:8080`.
- Browser logs do not contain `net::ERR_CONNECTION_TIMED_OUT` for `get-enabled-flags`.
- Caddy continues serving `https://penpot.c.aquati.cat` on standard HTTPS.
- Backend,
  frontend,
  exporter,
  PostgreSQL,
  and Redis retain their pre-repair healthy or running states.
- Existing teams and files remain visible after login.
- Opening an existing file loads its canvas and assets.
- Exporting one disposable test shape completes and downloads an output file.
- The three original volume names and mount destinations remain unchanged in **Deployable Compose**.

If the cache-busting `config.js` response is correct but the private browser still uses `:8080`,
preserve the private window's complete request URL and response headers.
That result would indicate a second configuration source rather than the repaired generated file.

## Restore

Status:
TODO

Configuration rollback is sufficient for this environment-only change.
Do not restore PostgreSQL or asset backups merely because the public URI deployment fails.

1. Open the Penpot service's **Configuration** and then **General**.
   The service's general configuration appears.
2. Click **Edit Compose File**.
   The **Source Compose** editor opens.
3. Replace the editor contents with the complete pre-repair Compose text saved during setup.
   The original environment entries reappear.
4. Confirm the restored text still names `penpot-assets`,
   `penpot-postgresql-data`,
   and `penpot-redis-data`.
   All persistent data sources remain represented.
5. Click **Save changes**.
   Coolify confirms the restored Compose definition.
6. If the service is **Stopped**,
   click **Actions** and then **Force Deploy**.
   Coolify recreates the containers from the restored definition.
7. If the service is not **Stopped**,
   click **Actions** and then **Force Restart**.
   Coolify recreates the containers from the restored definition.
8. Leave the deployment log open until it finishes.
   The final deployment line reports success or reproduces the original public URI symptom.

Never delete or rename the service,
run Compose with `--volumes`,
use **Force Cleanup Containers**,
or remove any Penpot volume during this repair or rollback.

[public-uri-diagnosis]: ../troubleshooting/coolify-penpot-public-uri-internal-port.md
