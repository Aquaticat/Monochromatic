# Inspect a Coolify LibreChat vector database reported twice as exited

## What this proves

This read-only procedure distinguishes:

- real `vectordb` containers from duplicate Coolify component records;
- a stopped PostgreSQL process from a stale Coolify status;
- an old Coolify build susceptible to the empty-query false-exit bug from a current build;
- the installed LibreChat image's actual health endpoint from its configured health check;
- the Coolify resource record and named volume attached to the live container.

Direct automation was unavailable when this runbook was written.
No authenticated Coolify browser session,
Coolify API endpoint,
or API token was available to the agent.
The service-level Coolify terminal also reported that no containers were available,
so it could not inspect the destination Docker daemon.

## Setup

Status:
TODO

Use a browser with owner access to the Coolify instance.
For self-hosted Coolify,
have SSH access to the Coolify control-plane host.
Have separate SSH access to the destination server that runs the LibreChat containers.
These can be the same server,
but do not assume that they are.
Have permission to run Docker commands on each applicable host.

The commands do not print container environment variables or credentials.
Review log output before sharing it because application logs can contain local identifiers.

Sign in to Coolify,
open **Projects**,
select the project and environment containing LibreChat,
select the LibreChat Service,
and open its **Configuration** page.
The required starting state is the LibreChat **Configuration** page with both **Vectordb** cards visible.
Copy the Service UUID from the URL segment immediately after `/service/`.
In the command examples,
replace uppercase placeholders such as `SERVICE_UUID`,
`COMPOSE_PROJECT`,
and `VECTORDB_CONTAINER_ID` with observed values.
Do not type the placeholder words literally.

## Steps

Status:
TODO

1.  Read the version displayed beside **Coolify** in the top bar.
    The expected outcome is a value such as `v4.3.14`.
    Record this rendered version rather than inferring it from a mutable container image reference.

2.  Confirm that the open page is the LibreChat **Configuration** page.
    The expected outcome is a Compose resource list containing both **Vectordb** cards.

3.  Open the first **Vectordb** resource card in a new browser tab.
    The expected outcome is a settings page for that displayed card.

4.  Record the final UUID in the first card's URL and the sentence beneath its **Vectordb** heading.
    The expected sentence contains either
    `Identity, image, and public access for this compose application.`
    or
    `Identity, image, and public access for this compose database.`

5.  Return to **Configuration** and open the second **Vectordb** resource card in another browser tab.
    The expected outcome is a settings page for the other displayed card.

6.  Record the final UUID in the second card's URL and the sentence beneath its **Vectordb** heading.
    The expected sentence contains either exact value from step 4.

7.  Open a terminal on the workstation and connect with `ssh` to the destination server that runs LibreChat.
    The expected outcome is a shell prompt on that destination server.

8.  Confirm the active Docker context:

    ```bash
    docker context show
    ```

    The expected outcome identifies the intended destination context.
    Stop if it identifies another context.

9.  Confirm the Docker daemon identity:

    ```bash
    docker info --format 'Name={{.Name}} ServerVersion={{.ServerVersion}} RootDir={{.DockerRootDir}}'
    ```

    The expected outcome identifies the intended destination Docker daemon.
    Stop if it identifies another host.

10. Run an unfiltered container inventory as a positive control:

    ```bash
    docker ps --all --no-trunc \
      --format 'table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}'
    ```

    The expected outcome includes known destination containers.
    If it prints only the header,
    first resolve the wrong-host,
    wrong-context,
    or Docker-daemon problem before trusting any filtered result.

11. Discover all Compose containers whose service key is `vectordb`:

    ```bash
    docker ps --all --no-trunc \
      --filter 'label=com.docker.compose.service=vectordb' \
      --format 'table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Label "com.docker.compose.project"}}'
    ```

    The expected outcome is one row per real `vectordb` container across all Compose projects.
    Record the project label for the LibreChat row as `COMPOSE_PROJECT`.

12. If the preceding command prints no `vectordb` row,
    search container names as a compatibility fallback:

    ```bash
    docker ps --all --no-trunc \
      --filter 'name=vectordb' \
      --format 'table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}'
    ```

    The expected outcome is either a concrete `vectordb` container row or only the header.

13. For each `vectordb` container ID found,
    run this command once:

    ```bash
    docker inspect VECTORDB_CONTAINER_ID \
      --format 'State={{json .State}} Image={{.Config.Image}} Healthcheck={{json .Config.Healthcheck}}{{println}}ComposeProject={{index .Config.Labels "com.docker.compose.project"}} ComposeService={{index .Config.Labels "com.docker.compose.service"}}{{println}}CoolifyServiceId={{index .Config.Labels "coolify.serviceId"}} CoolifySubType={{index .Config.Labels "coolify.service.subType"}} CoolifySubId={{index .Config.Labels "coolify.service.subId"}}{{println}}{{range .Mounts}}Mount={{.Name}}:{{.Destination}}{{println}}{{end}}'
    ```

    Each run should contain `State=`,
    `Image=`,
    `ComposeService=vectordb`,
    Coolify resource labels,
    and a mount ending in `/var/lib/postgresql/data`.
    Empty Coolify labels are evidence to record,
    not values to guess.

14. List every container in the discovered LibreChat Compose project:

    ```bash
    docker ps --all --no-trunc \
      --filter 'label=com.docker.compose.project=COMPOSE_PROJECT' \
      --format 'table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Label "com.docker.compose.service"}}'
    ```

    The expected outcome includes the actual LibreChat,
    MongoDB,
    Meilisearch,
    vector database,
    and RAG API containers that currently exist.

15. For each MongoDB,
    Meilisearch,
    vector database,
    and LibreChat container ID from step 14,
    run this command once:

    ```bash
    docker inspect CONTAINER_ID \
      --format 'Name={{.Name}}{{println}}{{range .Mounts}}Mount={{.Name}}:{{.Destination}}{{println}}{{end}}'
    ```

    Each run should record the current named-volume identity and destination without printing environment variables.

16. For each `vectordb` container ID,
    read its latest PostgreSQL output:

    ```bash
    docker logs --timestamps --tail 200 VECTORDB_CONTAINER_ID
    ```

    Each run should return up to 200 timestamped log lines or a concrete Docker error.

17. Discover the installed LibreChat container:

    ```bash
    docker ps --all --no-trunc \
      --filter 'label=com.docker.compose.project=COMPOSE_PROJECT' \
      --filter 'label=com.docker.compose.service=librechat' \
      --format 'table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}'
    ```

    The expected outcome is the installed LibreChat container row.

18. Inspect its configured health check:

    ```bash
    docker inspect LIBRECHAT_CONTAINER_ID \
      --format 'State={{json .State}} Healthcheck={{json .Config.Healthcheck}}'
    ```

    The expected outcome records both the configured command and Docker's latest health-check evidence.

19. If the LibreChat container is running,
    probe its current `/health` endpoint:

    ```bash
    docker exec LIBRECHAT_CONTAINER_ID \
      wget --no-verbose --tries=1 --spider http://127.0.0.1:3080/health
    ```

    The expected healthy output includes
    `remote file exists`.
    Record an exact `404 Not Found`,
    connection error,
    or missing-command error instead of substituting another tool.

20. If the LibreChat container is running,
    probe its configured legacy `/api/health` endpoint:

    ```bash
    docker exec LIBRECHAT_CONTAINER_ID \
      wget --no-verbose --tries=1 --spider http://127.0.0.1:3080/api/health
    ```

    The expected obsolete-route result is `404 Not Found`.
    Different output proves that the installed artifact differs from the reviewed current source.

21. On self-hosted Coolify,
    connect with `ssh` to the Coolify control-plane host.
    The expected outcome is a shell prompt on the host running the Coolify application and `coolify-db` containers.
    Skip steps 22 through 24 for Coolify Cloud.

22. Identify the Coolify database container without assuming it shares the destination host:

    ```bash
    docker ps --all --no-trunc \
      --filter 'name=coolify-db' \
      --format 'table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}'
    ```

    The expected outcome contains the PostgreSQL container that stores Coolify's control-plane metadata.

23. Read the application and database records for this Service:

    ```bash
    docker exec COOLIFY_DB_CONTAINER_ID \
      psql --username=coolify --dbname=coolify --csv \
      --set=service_uuid=SERVICE_UUID \
      --command="SELECT 'application' AS kind, sa.id, sa.uuid, sa.name, sa.image, sa.status FROM service_applications AS sa JOIN services AS s ON s.id = sa.service_id WHERE s.uuid = :'service_uuid' UNION ALL SELECT 'database' AS kind, sd.id, sd.uuid, sd.name, sd.image, sd.status FROM service_databases AS sd JOIN services AS s ON s.id = sd.service_id WHERE s.uuid = :'service_uuid' ORDER BY name, kind, id;"
    ```

    The expected outcome is one row per Coolify card.
    Match card URL UUIDs from steps 4 and 6 to the `uuid` column,
    then match the live container's `CoolifySubType` and `CoolifySubId` from step 13 to `kind` and `id`.

24. Read persistent-storage metadata for the PostgreSQL mount:

    ```bash
    docker exec COOLIFY_DB_CONTAINER_ID \
      psql --username=coolify --dbname=coolify --csv \
      --command="SELECT id, name, mount_path, resource_type, resource_id FROM local_persistent_volumes WHERE mount_path = '/var/lib/postgresql/data' ORDER BY resource_type, resource_id, id;"
    ```

    The expected outcome includes metadata for the volume reported by step 13.
    Use `resource_type` and `resource_id` to determine which Coolify record owns that metadata.

25. Return to each **Vectordb** browser tab and leave it open without pressing **Delete**,
    **Convert to Application**,
    or **Convert to Database**.
    The expected outcome is unchanged resource configuration and preserved storage.

## What to check

Status:
TODO

Record and compare these exact values:

- Rendered Coolify version from step 1.
  A version older than `v4.0.0-beta.466` is susceptible to the upstream empty-query false-exit bug.
  Version alone does not prove that this incident was caused by that bug.
- Unfiltered destination inventory from step 10.
  It validates that later empty filtered results are meaningful.
- Number of real `vectordb` rows from steps 11 and 12.
  Two cards with one Docker row prove that the cards do not represent two current containers.
- `State.Status`,
  `State.ExitCode`,
  `State.OOMKilled`,
  `State.Error`,
  `State.StartedAt`,
  and `State.FinishedAt` from step 13.
- Exact final PostgreSQL line from step 16.
  Healthy startup includes `database system is ready to accept connections`.
- `CoolifySubType` and `CoolifySubId` from step 13,
  matched to `kind` and `id` from step 23.
  This match identifies the record represented by the live container.
- Card UUIDs and descriptions from steps 4 and 6,
  matched to the control-plane rows from step 23.
  Do not choose a card to delete from its description alone.
- Named-volume identities from steps 13 and 15,
  matched to storage metadata from step 24.
  Preserve all MongoDB,
  Meilisearch,
  and PostgreSQL volume identities across later recovery.
- LibreChat health configuration and both endpoint probes from steps 18 through 20.
  These test the installed artifact rather than inferring from current upstream source.

A false-exit attribution requires a live or logged Coolify `Exited` transition while destination Docker still reports the same container as running.
Static version inspection proves susceptibility only.

Share the rendered Coolify version,
steps 10 through 20 output,
the two card URL UUIDs and descriptions,
and steps 23 through 24 output when self-hosted.
Do not share passwords,
tokens,
container environment variables,
or private domain names.

## Restore

Status:
TODO

No Docker or Coolify state was changed.
Close the two **Vectordb** browser tabs without saving.
Run `exit` once for each SSH session:

```bash
exit
```

The expected outcome is the workstation shell prompt and the same containers,
Coolify records,
and named volumes that existed before inspection.
