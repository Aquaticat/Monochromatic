# Release the music player

Use this to publish a GitHub pre-release of the music player (`package/music-player`),
to rehearse one with a dry run,
to recover when a release run fails,
and to rotate or restore the Android signing key.
The design and its reasons are in `doc/decision/music-player-releases.md`.
The workflow is `.github/workflows/music-player-release.yml`.

## What a release is

One release holds one file per platform and a checksum file:

- `music-player-<version>-windows-x64.exe` and `music-player-<version>-windows-arm64.exe`
- `music-player-<version>-macos-arm64.dmg` (there is no Intel Mac build)
- `music-player-<version>-linux-x64.tar.gz` and `music-player-<version>-linux-arm64.tar.gz` (glibc)
- `music-player-<version>-linux-musl-x64.tar.gz` and `music-player-<version>-linux-musl-arm64.tar.gz` (Alpine, musl)
- `music-player-<version>-android.apk`
- `SHA256SUMS`

The tag is `music-player-v<version>`.
Every release is flagged as a pre-release.
Every file is attested with GitHub build provenance.

Releases are immutable in this repository (a repository setting).
After a release is published,
its tag and its files can never be replaced or added to,
so a bad release is fixed only by releasing a higher version.
This is why the first real release of a new version is a deliberate act and not an experiment.

## The version

The product has one version.
Its single source is the `version` line of the `[package]` table in
`package/music-player/desktop-app/Cargo.toml`.
The Android app reads it at build time:
`versionName` is the version,
and `versionCode` is `major * 10000 + minor * 100 + patch` (version `0.1.0` is code `100`, `1.2.3` is code `10203`).

The rules the workflow enforces, and fails loudly on:

- The version is plain `MAJOR.MINOR.PATCH`, with minor and patch at most 99.
  A suffix such as `-beta.1` is refused, because it would give two versions the same Android code.
- `package/music-player/android-app/rust/Cargo.toml` carries the same version.
  Bump both files together; the run fails on a mismatch.
- On a push, the new version is higher than the old one.

## Cut a release

1.  Pick the new version and edit both manifests by hand:
    the `version` line in `package/music-player/desktop-app/Cargo.toml`
    and the one in `package/music-player/android-app/rust/Cargo.toml`.
    Both files are managed by `file-enforcer`, but it does not own `version`:
    `buildCargoManifestPlan` in `file-enforcer.config.ts` lists edition, license, publish, lints, shared dependencies,
    repository, readme, homepage and profiles, and in a throwaway checkout with both versions bumped
    `node file-enforcer.config.ts` left the bumps in place.
    Run it after the edit anyway, as for any manifest change, and commit whatever it rewrites.
2.  Refresh both lock files without touching any dependency,
    because the release builds with `--locked` and fails on a stale `Cargo.lock`:
    run `cargo update --workspace` in `package/music-player/desktop-app`
    and in `package/music-player/android-app/rust`.
    Each lock file changes by exactly one line (the crate's own `version` in its `[[package]]` entry;
    checked offline on both crates, and `cargo metadata --locked --offline` then resolves).
3.  Commit the four files and merge to `main`.
    A push to `main` that changes either manifest starts the workflow.
    The detect job compares the old and new version and starts the build only if the version changed.
4.  Watch the run:
    `gh run list --workflow music-player-release.yml` and `gh run watch <run id>`.
    A full run is the desktop builds (the two Alpine builds are the slowest, because they are never cached)
    in parallel with the Android build,
    then a checksum job and the release job.
5.  Open the release page `https://github.com/Aquaticat/Monochromatic/releases/tag/music-player-v<version>`
    and check that every file listed above and `SHA256SUMS` are attached and that it is marked as a pre-release.
6.  Verify one file as a user would (see the section on verifying attestations).

If the tag already exists when the run starts,
the run skips the release and succeeds with a notice.
It never overwrites a tag.

## The first release of an existing version

The version `0.1.0` was in `main` before the workflow existed,
so no push will ever release it:
a push releases only when the version changes.
Release it by dispatching a real run from `main`,
after a dry run has passed on `main`:

```bash
# Rehearsal first: builds and signs everything, creates nothing.
gh workflow run music-player-release.yml --ref main --field dry-run=true

# The real release. Immutable: do this only after the dry run is green and you have read its output.
gh workflow run music-player-release.yml --ref main --field dry-run=false
```

## Dry run

A dry run builds, packages and signs every file,
runs the same checks as a real run,
uploads the files as workflow artifacts that expire after one day,
and prints in the `release` job log the exact `gh release create` command,
the tag, the asset list and the release notes it would use.
It skips attestation and creates no tag and no release.

Start one with `gh workflow run music-player-release.yml --ref <branch> --field dry-run=true`
(the workflow file must exist on `main` before `gh workflow run` can find it).
On any ref other than `main` the Android app is signed with a throwaway key made for that run,
and the run refuses `dry-run=false`.
On `main` a dry run signs with the real release key, so the signing path is proven without publishing.

Download a dry run's files with `gh run download <run id> --dir <new empty directory>`.
Each `asset-*` artifact becomes a subdirectory.

Check the Alpine files of a dry run in a second new empty directory:

```bash
# Extract the x64 Alpine archive, then print the program interpreter of its binary.
tar --extract --gzip --file <download dir>/asset-linux-musl-x64/music-player-<version>-linux-musl-x64.tar.gz \
  --directory <extract dir>
readelf --program-headers <extract dir>/music-player-<version>-linux-musl-x64/bin/music-player
```

The interpreter line must read `/lib/ld-musl-x86_64.so.1`,
and `file` on the arm64 binary must say `ARM aarch64`.
The job has already started both binaries with `--version` in an Alpine image that holds only the packages of
`INSTALL.txt`.
To repeat that by hand,
mount the binary into `alpine:3.24`, run the `apk add` line of `INSTALL.txt` first,
and bound the container with `podman run --memory=2g --cpus=2 --rm`.

## When a job fails

Before the release job started,
nothing is published.
Read the failure with `gh run view <run id> --log-failed`,
fix the cause on a branch,
merge,
and start a new run (a dispatch of the same version, or the next push).
`gh run rerun <run id> --failed` also works for a transient failure of a build job,
unless the failed job had already uploaded its file:
the upload then conflicts with the earlier one and a fresh dispatch is needed.

The release job can fail after it started.
Look at `gh release list --repo Aquaticat/Monochromatic`:

- No entry,
  or a draft entry:
  nothing was published.
  Delete a draft with `gh release delete music-player-v<version> --yes`,
  check that `git ls-remote --tags origin music-player-v<version>` prints nothing,
  and dispatch again.
- A published entry with missing or wrong files:
  it cannot be repaired,
  because the release is immutable and its tag is reserved even if you delete the release.
  Release the next patch version instead,
  and state in that release's notes that the previous version is broken.

## Caches

The build jobs restore cargo, target and Gradle caches (keys that start with `music-player-`),
so a run after a small change takes minutes and not tens of minutes.
Only runs on `main` and manual dispatches save them.
A changed lock file starts from the previous entry and rebuilds only what changed.
The entries together are about 4 GB, against the repository's 10 GB cap.
The two Alpine release jobs (`build-desktop-musl`) cache nothing:
every run builds them from a clean registry and target directory,
so they take the same time on every run,
and the repository's cap is not spent on them.

```bash
# List the entries with their sizes.
gh cache list --repo Aquaticat/Monochromatic --key music-player- --limit 50

# Delete one entry, for example when it is suspected to be bad.
gh cache delete <key> --repo Aquaticat/Monochromatic
```

To invalidate every entry at once,
change `v1` in the `key` and `restore-keys` of the cache steps of the workflow.
The log of each build job prints a notice titled `cache` with `exact_hit` and the matched key.

## The Android signing key

The release key signs every Android release.
Android installs an update only if it is signed by the same key as the installed app,
so the key must never be lost or replaced casually.

Where it lives:

- Four repository secrets in `Aquaticat/Monochromatic`:
  `MUSIC_PLAYER_KEYSTORE_BASE64` (the PKCS12 keystore, base64),
  `MUSIC_PLAYER_KEYSTORE_PASSWORD`,
  `MUSIC_PLAYER_KEY_ALIAS` (`music-player-release`),
  and `MUSIC_PLAYER_KEY_PASSWORD`.
  A PKCS12 keystore uses one password for the store and the key, so the two password secrets hold the same value.
  Secrets cannot be read back from GitHub.
- A backup outside GitHub:
  the keystore file and a text file with its alias and password,
  made on 2026-10-14 in `~/.local/share/music-player-release-keys` on the maintainer's primary machine
  (directory mode 700, files mode 600).
  Copy both into the password manager and keep them there.
- The public certificate fingerprint is written in the workflow as `EXPECTED_ANDROID_CERT_SHA256`.
  A real release fails if the APK carries any other certificate.
  Print the fingerprint of a keystore with `keytool -list -v -keystore <file>`.

If the key is lost,
every installed copy of the app can no longer be updated:
users must uninstall (losing the app's settings and caches) and install the new build.
Restore from the backup first;
only if the backup is gone,
create a new key:

1.  Generate a keystore with the command below.
    Give the passwords with `-storepass:file` and `-keypass:file` pointing at a mode 600 file,
    never on the command line.

    ```bash
    keytool -genkeypair -alias music-player-release -keyalg RSA -keysize 4096 -validity 36500 \
      -dname 'CN=Music Player release, O=Monochromatic' -storetype PKCS12 -keystore <file> \
      -storepass:file <password file> -keypass:file <password file>
    ```
2.  Set the four secrets with `gh secret set <name> --repo Aquaticat/Monochromatic < <file>`
    (the keystore secret is the base64 of the file).
3.  Replace `EXPECTED_ANDROID_CERT_SHA256` in the workflow with the new certificate fingerprint.
4.  Back up the new keystore and passwords as described above.
5.  State in the next release's notes that the signing key changed and that the app must be reinstalled.

If the key may have leaked,
rotate it the same way at once and delete the old secrets.

## Verifying attestations

Each file carries build provenance that binds its bytes to this workflow run and commit:

```bash
# Verify one downloaded file; fails if the bytes were changed after the workflow built them.
gh attestation verify music-player-<version>-linux-x64.tar.gz --repo Aquaticat/Monochromatic

# Compare the whole set with the checksum file (verify SHA256SUMS itself the same way).
sha256sum --check --ignore-missing SHA256SUMS
```

Dry runs are not attested.

## Platforms that are not tested

The project has run only the Linux x86_64 build and the Android app on emulators.
The Windows and macOS programs and the Linux arm64 build are built by CI and started with `--version` there,
and nothing more.
The Alpine builds are started with `--version` in an Alpine container in the release run;
a separate workflow (`.github/workflows/music-player-alpine.yml`) runs the unit tests and a headless window and sound
check in Alpine containers on both architectures, on debug builds and not on the released files.
No real Alpine machine has run them.
No build has run on a real Android device.
A bug report from one of these platforms is the first evidence about it.
