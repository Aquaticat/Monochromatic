/**
 * Intentionally hangs the process by entering a synchronous infinite loop
 * with no yield point. The process never exits unless killed externally
 * (e.g. SIGTERM or SIGKILL).
 */
export {}

// eslint-disable-next-line no-constant-condition -- intentional hang
while (true) {
  // intentional busy loop -- no yield, no sleep, no exit
}
