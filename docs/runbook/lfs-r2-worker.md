# Operating the LFS R2 worker

This repo serves its Git LFS objects from Cloudflare R2 through a Worker,
not from GitHub LFS.
The repo-root `.lfsconfig` points every clone at the Worker,
so `git clone` and `git lfs pull` fetch objects from R2 (free egress)
instead of GitHub's metered LFS bandwidth.
Background and rationale live in `packages/config/lfs-r2-worker/README.md`.

This runbook is the operator procedure for the parts a human runs by hand:
deploy or redeploy the Worker,
set or rotate the upload token,
prepare a machine to push new images,
roll back to GitHub LFS,
and confirm the GitHub LFS bill actually drops.

Bridges tried,
 so this is not an unconsidered handoff:
deploy,
 dry-run,
 and secret rotation are all wired as mise tasks and run headless
once wrangler is authenticated,
so they are scripted,
 not manual clicks.
The single step that cannot be done headless is the first `wrangler login`:
minting a scoped Cloudflare API token through the `cf` CLI failed
(`403 Unauthorized` on `tokens/permission-groups`),
so wrangler must be authorized through its interactive browser OAuth,
which also requires the account's two-factor prompt.

## Setup

Status:
TODO

Prerequisites for a fresh machine and a fresh checkout:

1. Clone the repo and trust mise so it will provision tools and read templated config.

   ```sh
   git clone https://github.com/Aquaticat/Monochromatic
   cd Monochromatic
   mise trust
   ```

   Expected:
    `mise trust` prints the path it trusted and exits 0.

2. Provision wrangler,
    which is declared as `npm:wrangler` in mise `[tools]`.

   ```sh
   mise install npm:wrangler
   ```

   Expected:
    `mise npm:wrangler ✓ installed`.

3. Authorize wrangler against the Cloudflare account that owns the bucket and Worker
   (account email `an@aquati.cat`).
   This opens a browser.

   ```sh
   wrangler login
   ```

   In the browser,
    complete the two-factor prompt and click **Allow** on the
   Cloudflare authorization screen.
   Expected:
    the terminal prints `Successfully logged in.`

4. Confirm the active account.

   ```sh
   wrangler whoami
   ```

   Expected:
    the output table lists the email `an@aquati.cat`.

The Worker is `monochromatic-lfs`,
 the R2 bucket is `monochromatic-lfs`,
and the public Worker URL is `https://monochromatic-lfs.an1298.workers.dev`.
If the bucket does not exist yet (full recreate),
create it once with `cf r2 buckets create --name monochromatic-lfs`
or `wrangler r2 bucket create monochromatic-lfs`.

## Steps

Status:
TODO

### Deploy or redeploy the Worker

1. Run the deploy task from anywhere in the repo.

   ```sh
   mise run "//packages/config/lfs-r2-worker:deploy"
   ```

   Expected:
    the output lists the binding `env.BUCKET (monochromatic-lfs)`,
   then `Deployed monochromatic-lfs triggers` and the URL
   `https://monochromatic-lfs.an1298.workers.dev`.

2. To validate a change without shipping it,
    run the dry run instead.

   ```sh
   mise run "//packages/config/lfs-r2-worker:build"
   ```

   Expected:
    the output ends with `--dry-run: exiting now.` and never prints `Deployed`.

### Set or rotate the upload token

The upload token gates writes to R2.
Rotate it whenever it may have leaked,
or set it on first provisioning.

1. Generate a fresh token and set it as the Worker secret in one step,
   so the value is never printed.

   ```sh
   printf '%s' "$(openssl rand -hex 32)" \
     | mise run "//packages/config/lfs-r2-worker:secret:write-token"
   ```

   The task runs `wrangler secret put LFS_WRITE_TOKEN`.
   Expected:
    `✨ Success! Uploaded secret LFS_WRITE_TOKEN`.

2. Because the value was piped,
    capture it again for the pushing machines that need it.
   Re-run with a value you record in your password manager instead of `openssl`,
   or generate it first into a variable you store,
    then pipe that same variable.
   A rotated token invalidates every machine's previously stored push credential,
   so update each pushing machine (next procedure) after rotating.

   Expected after updating a pushing machine:
    a test push (below) succeeds again.

### Configure a machine to push new images

Downloads are anonymous,
 so only machines that add images need this.
The token lives in local git config,
 never in the committed `.lfsconfig`.

1. Point local git LFS at the Worker with the token embedded as Basic-auth userinfo.
   Replace `<TOKEN>` with the current `LFS_WRITE_TOKEN`.

   ```sh
   git config --local lfs.url "https://lfs:<TOKEN>@monochromatic-lfs.an1298.workers.dev"
   ```

   Expected:
    no output;
   `git config --get lfs.url` then prints the URL.

2. Add an image and push it normally.
   The pre-push hook runs `git lfs push` against the Worker.

   ```sh
   git add path/to/new-image.png
   git commit -m "add new image"
   git push
   ```

   Expected:
    the push log includes a line like
   `Uploading LFS objects: 100% (1/1), ... done`.

## What to check

Status:
TODO

1. The Worker serves a known object with intact bytes.
   This oid is `wolf-s.png` (320 bytes).

   ```sh
   curl --silent \
     "https://monochromatic-lfs.an1298.workers.dev/8a2f3dfd12cbaf3aa59a65937584ce25070bf3be5156dcbc14f0b4920626c0b8" \
     | sha256sum
   ```

   Expected exact output:
   `8a2f3dfd12cbaf3aa59a65937584ce25070bf3be5156dcbc14f0b4920626c0b8  -`

2. A fresh clone resolves LFS from the Worker and verifies clean.

   ```sh
   git clone --depth 1 https://github.com/Aquaticat/Monochromatic /tmp/lfs-check
   cd /tmp/lfs-check && git lfs fsck
   ```

   Expected exact output:
    `Git LFS fsck OK`.

3. The GitHub LFS bandwidth bill drops over the following days.
   In GitHub,
    open **Settings**,
    then **Billing and licensing**,
    then the
   **Git LFS** usage detail,
    and read the daily bandwidth figures.
   Expected:
    the anonymous and unauthenticated bandwidth line trends toward
   `0 GB` per day after the cutover date,
   since raw clones now read `.lfsconfig` and fetch from R2.
   The objects remain in GitHub LFS storage (well under the free `10 GB`),
   so storage stays billed at `$0` and the web UI still renders the images.

## Restore

Status:
TODO

To roll back to GitHub LFS,
 remove the redirect.
Clones immediately fall back to GitHub's stored objects,
because the objects were never purged from GitHub LFS.

1. Delete the redirect and push.

   ```sh
   git rm .lfsconfig
   git commit -m "revert(*): roll LFS back to GitHub"
   git push
   ```

   Expected:
    the commit removes `.lfsconfig`;
   a subsequent fresh clone fetches LFS from GitHub and `git lfs fsck` prints
   `Git LFS fsck OK`.

2. On any machine configured to push,
    drop the local override so it stops using the Worker.

   ```sh
   git config --local --unset lfs.url
   ```

   Expected:
    no output;
   `git config --get lfs.url` then prints nothing.

To tear down the Cloudflare resources entirely (only after rollback),
delete the Worker with `wrangler delete --name monochromatic-lfs`
and the bucket with `cf r2 buckets delete monochromatic-lfs`.
