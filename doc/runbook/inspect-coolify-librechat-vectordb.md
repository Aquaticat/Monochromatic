# Inspect a Coolify LibreChat vector database reported twice as exited

## What this proves

This read-only procedure distinguishes:

- one real `vectordb` container from duplicate Coolify component records;
- a stopped PostgreSQL process from a stale Coolify status;
- an old Coolify build affected by the false-container-exit bug from a current build;
- a PostgreSQL failure from an obsolete LibreChat health-check path.

Direct automation was unavailable when this runbook was written.
No authenticated Coolify browser session,
Coolify API endpoint,
or API token was available to the agent.
The service-level Coolify terminal also reported that no containers were available,
so it could not inspect the destination Docker daemon.

## Setup

Status:
TODO

Use a browser with owner access to the self-hosted Coolify instance.
Have SSH access to the destination server and permission to run Docker commands there.
The commands do not print container environment variables or credentials.
Review log output before sharing it because application logs can contain local identifiers.

Open the LibreChat Service in Coolify.
Copy the Service UUID from the URL segment immediately after `/service/`.
In the command examples,
replace `SERVICE_UUID`,
`COOLIFY_CONTAINER_ID`,
and `VECTORDB_CONTAINER_ID` with observed values.
Do not type the placeholder words literally.

## Steps

Status:
TODO

1.  In Coolify,
    open **Projects**,
    select the project and environment containing LibreChat,
    then select the LibreChat Service.
    The expected outcome is the LibreChat **Configuration** page with its Compose resources.

2.  Open both **Vectordb** resource cards in separate browser tabs.
    The expected outcome is one settings page per displayed card.

3.  Record the full URL and the sentence beneath the **Vectordb** heading in each tab.
    The expected sentence contains either
    `Identity, image, and public access for this compose application.`
    or
    `Identity, image, and public access for this compose database.`

4.  Open a terminal on the workstation and connect to the destination server with `ssh`.
    The expected outcome is a shell prompt on the server that runs the LibreChat containers.

5.  List Coolify control-plane containers:

    ```bash
    docker ps --all --no-trunc \
      --filter 'name=coolify' \
      --format 'table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}'
    ```

    The expected outcome includes the Coolify application container and its image tag.

6.  Inspect the Coolify application container shown by the preceding command:

    ```bash
    docker inspect COOLIFY_CONTAINER_ID \
      --format 'Image={{.Config.Image}} Started={{.State.StartedAt}} Status={{.State.Status}}'
    ```

    The expected outcome contains an `Image=` value with the installed Coolify tag.

7.  List every container belonging to the LibreChat Compose project:

    ```bash
    docker ps --all --no-trunc \
      --filter 'label=com.docker.compose.project=SERVICE_UUID' \
      --format 'table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Labels}}'
    ```

    The expected outcome is one row for each actual LibreChat Compose container.
    A blank result means the copied UUID is not the Compose project label or the project currently has no containers.

8.  If the preceding command is blank,
    list every container whose name contains `vectordb`:

    ```bash
    docker ps --all --no-trunc \
      --filter 'name=vectordb' \
      --format 'table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}'
    ```

    The expected outcome is either a concrete `vectordb` container row or only the header.

9.  For each `vectordb` container ID found,
    inspect its state,
    configured health check,
    Compose identity,
    and named-volume mounts:

    ```bash
    docker inspect VECTORDB_CONTAINER_ID \
      --format 'State={{json .State}} Image={{.Config.Image}} Healthcheck={{json .Config.Healthcheck}} Project={{index .Config.Labels "com.docker.compose.project"}} Service={{index .Config.Labels "com.docker.compose.service"}}{{println}}{{range .Mounts}}Mount={{.Name}}:{{.Destination}}{{println}}{{end}}'
    ```

    The expected outcome contains `State=`,
    `Image=`,
    `Project=`,
    `Service=vectordb`,
    and a mount ending in `/var/lib/postgresql/data`.

10. For each `vectordb` container ID found,
    read its latest PostgreSQL output:

    ```bash
    docker logs --timestamps --tail 200 VECTORDB_CONTAINER_ID
    ```

    The expected outcome is up to 200 timestamped log lines or a concrete Docker error.

11. List named volumes belonging to the LibreChat Compose project:

    ```bash
    docker volume ls \
      --filter 'label=com.docker.compose.project=SERVICE_UUID' \
      --format 'table {{.Name}}\t{{.Driver}}\t{{.Labels}}'
    ```

    The expected outcome includes the volume mounted at `/var/lib/postgresql/data` in step 9.

12. Return to each **Vectordb** browser tab and leave it open without pressing **Delete**,
    **Convert to Application**,
    or **Convert to Database**.
    The expected outcome is unchanged resource configuration and preserved storage.

## What to check

Status:
TODO

Record and compare these exact values:

- Coolify tag from `Image=` in step 6.
  A version older than `v4.0.0-beta.466` lacks the upstream fix for false exits after an empty Docker query.
- Number of real `vectordb` rows from steps 7 and 8.
  Two cards with one Docker row prove that the cards are not two running containers.
- `State.Status`,
  `State.ExitCode`,
  `State.OOMKilled`,
  `State.Error`,
  `State.StartedAt`,
  and `State.FinishedAt` from step 9.
- Exact final PostgreSQL line from step 10.
  Healthy startup includes `database system is ready to accept connections`.
- Card descriptions from step 3.
  One `compose application` and one `compose database` description prove a stale cross-classification record.
- Named volume from step 9.
  Preserve that exact volume before any image migration or resource-card deletion.

Share the step 6 output,
steps 7 through 10 output,
and the two card-description sentences.
Do not share passwords,
tokens,
container environment variables,
or private domain names.

## Restore

Status:
TODO

No Docker or Coolify state was changed.
Close the two **Vectordb** browser tabs without saving,
then run:

```bash
exit
```

The expected outcome is the workstation shell prompt and the same running or exited containers and named volumes that existed before inspection.
