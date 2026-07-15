# lfs-r2-worker

Git LFS server for this repository,
 backed by Cloudflare R2 and deployed as a
Cloudflare Worker.
 It exists so that clones of this public repo pull LFS objects
from free-egress R2 instead of GitHub's metered LFS bandwidth.

## Why this exists

The repo is public and gets cloned thousands of times per day,
 almost all of it
by bots (clone traffic dwarfs human views by roughly three thousand to one).
Each clone with default git config smudges LFS and pulls the object set,
 and on
GitHub that download is billed to the repo owner.
 Routing LFS through R2 keeps
that traffic on a backend whose egress is free.

The repo-root `.lfsconfig` points every clone at this Worker:

```ini
# .lfsconfig
[lfs]
	url = https://monochromatic-lfs.an1298.workers.dev
```

GitHub still stores the same objects in its own LFS (not purged),
 so the web UI
keeps rendering the images and the GitHub copy stays available as a fallback.
Reverting the migration is just deleting `.lfsconfig`.

## How it works

- Download is anonymous,
   so public `git clone` and `git lfs pull` need no
  credentials and `.lfsconfig` carries no secrets.
- Upload is gated by the `LFS_WRITE_TOKEN` Worker secret.
   git-lfs sends it as
  HTTP Basic auth (any username,
   password is the token).
- Objects live in the `monochromatic-lfs` R2 bucket,
   keyed by their 64-hex
  sha256 oid,
   reached through the Worker's `BUCKET` binding.
   No R2 access keys
  are stored in the repo or in the Worker source.

Routes:

- `POST /objects/batch`:
   the Git LFS batch API;
   returns per-object download or
  upload actions.
- `GET /<oid>`:
   stream an object from R2 (anonymous).
- `PUT /<oid>`:
   store an object in R2 (requires the upload token).

## Deploy

```sh
# from this directory
bunx wrangler deploy

# set or rotate the upload token (prompts for the value on stdin)
bunx wrangler secret put LFS_WRITE_TOKEN
```

The R2 bucket is created once with `cf r2 buckets create --name monochromatic-lfs`
(or `bunx wrangler r2 bucket create monochromatic-lfs`).

## Pushing new images

A machine that adds images needs the upload token in its local git config (not
committed):

```sh
git config --local lfs.url "https://lfs:<LFS_WRITE_TOKEN>@monochromatic-lfs.an1298.workers.dev"
```

With that set,
 the normal flow uploads to R2 automatically,
 because git's
pre-push hook runs `git lfs push`:

```sh
git add path/to/new-image.png
git commit -m "..."
git push
```

The committed `.lfsconfig` stays anonymous;
 the local config override supplies
write credentials only on machines that push.

## CI note

CI in this repo checks out with `lfs: false`,
 so no workflow pulls or pushes LFS
objects and none needs the token.
 If a future workflow commits images (for
example a screenshot regenerator),
 give it `LFS_WRITE_TOKEN` as an Actions
secret and set the authenticated `lfs.url` before `git push`.
