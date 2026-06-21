# Pitchfork should complement systemd, not replace it

Audit date:
 2026-06-21.
Verdict:
 use Pitchfork instead of writing direct systemd units only for
project-scoped,
 developer-owned daemons where the missing feature is workflow,
not host supervision.
 Use systemd for production services,
 privileged host
services,
 boot-critical processes,
 sandboxing,
 cgroup policy,
 socket activation,
and anything an operator must reason about after the project shell is gone.

## Trigger

The question was when someone should use Pitchfork instead of systemd,
 with the
explicit constraint not to repeat Pitchfork's own marketing.
 I treated Pitchfork
as a process supervisor to vet,
 not as a systemd replacement claim to accept.

## Method

I used the `choosing-technology` process and checked primary sources plus source
code.

- Pitchfork source clone:
   `/tmp/agent/pitchfork-20260621`,
   commit
  `abda898f5ed894277170a97a92309f0b39516fb8`.
- Pitchfork docs and source read:
   `README.md`,
   `docs/concepts/architecture.md`,
  `docs/concepts/how-it-works.md`,
   `docs/reference/configuration.md`,
  `docs/guides/boot-start.md`,
   `docs/reference/file-locations.md`,
  `src/boot_manager.rs`,
   `src/ipc/server.rs`,
   `src/ipc/client.rs`,
  `src/supervisor/lifecycle.rs`,
   `src/supervisor/retry.rs`,
  `src/supervisor/watchers.rs`,
   `src/log_store/sqlite.rs`,
  `src/proxy/trust.rs`,
   `.github/workflows/ci.yml`,
   and `mise.toml`.
- systemd primary references checked:
   `systemd.service`,
   `systemd.unit`,
  `systemd.exec`,
   `systemd.resource-control`,
   `systemd.timer`,
   `systemd.path`,
  `systemd.socket`,
   and `systemd-run` from freedesktop's manual pages.
- Alternative tool references checked:
   Docker Compose,
   PM2,
   Foreman,
   and
  Overmind,
   enough to place Pitchfork in the category rather than compare it
  only with systemd.
- Validation run:
   after the first `mise run test` failed because the cloned
  `mise.toml` was not trusted,
   I trusted only the clone under an isolated home
  and reran `mise run test`.
   It built the UI bundle,
   ran `cargo nextest run`,
  then ran the Bats suite.
   The success evidence is the later process exit 0,
  not the stale trust error line at the start of the combined log:
   525 nextest
  tests passed,
   8 were skipped,
   32 Bats tests passed,
   175.52 seconds.

## What Pitchfork actually is

Pitchfork is a user-facing supervisor daemon with a CLI client.
 The CLI reads
project and global TOML config,
 then talks to a background supervisor over a Unix
socket at `~/.local/state/pitchfork/sock/main.sock`.
 The supervisor starts,
stops,
 watches,
 retries,
 logs,
 and schedules configured daemons.
 State lives in
`~/.local/state/pitchfork/state.toml`,
 and logs live in an SQLite database under
`~/.local/state/pitchfork/logs/logs.db` ([architecture][pitchfork-architecture],
[file locations][pitchfork-files]).

That architecture is not systemd's architecture.
 systemd is the OS service
manager and unit graph.
 Pitchfork is another supervisor process that can be
started by the user,
 by a shell hook,
 or by boot integration.
 On Linux,
Pitchfork's own boot integration writes a systemd user service or systemd system
service ([boot start][pitchfork-boot];
 source path `src/boot_manager.rs`).
 That
means Pitchfork at boot is not replacing systemd;
 it is a child supervisor
launched by systemd.

## When Pitchfork is the better fit

Use Pitchfork when these are the actual requirements.

### Project-local development daemons

Pitchfork fits local development stacks where the unit of ownership is a repo,
not a host.
 A `pitchfork.toml` in the project can define the API server,
 worker,
database,
 frontend server,
 file sync process,
 and local helper tasks together.
That is a better shape than scattering developer-only units across
`~/.config/systemd/user/` or `/etc/systemd/system/`.

The important point is not that systemd cannot run these processes.
 systemd can
run user services and transient services.
 The point is that Pitchfork makes the
project directory the control plane.

### Directory-aware auto start and stop

Pitchfork has shell-hook behavior that starts daemons when entering a project and
stops them when leaving.
 systemd has user units,
 targets,
 timers,
 path units,
 and
transient units,
 but it does not make `cd into this repository` and `cd away from
this repository` the main lifecycle primitive.

Choose Pitchfork when process lifetime should follow active development context.
Choose systemd when lifetime should follow the machine,
 login session,
 user
manager,
 target,
 timer,
 socket,
 or dependency graph.

### Readiness checks for programs that do not speak systemd

Pitchfork supports readiness checks by delay,
 output pattern,
 HTTP endpoint,
 TCP
port,
 and shell command.
 That is useful for developer services whose startup
signal is an HTTP health check,
 a log line,
 or an open port.

systemd has OS-native readiness when the daemon implements `sd_notify` and uses
`Type=notify` or `Type=notify-reload`;
 systemd waits for `READY=1` before
considering that service started ([systemd.service][systemd-service]).
 It also
supports ordering through `Before=` and `After=`,
 and `ExecStartPost=`
participates in ordering.
 But for ordinary dev servers that do not emit
`READY=1`,
 Pitchfork's readiness modes are lower ceremony.

### One command for a whole dev graph

Pitchfork's `depends` starts daemon dependencies first,
 waits for readiness,
 and
can start independent dependents in parallel.
 That maps well to app stacks where
`api` depends on `postgres` and `redis`,
 while `worker` depends on the same
backend services.

systemd has a richer dependency vocabulary:
 `Wants=`,
 `Requires=`,
 `BindsTo=`,
`PartOf=`,
 `Before=`,
 `After=`,
 conditions,
 targets,
 and unit templates.
 That
vocabulary is better for host policy.
 Pitchfork's dependency model is easier to
carry in a project config when the graph is a development convenience.

### File-change restarts owned by the supervisor

Pitchfork has first-class file watching with native,
 polling,
 and automatic
fallback modes.
 It restarts only running daemons whose patterns match changed
paths.
 That is a direct fit for local servers that need restart-on-change but do
not already have reliable watch mode.

systemd path units can activate units on filesystem changes,
 but they are not a
project dev-server hot-reload model.
 If the desired behavior is "restart this
running project daemon when `src/**/*.ts` changes",
 Pitchfork is closer to the
intent.

### Developer UI, logs, and agent integration are part of the requirement

Pitchfork includes a TUI,
 web UI,
 log querying,
 and an MCP server.
 If the reason
for adopting it is "developers and local agents need a common control surface for
this repo's daemons",
 those features matter.

If those features are not used,
 they are not free.
 They add runtime behavior,
configuration surface,
 and dependencies that a direct systemd unit does not add.

## When systemd is still the better fit

Use systemd directly for these cases.

### Production or host-critical services

If the service matters to the machine,
 other users,
 boot,
 shutdown,
 recovery,
 or
operations,
 use systemd.
 systemd is the service manager operators already inspect
with `systemctl` and `journalctl`.
 It owns the unit graph,
 restart rate limiting,
watchdogs,
 failure actions,
 socket activation,
 timers,
 path activation,
 cgroups,
resource accounting,
 sandboxing,
 dynamic users,
 capabilities,
 credentials,
 and
unit drop-ins ([systemd.service][systemd-service],
[systemd.unit][systemd-unit]).

Pitchfork can supervise a production process,
 but on Linux it still needs to be
launched by systemd for boot.
 That adds an extra supervisor and an extra state
model between the OS and the actual service.

### Security hardening and least privilege

systemd has first-class hardening controls in `systemd.exec`:
 `DynamicUser=`,
`NoNewPrivileges=`,
 `CapabilityBoundingSet=`,
 `AmbientCapabilities=`,
`ProtectSystem=`,
 `ProtectHome=`,
 `PrivateTmp=`,
 `PrivateDevices=`,
`PrivateNetwork=`,
 filesystem allow lists,
 AppArmor and SELinux labels,
 and more.
It also has cgroup resource controls in `systemd.resource-control`,
 including
`CPUWeight=`,
 `CPUQuota=`,
 `MemoryHigh=`,
 `MemoryMax=`,
 `TasksMax=`,
 I/O
controls,
 network accounting,
 and BPF-backed filters
([systemd.exec][systemd-exec],
 [systemd.resource-control][systemd-resource]).

Pitchfork has useful resource limits and can switch users in some modes,
 but it
is not a substitute for systemd's sandboxing and cgroup policy surface.

### Socket, timer, path, and transient unit integration

systemd socket units can activate services from sockets.
 Timer units handle
calendar and monotonic schedules.
 Path units can activate units from filesystem
changes.
 `systemd-run` can create transient services,
 scopes,
 paths,
 sockets,
 and
timers from the command line,
 including user-mode services with `--user`
([systemd-run][systemd-run]).

If the need is "run this command under the OS service manager" or "create a
transient background unit",
 try `systemd-run --user --property=Type=exec ...`
before adding Pitchfork.

### Privileged daemons and shared hosts

Pitchfork supports `sudo pitchfork boot enable`,
 root-level boot registration,
low-port proxy binding,
 and system trust-store certificate installation for its
proxy.
 Those are real host changes.
 For shared or privileged machines,
 direct
systemd units are easier to audit because the policy stays in the OS unit file
instead of being split between systemd,
 Pitchfork settings,
 Pitchfork state,
 and
project TOML.

If Pitchfork is used on a shared machine,
 disable unused proxy features and review
`proxy.auto_trust`.
 In the audited source,
 `proxy.auto_trust` defaults to true;
on Linux,
 certificate installation requires write access to the system CA
directory,
 typically through `sudo` ([port management][pitchfork-port];
 source
path `settings.toml`,
 `src/proxy/trust.rs`).

### Dependency and audit surface

Pitchfork has a measurable audit surface.
 At the audited commit,
 `tokei` counted
33,271 Rust code
lines and 1,044 TypeScript code lines outside `target` and `dist`;
 `find` counted
92 Rust source files and 23 UI source files.
 `Cargo.toml` declared 75 direct
Cargo dependencies when target-specific sections are included,
 and `cargo
metadata` reported 557 normal transitive package nodes across targets.

That is reasonable for a featureful dev supervisor,
 but it is extra surface for a
service that systemd can express in one unit file.
 For security-sensitive or
operator-owned daemons,
 extra supervisor surface must buy something concrete.

## Alternative tools

Pitchfork is not the only answer between `systemd` and hand-managed shell jobs.

### Docker Compose

Pros:
 best fit when containers are already the boundary,
 because service
configuration,
 networks,
 volumes,
 and health-based startup ordering live with the
container graph.

Cons:
 it adds containers when the target processes are ordinary host tools or dev
servers.
 If the goal is to supervise non-container commands in a repo,
 Compose
solves a different problem.

### PM2

Pros:
 mature process manager for Node-oriented apps,
 with restart and process
listing workflows.

Cons:
 its center of gravity is Node applications.
 Pitchfork is a better fit when
the same repo needs to supervise Redis,
 Postgres,
 a Bun server,
 a Rust watcher,
rsync,
 and arbitrary shell commands together.

### Foreman and Overmind

Pros:
 both fit Procfile-style development sessions.
 They are good when the whole
need is "start several commands together and see logs".

Cons:
 Pitchfork has a broader daemon model:
 background supervisor,
 readiness
checks,
 dependency ordering,
 file watching,
 cron-like scheduling,
 persistent log
querying,
 shell-hook auto start/stop,
 TUI,
 web UI,
 MCP,
 and boot integration.
 If
those broader features are not needed,
 Foreman or Overmind may be enough.

### Ranking under these assumptions

For a project-local development stack with non-container commands,
 my ranking is:
Pitchfork over Foreman or Overmind over PM2 over Docker Compose over direct
systemd units.
 Pitchfork beats Foreman or Overmind when readiness,
 dependencies,
watching,
 persistent background daemons,
 or shell-directory lifecycle matter.
Foreman or Overmind beat PM2 when the repo is not Node-only.
 PM2 beats Compose
for host Node processes because it does not require containerizing them.
 Compose
beats direct systemd units only when the project already wants container
boundaries.

For production or shared host services,
 my ranking reverses at the top:
 systemd
over Docker Compose over Pitchfork over PM2 over Foreman or Overmind.
 systemd
wins because it is the host service manager and security boundary.
 Compose comes
next when containers are the deployment boundary.
 Pitchfork comes after those
because it adds a supervisor under the host manager.
 PM2 is acceptable only for
Node-specific operational standards.
 Foreman and Overmind are development
session tools under this audit's assumptions;
 I did not treat them as
production host supervisors without a separate production-source audit.

## Maintenance and verification

Pitchfork has active public maintenance signals,
 but it is still young.

- Repository metadata from GitHub on 2026-06-21:
   `jdx/pitchfork`,
   MIT license,
  created 2024-12-06,
   515 stars,
   29 forks,
   latest release `v2.13.1` published
  2026-06-08,
   pushed 2026-06-19,
   Issues disabled,
   Discussions enabled.
- Recent releases are frequent:
   `v2.5.0` on 2026-04-10 through `v2.13.1` on
  2026-06-08 in the twelve-release sample I checked.
- PR activity is live:
   11 open PRs in `gh pr list` on 2026-06-21,
   with merged PRs
  from jdx,
   iain,
   disintegrator,
   and Renovate in the prior days.
- Contributor concentration is real:
   GitHub contributor data showed jdx with 192
  commits,
   Renovate with 150,
   gaojunran with 75,
   and the next human contributor
  at 8 commits in the shallow metadata view.

Test coverage is meaningful for the core supervisor.
 The audited test run covered
nextest unit and integration tests,
 plus Bats CLI tests for config,
 hooks,
 logs,
and port behavior.
 I found e2e tests for retry,
 stop behavior,
 dependencies,
watch mode,
 cron,
 logs,
 namespace,
 proxy,
 pty,
 hooks,
 and migrations.
 I did not
find evidence of fuzzing,
 property testing,
 or mutation testing in the repo;
 the
search hits for `arbitrary`,
 `fuzz`,
 `proptest`,
 `quickcheck`,
 `cargo-fuzz`,
 AFL,
and mutation tooling were either unrelated dependency names or ordinary prose.

## Decision rules

Use Pitchfork instead of systemd when all of these are true:

- The process set is owned by a project or developer workflow,
   not by host
  operations.
- The value comes from Pitchfork-specific workflow features:
   directory auto
  start/stop,
   readiness checks without `sd_notify`,
   file-watch restarts,
  project-local daemon config,
   persistent dev logs,
   TUI/web UI,
   or MCP control.
- The daemons can tolerate an extra user-space supervisor and Pitchfork's state
  model.
- Operators will not need to diagnose the service primarily through systemd's
  unit graph,
   journal,
   cgroups,
   and security policy.

Use systemd directly when any of these are true:

- The service is production,
   boot-critical,
   privileged,
   security-sensitive,
   or
  shared across users.
- The requirement is socket activation,
   timers,
   path units,
   watchdogs,
   cgroup
  policy,
   sandboxing,
   dynamic users,
   credentials,
   or OS-native failure actions.
- The service must be understandable to standard Linux operations tooling without
  a project-specific supervisor in the middle.
- A single `.service` or `systemd-run --user` command expresses the need without
  losing important developer workflow.

The shortest version:
 Pitchfork is worth using when systemd's host-service model
is too global for a repo-local development graph.
 It is not worth using merely to
avoid learning systemd for services that actually belong to the host.

## References

- Pitchfork docs:
   [README][pitchfork-readme],
   [architecture][pitchfork-architecture],
  [how it works][pitchfork-how],
   [configuration][pitchfork-config],
  [boot start][pitchfork-boot],
   [file locations][pitchfork-files],
  [port management][pitchfork-port].
- Pitchfork source:
   [jdx/pitchfork][pitchfork-repo],
   audited locally at commit
  `abda898f5ed894277170a97a92309f0b39516fb8`.
- systemd docs:
   [systemd.service][systemd-service],
   [systemd.unit][systemd-unit],
  [systemd.exec][systemd-exec],
   [systemd.resource-control][systemd-resource],
  [systemd-run][systemd-run],
   [systemd.timer][systemd-timer],
  [systemd.path][systemd-path],
   [systemd.socket][systemd-socket].
- Alternatives:
   [Docker Compose overview][compose],
  [Docker Compose startup order][compose-order],
   [PM2 quick start][pm2],
  [Foreman][foreman],
   [Overmind][overmind].

[pitchfork-readme]: https://github.com/jdx/pitchfork/blob/main/README.md
[pitchfork-architecture]: https://pitchfork.jdx.dev/concepts/architecture
[pitchfork-how]: https://pitchfork.jdx.dev/concepts/how-it-works
[pitchfork-config]: https://pitchfork.jdx.dev/reference/configuration
[pitchfork-boot]: https://pitchfork.jdx.dev/guides/boot-start
[pitchfork-files]: https://pitchfork.jdx.dev/reference/file-locations
[pitchfork-port]: https://pitchfork.jdx.dev/guides/port-management
[pitchfork-repo]: https://github.com/jdx/pitchfork
[systemd-service]: https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html
[systemd-unit]: https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html
[systemd-exec]: https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html
[systemd-resource]: https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html
[systemd-run]: https://www.freedesktop.org/software/systemd/man/latest/systemd-run.html
[systemd-timer]: https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html
[systemd-path]: https://www.freedesktop.org/software/systemd/man/latest/systemd.path.html
[systemd-socket]: https://www.freedesktop.org/software/systemd/man/latest/systemd.socket.html
[compose]: https://docs.docker.com/compose/
[compose-order]: https://docs.docker.com/compose/how-tos/startup-order/
[pm2]: https://pm2.keymetrics.io/docs/usage/quick-start/
[foreman]: https://github.com/ddollar/foreman
[overmind]: https://github.com/DarthSim/overmind
