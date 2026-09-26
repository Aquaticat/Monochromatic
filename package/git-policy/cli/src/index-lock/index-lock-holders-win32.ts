/**
 Windows open-holder query for a lock file through the Restart Manager,
 started only while a foreign lock exists.
 The Restart Manager reports processes with the registered file open without opening it for `DELETE`,
 so the query cannot delay Git's own rename of the lock the way a `DELETE`-access probe could.
 The native calls are reachable from Node only through PowerShell P/Invoke.

 @module
 */
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import nanoSpawn from 'nano-spawn';
import type {
  LockHolderEvidence,
  LockHolderProcess,
} from './index-lock-types.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Environment variable carrying the queried path, so the path never passes through PowerShell parsing.
 */
const TARGET_VARIABLE = 'CLI_GIT_RM_TARGET';

/**
 PowerShell script printing one `<pid>\t<application name>` line per process holding the target open.
 */
export const RESTART_MANAGER_SCRIPT: string = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class CliGitRestartManager {
  [StructLayout(LayoutKind.Sequential)]
  public struct UniqueProcess { public int ProcessId; public System.Runtime.InteropServices.ComTypes.FILETIME StartTime; }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct ProcessInfo {
    public UniqueProcess Process;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string AppName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)] public string ServiceShortName;
    public int ApplicationType;
    public uint AppStatus;
    public uint TSSessionId;
    [MarshalAs(UnmanagedType.Bool)] public bool Restartable;
  }
  [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
  public static extern int RmStartSession(out uint session, int flags, System.Text.StringBuilder key);
  [DllImport("rstrtmgr.dll")]
  public static extern int RmEndSession(uint session);
  [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
  public static extern int RmRegisterResources(uint session, uint fileCount, string[] files, uint applicationCount, IntPtr applications, uint serviceCount, string[] services);
  [DllImport("rstrtmgr.dll")]
  public static extern int RmGetList(uint session, out uint needed, ref uint count, [In, Out] ProcessInfo[] processes, ref uint rebootReasons);
  public static string Query(string path) {
    uint session;
    int status = RmStartSession(out session, 0, new System.Text.StringBuilder(64));
    if (status != 0) { throw new Exception("RmStartSession failed: " + status); }
    try {
      status = RmRegisterResources(session, 1, new string[] { path }, 0, IntPtr.Zero, 0, null);
      if (status != 0) { throw new Exception("RmRegisterResources failed: " + status); }
      uint needed = 0;
      uint count = 0;
      uint reasons = 0;
      status = RmGetList(session, out needed, ref count, null, ref reasons);
      if (status == 0) { return ""; }
      if (status != 234) { throw new Exception("RmGetList failed: " + status); }
      ProcessInfo[] processes = new ProcessInfo[needed];
      count = needed;
      status = RmGetList(session, out needed, ref count, processes, ref reasons);
      if (status != 0) { throw new Exception("RmGetList failed: " + status); }
      System.Text.StringBuilder lines = new System.Text.StringBuilder();
      for (int index = 0; index < count; index++) {
        lines.Append(processes[index].Process.ProcessId).Append('\t').Append(processes[index].AppName).Append('\n');
      }
      return lines.ToString();
    }
    finally { RmEndSession(session); }
  }
}
'@
[Console]::Out.Write([CliGitRestartManager]::Query($env:${TARGET_VARIABLE}))
`;

/**
 Parses the Restart Manager script output.

 @param output - `<pid>\t<name>` lines

 @returns holders

 @example
 ```ts
 parseRestartManagerOutput('4242\tgit.exe\n'); // [{ pid: 4242, command: 'git.exe' }]
 ```
 */
export function parseRestartManagerOutput(output: string,): readonly LockHolderProcess[] {
  return output.split('\n',)
    .map(function trimLine(line,): string {
      return line.trim();
    },)
    .filter(function nonEmpty(line,): boolean {
      return line !== '';
    },)
    .flatMap(function holder(line,): readonly LockHolderProcess[] {
      /**
       Separator between PID and name.
       */
      const tab = line.indexOf('\t',);
      /**
       Process ID.
       */
      const pid = Number(tab === (-1) ? line : line.slice(
        0,
        tab,
      ),);
      if ((!Number.isSafeInteger(pid,)) || (pid < 1))
        return [];
      /**
       Application name.
       */
      const command = tab === (-1) ? '' : line.slice(tab + 1,);
      return [command === '' ? { pid, } : {
        pid,
        command,
      },];
    },);
}

/**
 Finds processes holding a file open through the Restart Manager.

 Device and inode matching happens inside the Restart Manager,
 which resolves the registered path to the open file objects.

 @param lockPath - lock path registered with the Restart Manager

 @returns holders and partial-evidence reasons

 @example
 ```ts
 await scanRestartManagerHolders('C:\\repo\\.git\\index.lock');
 ```
 */
export async function scanRestartManagerHolders(lockPath: string,): Promise<LockHolderEvidence> {
  /**
   Tagged query logger.
   */
  const rl = tagged({
    tag: scanRestartManagerHolders.name,
    l,
  },);
  try {
    /**
     Query output.
     */
    const { stdout, } = await nanoSpawn(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        RESTART_MANAGER_SCRIPT,
      ],
      {
        windowsHide: true,
        env: { [TARGET_VARIABLE]: lockPath, },
      },
    );
    return {
      method: 'restart-manager',
      holders: parseRestartManagerOutput(stdout,),
      partial: [],
    };
  }
  catch (error: unknown) {
    rl.debug(`Restart Manager query failed: ${caughtValueText(error,)}`,);
    return {
      method: 'restart-manager',
      holders: [],
      partial: [`Restart Manager query failed: ${caughtValueText(error,)}`,],
    };
  }
}
