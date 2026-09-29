# Android Emulator 37.1.11 console rejects host adb 37.0.1 when homes differ across a container

## Symptom

A disposable `Fold_No_Hardware_Probe` emulator was launched inside a
`podman run --network=host` container and appeared as `emulator-5580` to
the host Android Debug Bridge.
At shutdown,
the host command

```text
adb -s emulator-5580 emu kill
```

printed these exact console responses instead of closing the emulator:

```text
KO: authentication token does not match ~/.emulator_console_auth_token
KO: unknown command, try 'help'
```

The command tool reported exit status zero,
so a successful shell status alone would have hidden the rejection.
This is a console-authentication failure,
not evidence that the AVD stopped or that Android guest shutdown is
unsupported.
The original user AVD was not involved.

## Root cause

The ADB client source at
`mirror/platform_packages_modules_adb` commit
`1cf2f017d312f73b3dc53bda85ef2610e35a80e9`,
`client/console.cpp:32-52`,
constructs the console authentication message from **the invoking
client's home directory**:

```cpp
static const char auth_token_filename[] = ".emulator_console_auth_token";
std::string auth_token_path = adb_get_homedir_path();
auth_token_path += OS_PATH_SEPARATOR;
auth_token_path += auth_token_filename;
// ...
std::string command = "auth ";
command += token;
command += '\n';
```

At `client/console.cpp:104-126`,
`adb_send_emulator_command` opens the emulator's loopback console port,
prepends that authentication message,
then appends the requested command:

```cpp
std::string commands = adb_construct_auth_command();
for (int i = 1; i < argc; i++) {
    commands.append(argv[i]);
    commands.push_back(i == argc - 1 ? '\n' : ' ');
}
commands.append("quit\n");
```

The [Android Emulator console guide][console-guide] says the token passed
to `auth` must match `.emulator_console_auth_token` in the home directory
of the running emulator's console environment.
The project container ran its emulator as root without a mount of the
host's console-token file.
The host client therefore read a different home-token context from the
container client.
The failed host invocation and successful in-container invocation are
consistent with that documented mechanism;
no token contents were printed or copied.
This is expected authentication isolation,
not an upstream emulator bug established by the probe.

## Verification

The emulator binary reported version `37.1.11.0` (build `15917651`);
the host and container used the Android SDK's `adb` version `37.0.1-15733141`.
The cloned ADB client source was checked at the commit cited in
[Root cause](#root-cause).
The disposable emulator was already running inside the named container
`fold-search-ranking-avd`.

### Working pattern

```text
podman exec fold-search-ranking-avd /home/user/Android/Sdk/platform-tools/adb -s emulator-5580 emu kill
OK: killing emulator, bye bye
OK
```

The emulator's own log then reported a graceful shutdown wait.
`adb devices -l` no longer listed `emulator-5580`,
and `podman ps --filter name=fold-search-ranking-avd` listed no running
container.
A residual `multiinstance.lock` path had no holder according to `fuser`;
its existence alone did not establish a live emulator.

### Failing pattern

```text
/home/user/Android/Sdk/platform-tools/adb -s emulator-5580 emu kill
KO: authentication token does not match ~/.emulator_console_auth_token
KO: unknown command, try 'help'
```

The failure was reproduced once on the same live disposable emulator
before the working in-container command stopped it.
The work did not test another emulator image,
original AVD,
container user mapping or future SDK build.

## Verified workaround

Invoke `adb emu` from the container that owns the running emulator,
using its SDK-mounted ADB binary and the explicit disposable serial:

```text
podman exec fold-search-ranking-avd /home/user/Android/Sdk/platform-tools/adb -s emulator-5580 emu kill
```

This keeps the authentication-token lookup in the same container-home
context as the emulator and uses the console's documented `kill` command.
It requires the container to be alive and the caller to have permission
to run `podman exec`;
it closes the emulator and container,
so it is not suitable when a session must stay active.
No token copy,
console-auth disablement or host-home mutation is needed.

## What does not work

- Host `adb emu kill` with the container's console port visible through
  host networking fails authentication;
  visibility is not token parity.
- `adb shell cmd power help` listed sleep and wake controls,
  not a shutdown operation.
  This one command listing does not prove all Android guest-side shutdown
  paths impossible.
- Do not treat the host ADB command's zero shell status as a successful
  shutdown when the console printed `KO`.

## Upstream filing decision

`.out-of-scope/` was checked;
no emulator-console exemption applied.
A GitHub issue and PR search for `emulator_console_auth_token container`
and `emulator console auth token mismatch` returned no matches in the
queried index.
That is not evidence that no comparable report exists on Google's
separate issue tracker.

- **Upstream fault:** no.
  The source and official guide describe authentication tied to a home
  token;
  the observed container and host used different home contexts.
- **Fixability:** an improved diagnostic could name the client's token
  location,
  but there is no demonstrated emulator defect requiring a patch.
- **Supported use case:** `adb emu` and console authentication are
  documented;
  token sharing between differing container homes is not a promised
  behavior in the cited guide.
- **Contribution policy:** not assessed because no upstream bug or
  documentation gap is established for filing.
- **Likely upstream response:** not assessed;
  search silence is not a maintainer decision.
- **Minimal upstream fix prototype:** not applicable because the consumer
  boundary workaround solved the problem without changing upstream.

Nothing additive is ready to send upstream.
Do not file the following draft as-is:

~~~md
Title: Clarify emulator console token location for containerized adb clients

Host `adb -s emulator-5580 emu kill` returned
`KO: authentication token does not match ~/.emulator_console_auth_token`
for an emulator running under a different container home.
The Android Emulator console guide already explains home-directory token
matching;
`podman exec <running-emulator-container> adb -s emulator-5580 emu kill`
succeeded without copying a token.
No upstream bug or missing guidance has been demonstrated.
~~~

[console-guide]: https://developer.android.com/studio/run/emulator-console
