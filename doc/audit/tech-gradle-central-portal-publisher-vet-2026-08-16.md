# Gradle Central Portal publisher vet

- Status: in progress
- Lifecycle phase: serious alternatives identified
- Subject: Gradle Central Portal publisher
- Scope: publish `package/linter/kotlin` as
  `cat.aquati.monochromatic:detekt-rules` from GitHub Actions when its version changes on `main`
- Started: 2026-08-16
- Last updated: 2026-08-16
- Governing skill commit: `a05818ad70a40e5769a36de669697ba109891b31`
- Governing skill SHA-256: `393eb68c5b2b2f7b16c8f7f90c100fb8be43eefa4501511360cd0572e4ae8087`
- Compatibility fingerprint:
  `5a88973cda5b584f6cffb1ef0e153f205150af56eef575629097a9d377e135b3`
- Active audit owner: current Pi session
- Prior compatible report: none found

## Context

The package uses Gradle `9.5.1`, Kotlin JVM `2.4.0`, and Java `21` to produce a Detekt rules JAR.
It has no publication plugin, Maven coordinates, or project version.
The accepted extraction plan fixes the release coordinates as
`cat.aquati.monochromatic:detekt-rules` and requires automatic publication when version metadata changes.

The repository has no Maven Central or PGP GitHub Actions secrets.
The user reports that their Maven Central domain namespace is verified.
No local GPG secret key was found.

Sonatype shut OSSRH down on 2025-06-30.
The supported service boundary is now the Central Publisher Portal.
Sonatype does not provide an official Gradle plugin, but documents community plugins and the Portal API.

## Decision context

### Hard constraints

- Publish through the Central Publisher Portal after the OSSRH shutdown.
- Work with Gradle `9.5.1` and Kotlin JVM `2.4.0`.
- Produce required POM metadata, sources JAR, Javadoc JAR, checksums, and PGP signatures.
- Publish automatically only when package version metadata changes on `main`.
- Retain manual dry-run and retry support.
- Use inspectable open-source code at the CI credential boundary.
- Commit no credentials.

### Classification

Each candidate is inspectable open-source local technology.
Each receives the high-trust CI and credential-boundary overlay because it can access a Central token and PGP key.
There is no incumbent publisher.

### Frozen criteria

No relative priority was specified, so each soft criterion has weight `1`.

- Central Portal fit: direct support for bundle upload, validation, and automatic release.
- Integration completeness: amount of project-specific publication and metadata code avoided.
- Auditability: source and dependency surface handling credentials, files, and network requests.
- Compatibility: Gradle, Kotlin JVM, and Java compatibility demonstrated by source or runtime checks.
- Maintenance: current releases, maintainer activity, and release provenance.
- Verification ergonomics: local staging, dry-run, and consumer-boundary support.

Each rating will use the `0` to `4` scale defined by the governing skill.
Hard failures remain outside scoring.

## Discovery

### Frozen query schedule

#### Official ecosystem sources

- Sonatype documentation query:
  `site:central.sonatype.org publish Gradle Central Portal Maven Central official Gradle plugin signing sources javadoc 2026`
- Sonatype requirements query:
  `site:central.sonatype.org Maven Central requirements namespace verified signing GPG token Portal official 2026`
- Gradle Plugin Portal query:
  `site:plugins.gradle.org Maven Central Portal publishing vanniktech nmcp current version`

#### Repository-host sources

- GitHub query:
  `site:github.com/GradleUp/nmcp releases Central Portal Gradle plugin`
- GitHub query:
  `site:github.com/vanniktech/gradle-maven-publish-plugin Central Portal Maven Central releases`
- GitHub query:
  `site:github.com/jreleaser/jreleaser Maven Central Portal Gradle plugin release 2026`

#### Broader web sources

- Comparison query:
  `Gradle Maven Central publishing plugin Central Portal 2026 vanniktech nmcp JReleaser current release Gradle 9 Kotlin JVM`
- JReleaser query:
  `site:jreleaser.org Maven Central Portal Gradle plugin deploy staged repository`

#### Repository sources

- Search publication terms in `.`.
- Inspect `package/linter/kotlin`, `.github/workflows/publish.yml`,
  `.github/workflows/cargo-publish.yml`, and
  `doc/planning/music-player-repository-extraction.md`.

One taxonomy expansion round will cover `deployment bundle`, `Portal Publisher API`,
`OSSRH Staging API`, and `automatic publishing`.
The schedule is then frozen.

### Query record

The official Sonatype searches returned the Gradle community-plugin page,
Portal API, bundle upload, requirements, token generation, GPG, and OSSRH sunset pages.
They established the service boundary and discovered JReleaser, Nmcp, and Vanniktech among other community options.

The plugin and repository searches returned current release pages and documentation for the three candidates.
Exact versions, source revisions, and registry metadata remain to be confirmed from primary repositories and registries.

The repository search found no incumbent Maven publisher.
It found fixed coordinates and release requirements in
`doc/planning/music-player-repository-extraction.md`.

### Candidate ledger

#### Vanniktech Gradle Maven Publish Plugin

- Discovery source: Sonatype Gradle community-plugin list and Gradle Plugin Portal.
- Base category: inspectable open-source local technology.
- Overlay: high-trust CI and credential boundary.
- Screening: serious alternative.
- Reason: combines Maven publication metadata, sources, documentation, signing, and Central Portal release tasks.

#### GradleUp Nmcp

- Discovery source: Sonatype Gradle community-plugin list and GitHub search.
- Base category: inspectable open-source local technology.
- Overlay: high-trust CI and credential boundary.
- Screening: serious alternative.
- Reason: focuses on collecting Maven publications into Central Portal bundles and uploading them.

#### JReleaser

- Discovery source: Sonatype's named Gradle option and JReleaser documentation.
- Base category: inspectable open-source local technology.
- Overlay: high-trust CI and credential boundary.
- Screening: serious alternative.
- Reason: stages Gradle Maven publications and deploys them through the Portal Publisher API.

## Evidence records

### Sonatype Central Publisher Portal

- Candidate: shared service boundary.
- Claim: OSSRH is unavailable and Portal-compatible publication is required.
- Gate: category fit and hard constraint.
- Status: pass.
- Primary source: <https://central.sonatype.org/pages/ossrh-eol/>, accessed 2026-08-16.
- Evidence: Sonatype states that OSSRH reached end of life and was shut down on 2025-06-30.
- Outcome: legacy OSSRH-only configurations are ineligible.

- Candidate: shared service boundary.
- Claim: Maven Central requires sources, Javadoc, PGP signatures, checksums, and complete POM metadata.
- Gate: hard constraint.
- Status: pass.
- Primary source: <https://central.sonatype.org/publish/requirements/>, accessed 2026-08-16.
- Outcome: every finalist must generate and validate the complete file set.

- Candidate: shared service boundary.
- Claim: Sonatype has no official Gradle plugin and labels Gradle options as unsupported community plugins.
- Gate: provenance and support evidence.
- Status: scored concern.
- Primary source: <https://central.sonatype.org/publish/publish-portal-gradle/>, accessed 2026-08-16.
- Outcome: every finalist needs source and consumer-boundary validation rather than relying on vendor support.

## Execution manifests

No candidate code has been executed yet.
Source cloning and static inspection precede any Gradle plugin execution.

## Hard-gate outcomes

No candidate has failed a hard gate yet.

## Validation results

Pending.

## Scoring and sensitivity

Pending equal-depth finalist validation.

## Pros, cons, and ranking

Pending equal-depth finalist validation.

## Recommendation

No recommendation while source audit, runtime validation, scoring, and sensitivity remain incomplete.
