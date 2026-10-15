export const phases=Object.freeze([
  {
    kind:'context',
    property:'agentsFilesOverride'
  },
  {
    kind:'system',
    property:'systemPromptOverride'
  },
  {
    kind:'append',
    property:'appendSystemPromptOverride'
  }
]);
export const readerNames=Object.freeze([
  'getAgentsFiles',
  'getSystemPrompt',
  'getSystemPromptSource',
  'getAppendSystemPrompt',
  'getAppendSystemPromptSources'
]);
export const selectorNames=Object.freeze([
  'cwd',
  'agentDir',
  'noContextFiles',
  'systemPromptSource',
  'appendSystemPromptSource'
]);
export const discoveryNames=Object.freeze([
  'discoverSystemPromptFile',
  'discoverAppendSystemPromptFile'
]);
