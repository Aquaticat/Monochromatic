/**
 Operation construction for the native decision fallback catalog.

 Proposed commands, their tool calls, and the terminal stream replies stay in
 one owner so request assertions and the wrapped tool share exact strings. @module
 */
import type {
  DecisionFallbackOperation,
  DecisionFallbackState
} from './native-decision-fallback-types.ts';

//region The proposed inspection builds one direct bash tool-call group.

/**
 Build the proposed operation fixture and its terminal stream replies.

 @param state - live fixture state counting terminal requests

 @returns proposed commands and the fixture terminal fetch
 */
export function createDecisionFallbackOperation({ state }: Readonly<{
  state: DecisionFallbackState;
}>): DecisionFallbackOperation {
  const commands: readonly string[] = [
    'printf FALLBACK_A',
    'printf FALLBACK_B'
  ];
  const calls = commands.map(function proposedCommand(
    command: string,
    index: number
  ): Readonly<Record<string, unknown>> {
    return {
      index,
      id: `fallback-${index}`,
      type: 'function',
      function: {
        name: 'bash',
        arguments: JSON.stringify({ command })
      }
    };
  });
  /**
   Only the first non-chat request carries the proposed tool-call group.
   */
  async function fixtureTerminalStream(): Promise<Response> {
    const proposal = (!state.ordinaryChatPending) && ((state.requestCount++) === 0);
    const chunk: Readonly<Record<string, unknown>> = {
      id: 'decision-fallback-fixture',
      object: 'chat.completion.chunk',
      created: 0,
      model: 'fixture'
    };
    const first: Readonly<Record<string, unknown>> = {
      ...chunk,
      choices: [{
        index: 0,
        delta: proposal
          ? {
            role: 'assistant',
            tool_calls: calls
          }
          : {
            role: 'assistant',
            content: 'done'
          },
        finish_reason: null
      }]
    };
    const last: Readonly<Record<string, unknown>> = {
      ...chunk,
      choices: [{
        index: 0,
        delta: {},
        finish_reason: proposal ? 'tool_calls' : 'stop'
      }],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 10,
        total_tokens: 110
      }
    };
    return new Response(
      `data: ${JSON.stringify(first)}\n\ndata: ${JSON.stringify(last)}\n\ndata: [DONE]\n\n`,
      { headers: { 'content-type': 'text/event-stream' } }
    );
  }
  return {
    commands,
    terminalFetch: fixtureTerminalStream
  };
}

//endregion
