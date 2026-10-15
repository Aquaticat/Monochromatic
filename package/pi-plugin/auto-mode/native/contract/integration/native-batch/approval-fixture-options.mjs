import assert from 'node:assert/strict';

//region Authored approval scenario and original observation state.
export const mode=process.argv[2]??'allow';
export const freshSessionApproval=process.argv
  .includes('--fresh-session-approval');
export const uncertainContext=process.argv
  .includes('--uncertain-context');
export const headless=process.argv
  .includes('--headless');
export const useNativeContext=process.argv
  .includes('--native-context');
export const reloadContext=process.argv
  .includes('--reload-context');
assert.ok([
  'allow',
  'deny',
  'stop',
  'cancelled',
  'missing',
  'unsupported',
  'unresolved',
  'satisfied',
  'bare',
  'prohibited',
  'retired'
].includes(mode));
const permission=mode==='bare'?'Use sentence case in the final response.':mode==='prohibited'?'The complete proposed operation is prohibited.':'The complete proposed operation is permitted.';
export const policyText=`RUL:\n ${permission}\n\nCNF:\n Require a fresh Allow response from the current Pi session user for this exact prepared group.\n${uncertainContext?'\nUNK:\n Follow the additional policy that has not been supplied.\n':''}`;

export const programProfile='awaited-string-result-then-literal-parallel';
export const outsideProfile=process.argv.includes('--outside-profile');
export const code=outsideProfile
 ?'const first = await tools.fixture_value({path:"seed"}); const second = await tools.fixture_value({path:"second"}); return second;'
 :'const value = await tools.fixture_value({path:"seed"});\nreturn await Promise.allSettled([tools.fixture_value({path:value}),tools.fixture_value({path:"second"})]);';

export const fixtureState={
  nativePi:undefined,
  /** @type {Promise<void> | undefined} */
  abortTask:undefined,
  approvalCaptures:0,
  assessments:0,
  wires:[],
  authorizationCaptures:0,
  executions:0,
  notifications:0,
  originalBody:undefined,
  requests:0,
  proposalLimit:1,
  selections:0,
  activeAuthorization:true,
  handlerFailure:undefined
};
//endregion
