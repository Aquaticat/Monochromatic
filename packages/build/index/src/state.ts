export type State =
  | 'SUCCESS'
  // Success with summary
  | ['SUCCESS', string]
  // Skip with reason
  | ['SKIP', string]
  | State[]
  | PromiseSettledResult<State>[];
