# Render LFS-backed README images on GitHub

Status:
investigation complete,
grilling round 1 open.
Tracks GitHub issue #476.

Last updated:
2026-09-06.

## Question from the issue

Can GitHub README rendering resolve Git LFS objects that live behind the repo's custom LFS backend
(`https://monochromatic-lfs.an1298.workers.dev`,
see `doc/runbook/lfs-r2-worker.md`)?

Answer:
no.
GitHub's Markdown renderer rewrites relative image links to `/<owner>/<repo>/raw/<ref>/<path>`.
For an LFS pointer that endpoint redirects to `media.githubusercontent.com` only when the object exists in
GitHub-hosted LFS storage.
GitHub never reads `.lfsconfig`.
docs.github.com carries no statement that github.com can fetch from a third-party LFS server,
and the 2015 GitHub blog post introducing LFS support says GitHub retrieves the asset from "the LFS server",
meaning its own store.

## Evidence

- `.gitattributes` routes `*.png`,
  `*.jpg`,
  `*.jpeg`,
  `*.gif`,
  `*.webp`,
  `*.heif`,
  `*.avif`,
  and `*.jxl` through `filter=lfs`.
- `.lfsconfig` was added in commit `933145128` (2026-06-16),
  redirecting every clone to the Worker.
- The gallery under `package/music-player/asset/readme/` was committed on 2026-09-03 (`862ea00bf`, `ddf896a5c`),
  after the cutover,
  so its objects were uploaded only to R2.
- A GET of the gallery pointer through `raw.githubusercontent.com` returns the pointer text as `text/plain`;
  `media.githubusercontent.com` returns 404 for the same path.
- A pre-cutover image (`package/intellij-plugin/islands-black/screenshot/islands-black.png`)
  redirects to `media.githubusercontent.com` and returns `image/png`.
- Browser check with `agent-browser` on github.com:
  the islands-black README image renders (positive control);
  every gallery image on the music-player README is broken (25 of 25).
- Probing every LFS file at HEAD against `media.githubusercontent.com`:
  110 files,
  36 present (all pre-cutover),
  74 absent.
  Every absent file is under `package/music-player/` (about 11 MB);
  the README gallery is 25 of them (about 4.2 MB).
- Only one other Markdown file in the repo embeds a raster image (`package/intellij-plugin/islands-black/README.md`),
  and it predates the cutover.
- Anonymous download from the Worker works:
  `POST /objects/batch` returns a download action and `GET /<oid>` streams bytes.
  The Worker has no HEAD handler (404) and serves `application/octet-stream`.
- The git pack is 197 MiB (`git count-objects --verbose`).

## Documentation defects found

Both `package/config/lfs-r2-worker/README.md` and `doc/runbook/lfs-r2-worker.md` claim that GitHub still stores
every object,
so the web UI keeps rendering images and deleting `.lfsconfig` rolls back cleanly.
That was true only for objects uploaded before the cutover.
Rollback today would leave `git lfs fsck` failing on 74 objects.
Both documents need correcting regardless of the chosen fix.

`doc/planning/music-player-repository-extraction.md` never mentions LFS or `.gitattributes`,
so the future `Aquaticat/music-player` repository has no decided image store.

## External facts from primary sources

- git-lfs has no native multi-endpoint push.
  The documented shape is a second remote carrying `remote.<name>.lfsurl`,
  then a separate `git lfs push <name> --all`.
  Git configuration overrides `.lfsconfig`.
  Source:
  `docs/man/git-lfs-config.adoc` and `docs/man/git-lfs-push.adoc` in git-lfs.
- GitHub LFS free plan:
  10 GiB storage and 10 GiB bandwidth per month,
  metered;
  downloads count against the repository owner;
  with a zero budget,
  overage blocks GitHub LFS for the rest of the month.
  Web views are not documented either way.
  Source:
  <https://docs.github.com/en/billing/concepts/product-billing/git-lfs>.
- A later `.gitattributes` line such as `package/*/asset/readme/*.png !filter !diff !merge` overrides `*.png`.
  git-lfs itself emits this form in `commands/command_migrate_export.go`.
  Re-adding files converts them without rewriting history.
- GitHub proxies README images through camo,
  which rejects non-`image/*` content types and defaults to a 5 MiB cap
  (`atmos/camo` README and `mime-types.json`;
  the production settings are not documented).
- Cloudflare Workers free plan:
  100,000 requests per day,
  then Error 1027.
  Source:
  <https://developers.cloudflare.com/workers/platform/limits/>.

## Options

### A. Mirror LFS objects to GitHub LFS

Keep `.lfsconfig` on R2 for clones.
Pushing machines also push LFS objects to GitHub's LFS endpoint through a second remote.
Backfill the 74 absent objects now.

Pros:
README source unchanged;
no history growth;
stays inside the existing LFS policy;
repairs the broken rollback path;
clean handoff at extraction because the objects are local.

Cons:
a second write per push that needs automation plus a guard;
GitHub LFS storage and per-view bandwidth use;
a blocked month regresses README rendering to today's state while clones keep using R2.

### B. Plain git blobs for Markdown-embedded images

Add a `.gitattributes` negation for `**/asset/readme/**` and re-add the gallery as blobs.

Pros:
no moving parts;
renders on GitHub,
forks,
mirrors,
and the extracted repository.

Cons:
about 4.2 MB enters the pack now and again on every regeneration,
permanently;
carves an exception into the LFS policy;
every bot clone downloads it.

### C. Absolute Worker URLs in the README

Use oid URLs or add a path-resolving Worker route,
plus content-type sniffing and HEAD support.

Pros:
nothing stored twice;
free egress.

Cons:
README stops using relative links;
public docs hard-code a `workers.dev` hostname that cannot move to `aquati.cat` on the free plan
(`doc/troubleshooting/cloudflare-mirror-evaluation.md`);
Worker code and tests grow;
the extracted repository would depend on Monochromatic's Worker;
README views draw on the Worker's daily request ceiling.

### D. Host gallery copies on the aquati.cat site

Pros:
owned domain.

Cons:
docs coupled to SSG deploys;
duplicate copies;
same README divergence as C.

### E. Delete `.lfsconfig` and return to GitHub LFS

Reverses the metered-bandwidth decision the Worker exists for.

### Ranking

A > B > C > D > E.
A over B because B grows every clone permanently per regeneration while A keeps binaries out of history and fixes rollback.
B over C because B has no runtime dependency and C pins a `workers.dev` hostname into public docs.
C over D because C reuses existing infrastructure.
D over E because E reintroduces the clone bandwidth bill.

## Open questions

1.  Which public-asset boundary (A to E)?
    Recommended:
    A.
2.  Image store for the extracted `Aquaticat/music-player` repository:
    GitHub LFS,
    the shared R2 Worker,
    or plain blobs?
    Recommended:
    GitHub LFS,
    recorded in the extraction plan.
3.  Restore the documented rollback invariant by mirroring all 74 absent objects,
    or rewrite the runbook to say rollback requires a re-push first?
    Recommended:
    mirror all 74.

Pending on those answers:
where the mirroring step lives (pre-push hook,
`git-policy-cli`,
or a mise task),
the regression guard,
and the browser-level verification the issue requires.

## Evidence commands

```sh
# doc/planning/lfs-readme-image-rendering.md
git show HEAD:package/music-player/asset/readme/android-page-controls.png | head --lines 3
git lfs ls-files --long --size
curl --silent --location --output /dev/null --write-out '%{http_code} %{content_type} %{url_effective}\n' \
  'https://github.com/Aquaticat/Monochromatic/blob/main/package/music-player/asset/readme/desktop-wide-empty.png?raw=true'
curl --silent --head 'https://monochromatic-lfs.an1298.workers.dev/<oid>'
git count-objects --verbose --human-readable
```
