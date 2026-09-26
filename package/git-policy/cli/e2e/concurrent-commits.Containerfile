# What:  image for the cli-git concurrent-commit end-to-end workload replay suite
#        (`mise run //package/git-policy/cli:test:e2e:concurrent`).
# Why:   concurrent mutation of shared Git state is only verified against real repositories
#        (doc/decision/cli-git-concurrent-commits.md, "Container end-to-end verification").
#        Distribution images ship an older Git, so both Git versions under test build from source:
#        - 2.40.0, the first release whose `git merge-tree` accepts `--merge-base`
#          (Documentation/RelNotes/2.40.0.adoc: '"merge-tree" learns a new `--merge-base` option.';
#          `--write-tree` itself arrived in 2.38.0);
#        - 2.55.0, the current release.
#        A third, 2.39.5 (Debian bookworm's Git), sits below that minimum and proves per-feature
#        degradation: its merge-tree lacks `--merge-base`, so a commit that needs replay fails fast.
#        It builds last so the two cached builds above keep their layers.
# Build context: the directory holding the packed tarball (`dist/pack`), passed as TARBALL.
# Checksums: https://www.kernel.org/pub/software/scm/git/sha256sums.asc.
# Every RUN uses exec form: no shell logic lives in this file.

# Node matches the package's `engines.node` floor (^24.11.0).
FROM docker.io/library/node:24.11.0-slim AS git-build

RUN ["apt-get", "update"]
RUN ["apt-get", "install", "--yes", "--no-install-recommends", "build-essential", "zlib1g-dev", "xz-utils", "cargo"]

ADD --checksum=sha256:b17a598fbf58729ef13b577465eb93b2d484df1201518b708b5044ff623bf46d https://www.kernel.org/pub/software/scm/git/git-2.40.0.tar.xz /src/git-2.40.0.tar.xz
ADD --checksum=sha256:457fdb04dc8728e007d4688695e6912e6f680727920f2a40bf11eacc17505357 https://www.kernel.org/pub/software/scm/git/git-2.55.0.tar.xz /src/git-2.55.0.tar.xz

RUN ["tar", "--extract", "--xz", "--file=/src/git-2.40.0.tar.xz", "--directory=/src"]
RUN ["tar", "--extract", "--xz", "--file=/src/git-2.55.0.tar.xz", "--directory=/src"]

# Transport, translation, and scripting-language features are unused by the suite;
# the local bare remote is reached through the file transport.
# Rust stays at 2.55.0's default (enabled, RelNotes/2.55.0.adoc), so Debian's cargo builds it (MSRV 1.49).
RUN ["make", "--directory=/src/git-2.40.0", "--jobs=2", "prefix=/opt/git/2.40.0", "NO_CURL=1", "NO_EXPAT=1", "NO_TCLTK=1", "NO_GETTEXT=1", "NO_PERL=1", "NO_PYTHON=1", "NO_OPENSSL=1", "install"]
RUN ["make", "--directory=/src/git-2.55.0", "--jobs=2", "prefix=/opt/git/2.55.0", "NO_CURL=1", "NO_EXPAT=1", "NO_TCLTK=1", "NO_GETTEXT=1", "NO_PERL=1", "NO_PYTHON=1", "NO_OPENSSL=1", "install"]

ADD --checksum=sha256:c58da92c378df4a986ca33266897a7397e86c22ee266a284d8c2432c39066b59 https://www.kernel.org/pub/software/scm/git/git-2.39.5.tar.xz /src/git-2.39.5.tar.xz
RUN ["tar", "--extract", "--xz", "--file=/src/git-2.39.5.tar.xz", "--directory=/src"]
RUN ["make", "--directory=/src/git-2.39.5", "--jobs=2", "prefix=/opt/git/2.39.5", "NO_CURL=1", "NO_EXPAT=1", "NO_TCLTK=1", "NO_GETTEXT=1", "NO_PERL=1", "NO_PYTHON=1", "NO_OPENSSL=1", "install"]

FROM docker.io/library/node:24.11.0-slim AS consumer

# `ssh-keygen` backs the SSH-signing scenarios.
RUN ["apt-get", "update"]
RUN ["apt-get", "install", "--yes", "--no-install-recommends", "openssh-client"]

COPY --from=git-build /opt/git /opt/git

# The suite imports the workspace package @monochromatic-dev/module-caught-value through its `/ts` source,
# which the run task mounts read-only at /fixture/caught-value. Node resolves /fixture/e2e imports through
# /node_modules; the symlink's real path lies outside node_modules, so Node's type stripping still applies.
RUN ["mkdir", "--parents", "/node_modules/@monochromatic-dev"]
RUN ["ln", "--symbolic", "/fixture/caught-value", "/node_modules/@monochromatic-dev/module-caught-value"]

# The image deliberately has no /usr/bin/git: each scenario selects its Git through PATH order.
WORKDIR /opt/cli-git
RUN ["npm", "init", "--yes"]
ARG TARBALL
COPY ${TARBALL} /fixture/cli.tgz
# Installed at build time because the suite runs with `--network=none`.
RUN ["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund", "/fixture/cli.tgz"]
WORKDIR /work
