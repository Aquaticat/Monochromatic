/**
 Bash-poke settings shape.

 @module
 */

//region Settings type

/**
 Settings that tune poke content, progress display, and cancellation.
 
 Every field is present after loading because defaults are applied during
 parsing, so no consumer branches on absence.
 
 @example
 ```ts
 const { pokeTailChars, } = await loadSettings({ home: homedir(), },);
 ```
 */
type BashPokeSettings = {
  /**
   Instruction appended to a poke so the model resumes the interrupted task.
   */
  readonly pokeInstruction: string;

  /**
   Characters kept from the start of captured output.
   */
  readonly pokeHeadChars: number;

  /**
   Characters kept from the end of captured output.
   */
  readonly pokeTailChars: number;

  /**
   Whether running jobs are drawn above the editor.
   */
  readonly progressWidget: boolean;

  /**
   Output lines drawn per running job.
   */
  readonly progressTailLines: number;

  /**
   Milliseconds between widget redraws.
   */
  readonly progressRefreshMs: number;

  /**
   Milliseconds between elapsed-time redraws while a job runs.
   */
  readonly progressTickMs: number;

  /**
   Milliseconds a cancelled job gets to exit before its group is force-killed.
   */
  readonly killGraceMs: number;
};

//endregion Settings type

export type { BashPokeSettings, };
