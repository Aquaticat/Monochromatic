/**
 Opt-in switch that makes the main agent's Bash calls run as background tasks.

 @module
 */

/**
 Environment variable that opts in to forcing `run_in_background` on main-agent Bash calls.
 */
const FORCE_BACKGROUND_ENV = 'MONOCHROMATIC_BASH_FORCE_BACKGROUND' as const;

/**
 Value of {@link FORCE_BACKGROUND_ENV} that enables forcing; every other value, or absence, leaves Bash calls as sent.
 */
const FORCE_BACKGROUND_ON = 'on' as const;

/**
 Whether a Bash call should be rewritten to run in the background.

 Subagent calls are excluded: the hook input carries `agent_id` only inside a subagent, and a subagent
 that waits on a command's output would otherwise lose its synchronous result.

 @param agentId - `agent_id` from the hook input, absent on the main thread

 @param env - process environment holding {@link FORCE_BACKGROUND_ENV}

 @returns `true` only for a main-thread call with the opt-in set

 @example
 ```ts
 shouldForceBackground({ env: { MONOCHROMATIC_BASH_FORCE_BACKGROUND: 'on' } });                  // true
 shouldForceBackground({ agentId: 'a1', env: { MONOCHROMATIC_BASH_FORCE_BACKGROUND: 'on' } }); // false
 ```
 */
function shouldForceBackground(
  {
    agentId,
    env,
  }: Readonly<{
    agentId?: string;
    env: Readonly<NodeJS.ProcessEnv>;
  }>,
): boolean {
  if (agentId !== undefined)
    return false;
  return env[FORCE_BACKGROUND_ENV] === FORCE_BACKGROUND_ON;
}

export {
  FORCE_BACKGROUND_ENV,
  shouldForceBackground,
};
