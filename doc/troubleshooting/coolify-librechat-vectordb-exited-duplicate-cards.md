# Coolify beta.463 to 4.3.14: LibreChat vectordb cards can show false exits or persistent duplicates

A Coolify-managed LibreChat Service can display two `Vectordb` cards as
`Exited` even though its Docker Compose file defines one `vectordb` service.
A separate stale health check can show a running LibreChat container as
`unhealthy`.
The cards,
the Docker container state,
and the application health check are separate evidence sources.

## Symptom

The observed Coolify Service page reported:

- LibreChat as `Running (unhealthy)`;
- Meilisearch 1.12.3 as `Running (healthy)` after its separate database-version recovery;
- two `Vectordb` cards using `ankane/pgvector:latest`,
  both as `Exited`;
- RAG API and MongoDB as `Running (healthy)`.

The Service-level **Terminal** and **Runtime Logs** pages then reported that no
containers were running,
which contradicted the resource cards and prevented inspection of the actual
PostgreSQL process.

The configured LibreChat health check requested:

```text
http://127.0.0.1:3080/api/health
```

LibreChat's current route is:

```text
http://127.0.0.1:3080/health
```

A failed health check can explain `Running (unhealthy)`.
It cannot by itself explain a PostgreSQL process in Docker state `exited`.

## Root cause

There are three independent mechanisms.
Only destination-host Docker evidence can establish whether the third mechanism,
a real PostgreSQL exit,
is present.

### Coolify renders stored resources rather than discovering cards from Docker

Coolify 4.3.14,
tag commit `51a8a97d876cdbd6beeced554dbb8b4bec5a3bb4`,
loads stored Service applications and databases in
`app/Livewire/Project/Service/Configuration.php:67-68`:

```php
$this->applications = $this->service->applications->sort();
$this->databases = $this->service->databases->sort();
```

The Service page renders every record in both collections independently.
`resources/views/livewire/project/service/configuration.blade.php:166-174`
contains:

```php
@foreach ($applications as $application)
    <livewire:project.service.resource-card :service="$service" :resource="$application"
        :parameters="$parameters"
        wire:key="service-application-card-{{ $application->id }}" />
@endforeach
@foreach ($databases as $database)
    <livewire:project.service.resource-card :service="$service" :resource="$database"
        :parameters="$parameters"
        wire:key="service-database-card-{{ $database->id }}" />
@endforeach
```

Two cards therefore do not prove that two Docker containers exist.
They prove that Coolify has two stored resource records to render.
The records can be two application rows,
two database rows,
or one row in each collection.

### The Compose parser creates records but does not prune absent records

Coolify's `serviceParser()` reads the current Compose services and presaves a
resource record for every present service.
`bootstrap/helpers/parsers.php:1607-1657` contains:

```php
foreach ($services as $serviceName => $service) {
    // ...
    if ($isDatabase) {
        $databaseFound = ServiceDatabase::where('name', $serviceName)->where('service_id', $resource->id)->first();
        if ($databaseFound) {
            $savedService = $databaseFound;
        } else {
            $savedService = ServiceDatabase::create([
                'name' => $serviceName,
                'service_id' => $resource->id,
            ]);
        }
    } else {
        $applicationFound = ServiceApplication::where('name', $serviceName)->where('service_id', $resource->id)->first();
        if ($applicationFound) {
            $savedService = $applicationFound;
        } else {
            $savedService = ServiceApplication::create([
                'name' => $serviceName,
                'service_id' => $resource->id,
            ]);
        }
    }
}
```

A repository-wide search of the parser found no corresponding deletion of
Service application or database rows whose names disappeared from the current
Compose service keys.
The only parser-side `delete()` in this function removes malformed environment
variables at `bootstrap/helpers/parsers.php:1569-1578`.

Coolify issue
[coollabsio/coolify#9591](https://github.com/coollabsio/coolify/issues/9591)
reproduces this exact persistent phantom-card behavior on beta.473.
A Coolify member states in the issue that removed entries are not cleaned up
automatically and must be deleted in Service settings.
The issue remains open as of 2026-09-03.

A Compose file cannot define two simultaneously addressable services with the
same YAML key.
If the active Compose has one `vectordb:` key while the Coolify page has two
cards,
at least one card is stale metadata.
Destination-host `docker ps --all` is still required to detect an orphaned
container from a different Compose project.

### Older Coolify status polling can mark an unseen Service resource exited

In Coolify beta.465,
commit `d2de0307bdf385ad16301851f6a416b3e2867d56`,
`app/Actions/Docker/GetContainersStatus.php:326-355` marked each stored Service
resource not found in the Docker query as exited without first rejecting a
completely empty query result:

```php
foreach ($exitedServices as $exitedService) {
    if (str($exitedService->status)->startsWith('exited')) {
        continue;
    }
    // ...
    $exitedService->update(['status' => 'exited']);
}
```

The same file separately marked not-found database records exited at
`app/Actions/Docker/GetContainersStatus.php:403-415`:

```php
$notRunningDatabases = $databases->pluck('id')->diff($foundDatabases);
foreach ($notRunningDatabases as $database) {
    $database = $databases->where('id', $database)->first();
    if (str($database->status)->startsWith('exited')) {
        continue;
    }
    $database->update([
        'status' => 'exited',
        'restart_count' => 0,
        'last_restart_at' => null,
        'last_restart_type' => null,
    ]);
}
```

Coolify PR
[coollabsio/coolify#8860](https://github.com/coollabsio/coolify/pull/8860)
identifies failed Docker queries returning empty container lists as the cause of
false exits.
Release `v4.0.0-beta.466`,
published 2026-03-11,
includes that fix.
Issue
[coollabsio/coolify#8826](https://github.com/coollabsio/coolify/issues/8826)
records the matching PostgreSQL restart symptom on beta.463 and confirmation
that it stopped recurring after the update.

Current Coolify 4.3.14 adds the missing guard to the Service-resource path at
`app/Actions/Docker/GetContainersStatus.php:327-338`:

```php
foreach ($exitedServices as $exitedService) {
    if (str($exitedService->status)->startsWith('exited')) {
        continue;
    }

    // Only protection: If no containers at all, Docker query might have failed
    if ($this->containers->isEmpty()) {
        continue;
    }
```

The installed Coolify version is not yet known.
The contradiction between cards and Terminal is compatible with this fixed
upstream bug,
but compatibility is not proof that this deployment is affected.

### LibreChat moved its health route

LibreChat commit `90cdcb384eea190b3dc9ea5f3387955a4d941323`
serves the health endpoint in `api/server/index.js:290`:

```js
app.get('/health', (_req, res) => res.status(200).send('OK'));
```

Its tests call the same endpoint in `api/server/index.metrics.spec.js:161` and
`api/server/index.spec.js:264-270`.
Coolify 4.3.14's LibreChat template uses `/health` in
`templates/compose/librechat.yaml:56-68`.
The observed `/api/health` configuration is obsolete and independently explains
LibreChat's `unhealthy` suffix when the process is otherwise running.

## Verification

### Source versions

The investigation used:

- Coolify `v4.0.0-beta.465`,
  commit `d2de0307bdf385ad16301851f6a416b3e2867d56`;
- Coolify `v4.3.14`,
  commit `51a8a97d876cdbd6beeced554dbb8b4bec5a3bb4`;
- LibreChat main commit `90cdcb384eea190b3dc9ea5f3387955a4d941323`;
- pgvector `v0.8.0`,
  commit `2627c5ff775ae6d7aef0c430121ccf857842d2f2`.

The installed Coolify version and live Docker state remain unmeasured.
Use
[`doc/runbook/inspect-coolify-librechat-vectordb.md`](../runbook/inspect-coolify-librechat-vectordb.md)
to collect them without changing the deployment.

### PostgreSQL image compatibility harness

The disposable harness used Linux amd64 Podman 5.8.4,
1 GiB memory,
2 CPUs,
a private scratch data directory,
and no production data.
The published images resolved to:

- `ankane/pgvector:latest` and `ankane/pgvector:v0.5.1`:
  digest `sha256:e24d0c7f0e1166b25052f48c2d935b0c74db3b412891a7c70294ee9287ec7427`;
- `pgvector/pgvector:0.8.0-pg15-bookworm`:
  digest `sha256:c50b98b074c4c370da995eb03c8f6bb6dcc2e9d8911e1974c1af981055a168e6`;
- `pgvector/pgvector:0.8.0-pg15-trixie`:
  digest `sha256:7ed468f55926b0284a51848dcb2d7a4cc645581a508f6293956f1fca51bdeceb`.

The incumbent image initialized PostgreSQL 15.4 and pgvector 0.5.1.
The harness created a vector table and inserted one row:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE items (id integer PRIMARY KEY, embedding vector(3));
INSERT INTO items VALUES (1, '[1,2,3]');
```

It stopped the incumbent container and mounted the same directory into each
official PostgreSQL 15 image.
Both official images reached:

```text
database system is ready to accept connections
```

Before updating the extension,
the bookworm image preserved pgvector 0.5.1 and returned the stored row with the
expected distance:

```text
vector_version | 0.5.1
id             | 1
embedding      | [1,2,3]
distance       | 1
```

After:

```sql
ALTER EXTENSION vector UPDATE;
```

it reported pgvector 0.8.0 and returned the same row and distance.

The health-check command was Compose-rendered with doubled dollar signs and run
inside the bookworm container:

```yaml
healthcheck:
  test:
    - CMD-SHELL
    - pg_isready --username="$${POSTGRES_USER}" --host=127.0.0.1 --port=5432 --dbname="$${POSTGRES_DB}"
```

Its output was:

```text
127.0.0.1:5432 - accepting connections
```

Docker Compose documents `$$` as the escape that preserves a literal dollar
sign for container-side expansion.

### Configurations that work cleanly

- `ankane/pgvector:v0.5.1` starts a fresh PostgreSQL 15.4 cluster.
- `pgvector/pgvector:0.8.0-pg15-bookworm` starts the PostgreSQL 15.4-created
  volume as PostgreSQL 15.14 without a collation warning.
- The bookworm image reads vectors while the installed extension remains 0.5.1.
- `ALTER EXTENSION vector UPDATE` moves the installed extension to 0.8.0 and
  preserves the test row and distance query.
- The container-variable health check returns `accepting connections`.
- LibreChat source responds with `OK` at `/health`.

### Configurations that require intervention

- `pgvector/pgvector:0.8.0-pg15-trixie` starts the volume,
  but every connection to the test database warns:

  ```text
  WARNING:  database "rag" has a collation version mismatch
  DETAIL:  The database was created using collation version 2.36, but the operating system provides version 2.41.
  HINT:  Rebuild all objects in this database that use the default collation and run ALTER DATABASE rag REFRESH COLLATION VERSION, or build PostgreSQL with the right library version.
  ```

  The incumbent and bookworm images use Debian 12 with glibc 2.36.
  The trixie image uses Debian 13 with glibc 2.41.
  Refreshing the recorded collation version without rebuilding affected indexes
  would only silence the warning;
  it would not prove index ordering correct.
- `/api/health` does not match the current LibreChat route.
- A Coolify release before beta.466 lacks the Service-resource empty-query guard.
- Deleting a stale card is a metadata mutation and must wait until its resource
  class and the real volume attachment are identified.

The disposable migration proves image and extension compatibility for a small
synthetic PostgreSQL 15 cluster.
It does not prove that the production volume is uncorrupted,
that its indexes require no extension-specific rebuild,
or that its backup is restorable.

## Verified workarounds

### Inspect Docker before changing the stack

Run the linked inspection runbook and use Docker state as the authority.
If Coolify shows two cards while Docker lists one `vectordb` container,
the duplicate is metadata rather than a second current container.

Tradeoff:
this is read-only diagnosis and does not restore service by itself.

### Update old Coolify before trusting status

If the installed version is older than `v4.0.0-beta.466`,
update Coolify through its supported updater before interpreting another
`Exited` transition.
Then repeat the Docker inventory and compare it with the cards.

Tradeoff:
the update fixes false exits from failed Docker queries but does not remove
already-stored phantom resource records.
A control-plane update also requires its own backup and release review.

### Remove only the proven stale resource record

When Docker shows one real `vectordb` service and the two cards identify one
`compose application` plus one `compose database`,
retain the database card and remove the stale application card through its
Service settings.
Back up the vector volume first and stop the full LibreChat Service during the
cleanup.

Current Coolify's `deleteApplication()` only deletes the selected model at
`app/Livewire/Project/Service/Index.php:419-429`,
but the model deletion hook also removes its Coolify persistent-storage metadata
at `app/Models/ServiceApplication.php:61-67`:

```php
static::deleting(function ($service) {
    $service->update(['fqdn' => null]);
    $service->persistentStorages()->delete();
    $service->fileStorages()->delete();
});
```

Tradeoff:
removing the wrong card can discard Coolify's storage metadata for the active
resource.
A future Coolify release may also change deletion behavior.
Do not use a direct SQL `DELETE` against Coolify's database when the supported
Service settings action is available.

### Correct the LibreChat health check

Use the current endpoint:

```yaml
services:
  librechat:
    healthcheck:
      test:
        - CMD
        - wget
        - --no-verbose
        - --tries=1
        - --spider
        - http://127.0.0.1:3080/health
      interval: 5s
      timeout: 10s
      retries: 5
```

Tradeoff:
this corrects health reporting only.
It does not repair a stopped dependency or an application startup error.

### Pin the incumbent before any migration

Changing `ankane/pgvector:latest` to `ankane/pgvector:v0.5.1` currently selects
the same published digest.
It removes future tag movement without changing the running PostgreSQL or
extension version.

Tradeoff:
this cannot fix the present exit because the two tags currently resolve to the
same image.
The repository and image are archived and receive no future maintenance.

### Use the official bookworm image after a restore-tested backup

For a later image migration,
keep PostgreSQL major 15 and the Debian 12 collation provider:

```yaml
services:
  vectordb:
    image: pgvector/pgvector:0.8.0-pg15-bookworm
    healthcheck:
      test:
        - CMD-SHELL
        - pg_isready --username="$${POSTGRES_USER}" --host=127.0.0.1 --port=5432 --dbname="$${POSTGRES_DB}"
      interval: 2s
      timeout: 10s
      retries: 5
      start_period: 10s
```

Start it first with the existing extension version,
verify representative RAG reads,
then run `ALTER EXTENSION vector UPDATE` in a separate maintenance step.
Verify the installed extension version and repeat the reads.

Tradeoff:
the image moves from archived packaging to the pgvector project's maintained
image and preserves the incumbent OS collation version,
but it still changes PostgreSQL from 15.4 to 15.14 and pgvector from 0.5.1 to
0.8.0.
Rollback after the extension update requires the cold pre-migration backup.
This migration is not the first response to an unmeasured container exit.

## What does not work

- Treating two Coolify cards as proof of two containers.
  The page renders stored application and database records independently.
- Treating **Terminal** saying no containers are running as proof that Docker has
  none.
  The same control plane supplies both status and terminal choices;
  inspect the destination Docker daemon.
- Deleting `vectordb-data`.
  It can contain RAG embeddings and destroys the evidence needed to diagnose the
  startup.
- Switching to a PostgreSQL 16 or 17 image against the PostgreSQL 15 volume.
  PostgreSQL data directories are not major-version portable without a supported
  upgrade procedure.
- Switching directly to the trixie image and running only
  `ALTER DATABASE rag REFRESH COLLATION VERSION`.
  The verified glibc change emits an index-rebuild warning;
  refreshing metadata alone does not rebuild affected indexes.
- Adding `restart: unless-stopped` before obtaining exit metadata.
  A restart loop obscures the first failing state and can repeatedly exercise a
  damaged volume.
- Expecting `ankane/pgvector:v0.5.1` to repair the present exit.
  It is currently byte-identical to the observed `latest` image by digest.
- Correcting `/api/health` to `/health` and assuming PostgreSQL is repaired.
  This changes LibreChat's health status only.

## Upstream filing artifact

### Upstream filing decision

No `.out-of-scope/` entry covers Coolify,
LibreChat,
PostgreSQL,
or pgvector.
Open and closed Coolify issues and pull requests were searched for duplicate
resource cards,
empty container queries,
false exits,
and PostgreSQL restart loops.

1.  **Is it really upstream's fault?**
    Partly.
    Coolify's persisted phantom-card behavior is upstream and reproduced in
    issue #9591.
    The false-exit bug was upstream and is fixed by PR #8860.
    The live PostgreSQL state is still unknown,
    so no new database-exit defect is established.
2.  **Can upstream fix it?**
    Yes for automatic stale-record pruning.
    The status-query defect is already fixed.
3.  **Are they supporting this use case?**
    Yes.
    Docker Compose Services and PostgreSQL resources are first-class Coolify
    features,
    and LibreChat is a bundled template.
4.  **Would the repo welcome our contribution?**
    Coolify accepts external issues and pull requests.
    No checked contribution or issue-template policy prohibited an assisted,
    evidence-backed report.
5.  **Will they likely fix it?**
    No current signal supports that conclusion for phantom cards.
    A Coolify member characterized manual deletion as expected cleanup in issue
    #9591,
    and the issue remains open.
    The false-exit defect has already shipped a fix.
6.  **Have we prototyped a minimal fix compatible with their architecture?**
    No.
    Constraint 5 fails for the remaining phantom-card behavior,
    so automatic prototyping is not triggered.
    Safe pruning must also preserve deliberately converted resources and their
    storage metadata,
    which was not validated against Coolify's full parser lifecycle.

Issues #9591 and #8826 plus PR #8860 already contain the relevant upstream
facts.
There is no additive issue or comment to file.
The current evidence should remain in this consumer-side troubleshooting record
until destination-host Docker output establishes a distinct defect.

## References

- [Coolify issue #9591: removed services persist as phantom cards](https://github.com/coollabsio/coolify/issues/9591)
- [Coolify issue #8826: PostgreSQL database keeps restarting](https://github.com/coollabsio/coolify/issues/8826)
- [Coolify PR #8860: prevent false exits on failed Docker queries](https://github.com/coollabsio/coolify/pull/8860)
- [Coolify beta.466 release](https://github.com/coollabsio/coolify/releases/tag/v4.0.0-beta.466)
- [Coolify 4.3.14 release](https://github.com/coollabsio/coolify/releases/tag/v4.3.14)
- [LibreChat current deployment Compose](https://github.com/danny-avila/LibreChat/blob/main/deploy-compose.yml)
- [pgvector source](https://github.com/pgvector/pgvector)
- [Docker Compose interpolation](https://docs.docker.com/reference/compose-file/interpolation/)
