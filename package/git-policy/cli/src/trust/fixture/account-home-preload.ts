/**
 Test-only operating-system account adapter for spawned wrapper processes.

 Production derives the trust registry root from the operating-system account home,
 never from `HOME`,
 so a spawned built wrapper would otherwise read and write the real account registry.
 Loaded through `NODE_OPTIONS=--import=<this file>`,
 this preload makes `os.userInfo().homedir` report the process's `HOME`,
 as if the test ran under a disposable account,
 and every nested Node process inherits the same preload.
 It ships only with tests:
 the package excludes `src/trust/fixture`.

 @module
 */
import { syncBuiltinESMExports, } from 'node:module';
import os from 'node:os';

/**
 `HOME` the fixture assigned.
 */
const assignedHome = process.env.HOME;
if ((assignedHome === undefined) || (assignedHome === ''))
  throw new Error('The account-home test preload requires HOME to name a disposable home.',);

/**
 Disposable home, typed after the presence check so function declarations see it as a string.
 */
const disposableHome: string = assignedHome;

/**
 Real account database lookup.
 */
const accountUserInfo = os.userInfo;

/**
 Reports the real account with the disposable home.

 @returns account information whose home is the disposable home
 */
function disposableUserInfo(): os.UserInfo<string> {
  return {
    ...accountUserInfo(),
    homedir: disposableHome,
  };
}

Object.defineProperty(
  os,
  'userInfo',
  {
    value: disposableUserInfo,
    writable: true,
    configurable: true,
    enumerable: true,
  },
);
// Named ESM imports of `node:os` read the builtin's export snapshot; this refreshes it.
syncBuiltinESMExports();
