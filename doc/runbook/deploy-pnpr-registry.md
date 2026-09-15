# Runbook: deploy the private pnpr registry

Deploys `package/config/pnpr/` as a Coolify Docker Compose resource,
 publishes it at `https://pnpr.c.aquati.cat/` through the Coolify host's self-managed Caddy,
 and wires Coolify to redeploy only when that package changes.
Design:
 `doc/decision/private-npm-registry.md`.

## What this proves

- DNS,
   Caddy,
   and Coolify route `https://pnpr.c.aquati.cat/` to the pnpr container.
- The registry answers anonymous reads,
   refuses unauthenticated publishes,
   and receives scoped package paths (`%2f`) intact.
- Pushes that do not touch `package/config/pnpr/` do not redeploy.

## Why a person runs this

The owner decided that no host SSH access,
 Coolify API token,
 or Njalla DNS token is shared with agents.
The bridges that would automate these steps (SSH to the Coolify host,
 the Coolify API,
 the Njalla API)
 are withheld by that authorization choice,
 not by a missing capability.
Before writing this,
 the container,
 the generated config,
 unauthenticated publish refusal,
 and `%2f` pass-through behind Caddy 2.11.4 were verified locally with podman.

## Setup

Status:
TODO | DONE

1. Have these ready:
   - A browser signed in to the Coolify dashboard as an administrator.
   - An SSH session to the Coolify host,
      with permission to edit its Caddyfile and reload Caddy.
   - A browser signed in to Njalla with access to the `aquati.cat` domain.
   - A Coolify GitHub App source that can read `Aquaticat/Monochromatic`.
      A public-repository resource cannot work here:
       Coolify renders **Watch paths** only when
       `$this->application->is_github_based() && !$this->application->is_public_repository()`
       (`resources/views/livewire/project/application/general.blade.php` in coollabsio/coolify).
   - Hetzner egress that allows `deb.debian.org` on port 80,
      which `package/config/tofu/hetzner.tf` grants through `package_repo_http_ips` since 2026-09-15.
      Without it the image build fails at `apt-get update` with exit code 100,
      because `node:24-slim` uses `http://deb.debian.org` apt sources.
   - A local terminal with `curl`,
      `dig`,
      and `openssl`.
2. Confirm the deployment files are on `main`:
   open `https://github.com/Aquaticat/Monochromatic/tree/main/package/config/pnpr`.
   Expected:
    the listing shows `Containerfile`,
    `compose.yaml`,
    and `config.yaml`.
3. On the Coolify host,
    run `ss --listening --tcp --numeric 'sport = :7677'`.
   Expected:
    only one line,
    the header beginning with `State`;
    no socket is listening on port 7677.
   If a row appears,
    stop and report it,
    because `compose.yaml` publishes `127.0.0.1:7677`.

## Steps

Status:
TODO | DONE

### Stage A: DNS record at Njalla

1. In Njalla,
    open the `aquati.cat` domain's DNS records.
   Expected:
    an `A` record named `garage.c` with content `135.181.104.96` is listed.
2. Click **Add record**.
   Expected:
    a record form opens.
3. Set **Type** to `A`,
    **Name** to `pnpr.c`,
    **Content** to `135.181.104.96`,
    and **TTL** to the same value the `garage.c` record uses.
4. Save the record.
   Expected:
    an `A` record named `pnpr.c` with content `135.181.104.96` is listed.
5. In the local terminal,
    run `dig +short pnpr.c.aquati.cat`.
   Expected:
    `135.181.104.96`.
   An empty result means propagation is still pending;
    rerun it after a few minutes before continuing.

### Stage B: Coolify resource

1. In Coolify,
    open the project that holds the Garage resource,
    click **+ New**,
    and choose **Resource**.
   Expected:
    the resource picker opens with a **Search resources** box.
2. Type `github` into **Search resources** and choose the private repository option that uses a GitHub App.
   Expected:
    the form shows **Choose GitHub App**.
3. Choose the GitHub App that can read `Aquaticat/Monochromatic`,
    then pick `Aquaticat/Monochromatic` under **Choose repository**.
   Expected:
    the **Build configuration** section appears with **Branch** and **Build pack**.
4. Set **Branch** to `main`.
5. Set **Build pack** to `Docker Compose`.
   Expected:
    **Base directory** and **Compose file** fields appear.
6. Set **Base directory** to `/package/config/pnpr`.
7. Set **Compose file** to `/compose.yaml`.
   Expected:
    the helper text shows the compose path resolving to `/package/config/pnpr/compose.yaml`.
8. Click **Continue**.
   Expected:
    the application's configuration page opens and lists the `pnpr` service.
9. Leave every domain field empty.
   Expected:
    no domain is attached,
    because Caddy on the host serves the hostname.
10. On the **General** page,
     set **Watch paths** to exactly `package/config/pnpr/**` and save.
    Expected:
     the field keeps `package/config/pnpr/**` after the page reloads.
    If **Watch paths** is missing,
     the resource was created from a public repository;
     delete it and restart Stage B with the GitHub App.
11. In the local terminal,
     run `openssl rand -hex 32`.
    Expected:
     one line of 64 hexadecimal characters.
12. Open **Environment Variables**.
    Expected:
     `PNPR_SECRET` is listed and marked required,
     because `compose.yaml` declares it with `${PNPR_SECRET:?...}`.
13. Set `PNPR_SECRET` to the 64-character value from step 11 and save.
    Expected:
     the variable shows a saved,
     masked value.
14. Click **Deploy**.
    Expected:
     the deployment log ends with the `pnpr` container running,
     and the container log contains `"message":"pnpr listening","listen":"0.0.0.0:7677"`.
15. On the Coolify host,
     run `curl --silent http://127.0.0.1:7677/-/ping`.
    Expected:
     `{}`.

### Stage C: Caddy site block

1. On the Coolify host,
    open the self-managed Caddyfile in an editor.
2. Append this site block after the existing `garage.c.aquati.cat` block:

   ```caddyfile
   pnpr.c.aquati.cat {
   	reverse_proxy 127.0.0.1:7677
   }
   ```

   Expected:
    the file contains exactly one `pnpr.c.aquati.cat {` block.
3. Run `caddy validate --config <path to the Caddyfile> --adapter caddyfile`.
   Expected:
    the output ends with `Valid configuration`.
4. Run `systemctl reload caddy`.
   Expected:
    the command returns with no error printed.
5. In the local terminal,
    run `curl --silent https://pnpr.c.aquati.cat/-/ping`.
   Expected:
    `{}`.
   A certificate error means Caddy has not yet obtained the certificate for the new name;
    rerun it after a minute.

### Stage D: push events

No manual repository webhook is needed:
 the GitHub App delivers push events to Coolify,
 and Coolify filters them by **Watch paths**.
Do not add a repository webhook as well,
 or matching pushes deploy twice.

## What to check

Status:
TODO | DONE

Run each command in the local terminal.

1. `curl --silent https://pnpr.c.aquati.cat/-/ping`
   prints `{}`.
2. `curl --silent --write-out ' %{http_code}\n' 'https://pnpr.c.aquati.cat/~monochromatic-dev/@monochromatic-dev%2fmodule-or-throw'`
   prints `Not Found 404` before the first publish run,
   or a JSON document containing `"name":"@monochromatic-dev/module-or-throw"` after it.
3. `curl --silent --request PUT --header 'content-type: application/json' --data '{}' --write-out ' %{http_code}\n' 'https://pnpr.c.aquati.cat/~monochromatic-dev/@monochromatic-dev%2fmodule-or-throw'`
   prints `Authentication required for package "@monochromatic-dev/module-or-throw" 401`.
   The package name in that message proves the encoded slash reached pnpr through Caddy.
4. `curl --silent --write-out ' %{http_code}\n' https://pnpr.c.aquati.cat/left-pad`
   prints `Not Found 404`,
   confirming the registry proxies nothing.
5. After the next push to `main` that does not touch `package/config/pnpr/`,
   the pnpr application's **Deployment Logs** list shows no new deployment for that commit.
6. Tell the agent session that the registry is live,
   so it can dispatch the publish workflow and run the throwaway-consumer verification.

## Restore

Status:
TODO | DONE

Only if the registry must be removed.

1. In Coolify,
    open the pnpr application's **Danger Zone**,
    delete the resource,
    and select the option that also deletes volumes.
   Expected:
    the application and the `pnpr-storage` volume disappear.
   Published packages are gone with the volume;
    recovery republishes current versions.
2. On the Coolify host,
    remove the `pnpr.c.aquati.cat` block from the Caddyfile and run `systemctl reload caddy`.
   Expected:
    `curl --silent --write-out '%{http_code}\n' --output /dev/null https://pnpr.c.aquati.cat/-/ping` no longer prints `200`.
3. In Njalla,
    delete the `pnpr.c` `A` record.
   Expected:
    `dig +short pnpr.c.aquati.cat` prints nothing once caches expire.

## Operations

- To pick up a newer `@pnpm/pnpr@next`,
   open the pnpr application in Coolify and choose **Deploy (without cache)**;
   a normal redeploy reuses the cached install layer.
- `config.yaml` changes only through `mise run sync:files`;
   committing its regenerated file triggers the Watch paths redeploy.
