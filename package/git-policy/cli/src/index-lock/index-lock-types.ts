/**
 Evidence and verdict shapes for a foreign `index.lock`.

 @module
 */

/**
 Identity and change time of a lock file, read without following links.
 */
export type LockFileMetadata = Readonly<{
  /**
   Device number.
   */
  device: bigint;
  /**
   Inode number.
   */
  inode: bigint;
  /**
   Status change time in milliseconds since the epoch.
   */
  ctimeMs: number;
}>;

/**
 One process holding the lock open, matched by device and inode.
 */
export type LockHolderProcess = Readonly<{
  /**
   Holder process ID.
   */
  pid: number;
  /**
   Holder command name when readable.
   */
  command?: string;
}>;

/**
 Open-holder scan result.
 */
export type LockHolderEvidence = Readonly<{
  /**
   Scan mechanism.
   */
  method: 'proc-fd' | 'lsof' | 'restart-manager' | 'unsupported';
  /**
   Processes holding the lock open.
   */
  holders: readonly LockHolderProcess[];
  /**
   Reasons the scan could not see everything, such as unreadable processes.
   */
  partial: readonly string[];
}>;

/**
 What the process a PID file names looks like now.
 */
export type PidOwnerEvidence =
  | Readonly<{
    /**
     No process with that PID runs, or it is a zombie.
     */
    state: 'missing';
  }>
  | Readonly<{
    /**
     A process runs that started no later than the lock's change time.
     */
    state: 'started-before-lock';
    /**
     Process start time in milliseconds since the epoch.
     */
    startedAtMs: number;
    /**
     Command name when readable.
     */
    command?: string;
  }>
  | Readonly<{
    /**
     A process runs that started after the lock changed, so the PID was reused.
     */
    state: 'started-after-lock';
    /**
     Process start time in milliseconds since the epoch.
     */
    startedAtMs: number;
  }>
  | Readonly<{
    /**
     A process runs whose start time could not be read.
     */
    state: 'start-unknown';
    /**
     Why the start time is unavailable.
     */
    reason: string;
  }>;

/**
 Git's `core.lockfilePid` owner file beside the lock.
 */
export type PidFileEvidence =
  | Readonly<{
    /**
     No PID file exists.
     */
    kind: 'absent';
  }>
  | Readonly<{
    /**
     The file does not hold `pid <n>`.
     */
    kind: 'malformed';
    /**
     Raw text, truncated.
     */
    text: string;
  }>
  | Readonly<{
    /**
     The file exists but could not be read.
     */
    kind: 'unreadable';
    /**
     Read failure.
     */
    reason: string;
  }>
  | Readonly<{
    /**
     The file names a PID.
     */
    kind: 'owner';
    /**
     Named PID.
     */
    pid: number;
    /**
     That process now.
     */
    owner: PidOwnerEvidence;
  }>;

/**
 Evidence gathered on one attempt.
 */
export type IndexLockEvidence = Readonly<{
  /**
   Lock path.
   */
  lockPath: string;
  /**
   Lock identity and change time.
   */
  lock: LockFileMetadata;
  /**
   PID file evidence.
   */
  pidFile: PidFileEvidence;
  /**
   Open-holder scan, absent when the PID file already proved a live owner.
   */
  holders?: LockHolderEvidence;
}>;

/**
 Classification of a foreign lock's owner.
 */
export type IndexLockVerdict =
  | Readonly<{
    /**
     A live owner is proven.
     */
    kind: 'proven-alive';
    /**
     Owner PID.
     */
    pid: number;
    /**
     Which evidence proved it.
     */
    source: 'open-descriptor' | 'pid-file';
    /**
     Owner command name when readable.
     */
    command?: string;
  }>
  | Readonly<{
    /**
     The PID file names a process that no longer runs.
     */
    kind: 'dead';
    /**
     Named PID.
     */
    pid: number;
  }>
  | Readonly<{
    /**
     Nothing proves a live owner or a dead one.
     */
    kind: 'evidence-free';
  }>;
