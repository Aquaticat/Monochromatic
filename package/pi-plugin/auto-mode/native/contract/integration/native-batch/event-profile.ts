/**
 Event kinds whose original native dispatch methods retain complete callback observations.

 @module
 */

//region This finite source profile follows the inspected Pi 1.2.0 dispatch methods

/**
 Generic, boundary, message, tool, and user-Bash dispatch cover these registered kinds.
 Other dedicated native emitters retain their separate qualification requirements.
 */
export const NATIVE_OBSERVED_EVENT_KINDS: readonly string[] = Object.freeze([
  'after_provider_response',
  'agent_end',
  'agent_settled',
  'agent_start',
  'message_end',
  'message_start',
  'message_update',
  'model_select',
  'session_compact',
  'session_info_changed',
  'session_shutdown',
  'session_start',
  'session_tree',
  'thinking_level_select',
  'tool_call',
  'tool_execution_end',
  'tool_execution_start',
  'tool_execution_update',
  'tool_result',
  'turn_end',
  'turn_start',
  'user_bash',
]);

//endregion This finite source profile follows the inspected Pi 1.2.0 dispatch methods
