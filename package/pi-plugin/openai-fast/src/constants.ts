/**
 Priority routing identities, distinct from upstream model IDs. @module
 */

//region Provider and transport identities

/**
 Existing provider that owns the user's Codex OAuth credential.
 */
export const CODEX_PROVIDER = 'openai-codex';

/**
 Native Codex wire API used after internal target translation.
 */
export const CODEX_API = 'openai-codex-responses';

/**
 Existing companion namespace retained for session migration.
 */
export const FAST_PROVIDER = 'openai-codex-fast';

/**
 Reserved physical-target prefix, never sent to OpenAI.
 */
export const PRIORITY_TARGET_PREFIX = '__pi_openai_fast__/';

//endregion
