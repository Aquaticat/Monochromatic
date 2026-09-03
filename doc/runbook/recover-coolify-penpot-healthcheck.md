# Recover Coolify Penpot after the backend healthcheck loses Node.js

## What this proves

This procedure repairs a Coolify Penpot service where:

```text
Frontend          Exited
Penpot Backend    Running (unhealthy)
Penpot Exporter   Running (healthy)
Postgres          Running (healthy)
Redis             Running (healthy)
```

The deterministic configuration mismatch is documented in
[`doc/troubleshooting/coolify-penpot-latest-node-healthcheck.md`](../troubleshooting/coolify-penpot-latest-node-healthcheck.md).
On 2026-09-02,
`penpotapp/backend:latest` resolves to Penpot `2.17.2`.
That image contains `curl` but not `node`,
while the affected Compose healthcheck executes `node`.

Direct mutation was not possible because this repository has no Coolify endpoint or authorization for the deployment.
The public endpoint `https://penpot.c.aquati.cat` was probed and returned HTTP `502`.
The replacement was verified against the published `penpotapp/backend:2.17.2` image
and against Penpot and Coolify source.

## Setup

Status:
TODO

Prerequisites:

- Browser with network access to the Coolify dashboard that owns `https://penpot.c.aquati.cat`.
- Coolify account with permission to update and deploy the Penpot service.
- Existing service containing the named volumes `penpot-assets` and `penpot-postgresql-data`.
- No concurrent Penpot deployment in progress.

Obtain the deployment-specific Coolify dashboard URL from the server operator or deployment records.
Do not use `https://penpot.c.aquati.cat` as the dashboard URL;
that is the Penpot application URL.

1. Open the Coolify dashboard URL in the browser.
   The Coolify sign-in page or dashboard appears.
2. Sign in with the authorized Coolify account.
   The Coolify dashboard appears without an authorization error.
3. Open **Projects**.
   The project list appears.
4. Open the project and environment containing the Penpot service for `penpot.c.aquati.cat`.
   The environment's resource list appears.
5. Open the Penpot service.
   The service page shows frontend,
   backend,
   exporter,
   PostgreSQL,
   and Redis resources.
6. Open **Settings** and then **General** if the configuration sidebar is present.
   The **Service details** section appears.

## Steps

Status:
TODO

1. Click **Edit Compose file**.
   The **Docker Compose** editor opens.
2. Copy the complete current Compose text to a local text file outside Coolify.
   The saved file contains the pre-recovery image tags,
   environment variables,
   healthchecks,
   volume mounts,
   and service names.
3. Change the frontend image line to:

   ```yaml
   image: 'penpotapp/frontend:2.17.2'
   ```

   The frontend no longer uses a floating tag.
4. Change the backend image line to:

   ```yaml
   image: 'penpotapp/backend:2.17.2'
   ```

   The backend no longer uses a floating tag.
5. Change the exporter image line to:

   ```yaml
   image: 'penpotapp/exporter:2.17.2'
   ```

   Every Penpot application component now uses release `2.17.2`.
6. Replace the complete `penpot-backend.healthcheck` block with:

   ```yaml
   healthcheck:
     test:
       - CMD
       - curl
       - --fail
       - --silent
       - --show-error
       - 'http://127.0.0.1:6060/readyz'
     interval: 10s
     timeout: 30s
     retries: 15
   ```

   The healthcheck now executes `/usr/bin/curl`,
   which is present in backend `2.17.2`.
7. Replace these deprecated backend environment entries:

   ```yaml
   - PENPOT_ASSETS_STORAGE_BACKEND=assets-fs
   - PENPOT_STORAGE_ASSETS_FS_DIRECTORY=/opt/data/assets
   ```

   with:

   ```yaml
   - PENPOT_OBJECTS_STORAGE_BACKEND=fs
   - PENPOT_OBJECTS_STORAGE_FS_DIRECTORY=/opt/data/assets
   ```

   The storage backend uses current Penpot variable names while retaining `/opt/data/assets`.
8. Confirm the Compose text still contains both mounts exactly:

   ```yaml
   - 'penpot-assets:/opt/data/assets'
   - 'penpot-postgresql-data:/var/lib/postgresql/data'
   ```

   Both persistent named volumes remain attached to their original paths.
9. Click **Save changes**.
   Coolify confirms the Compose update and the save control stops showing a loading state.
10. If the service status is **Degraded**,
    click **Actions** and then **Force Restart**.
    The **Service Startup** deployment log opens and container recreation begins.
11. If the service status is **Stopped** instead,
    click **Actions** and then **Force Deploy**.
    The **Service Startup** deployment log opens and container creation begins.
12. Leave the deployment log open until it finishes.
    The final log reports success rather than
    `dependency failed to start: container penpot-backend ... is unhealthy`.
13. Open **Runtime Logs** after the deployment completes.
    The service log viewer appears.
14. Select **Penpot Backend** if the log viewer asks for a resource.
    Backend startup logs appear.
15. Open `https://penpot.c.aquati.cat` in a new browser tab.
    The Penpot login page or authenticated dashboard appears instead of an HTTP `502` page.

Only one deployment branch in steps 10 and 11 applies.
Do not run both.

## What to check

Status:
TODO

Confirm all of the following before closing the incident:

- **Penpot Backend** shows `Running (healthy)`.
- **Frontend** shows `Running (healthy)` or `Running`.
- **Penpot Exporter** shows `Running (healthy)`.
- **Postgres** shows `Running (healthy)`.
- **Redis** shows `Running (healthy)`.
- Backend logs contain `hint="welcome to penpot"` and `version="2.17.2"`.
- Backend logs contain `hint="starting http server"` and `port=6060`.
- Deployment logs do not contain `node: command not found`.
- Deployment logs do not contain
  `dependency failed to start: container penpot-backend`.
- `https://penpot.c.aquati.cat` no longer returns HTTP `502`.
- Existing teams and files are visible after login.
- Opening one existing file loads its canvas and assets.

If the backend remains unhealthy,
open **Runtime Logs**,
select **Penpot Backend**,
and preserve the complete startup log from the first `exec` line through the final error.
A database migration,
secret,
or storage error is a separate incident from the repaired healthcheck.
Do not delete or recreate volumes while diagnosing it.

## Restore

Status:
TODO

The pre-recovery configuration is broken when paired with backend `2.17.2`.
Restore it only to investigate a distinct regression,
and expect the original outage to return.

1. Open the Penpot service's **Settings**.
   The settings page appears.
2. Open **General** if the configuration sidebar is present.
   The **Service details** section appears.
3. Click **Edit Compose file**.
   The **Docker Compose** editor opens.
4. Replace the editor contents with the complete pre-recovery Compose text saved during setup.
   The editor again shows the original tags,
   healthcheck,
   and environment entries.
5. Confirm the Compose text still contains `penpot-assets` and `penpot-postgresql-data`.
   Both named volume declarations remain present.
6. Click **Save changes**.
   Coolify confirms the Compose update.
7. Click **Actions** and use **Force Restart** for a degraded service or **Force Deploy** for a stopped service.
   The deployment log opens and applies the restored configuration.

Never use **Force Cleanup Containers**,
delete the Penpot service,
or remove `penpot-assets` or `penpot-postgresql-data` as part of this recovery.

Do not downgrade Penpot to `2.11.1` against the current database.
If a version rollback becomes necessary,
restore PostgreSQL and asset data from a backup taken before the first `2.17.2` start,
then deploy the Penpot version matching that backup.
