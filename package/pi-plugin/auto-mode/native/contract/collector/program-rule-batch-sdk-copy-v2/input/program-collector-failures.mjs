/** Internal control-flow token distinguishes recorded delivery from a new equal-valued failure. */
class RecordedFailure extends Error {
  constructor(occurrence){super('Declared group failure already recorded');this.occurrence=occurrence;}
}

/** Retain original failure occurrences and their group cancellation effects. */
export function createGroupFailures({groupState,failures,controller,rejectPending}) {
  const abortOccurrences=new WeakMap();
function recordFailure({
    error,
    at
  }){
    const occurrence=Object.freeze({
      identity:Object.freeze({}),
      ordinal:failures.length,
      at,
      error
    });
    const recorded=new RecordedFailure(occurrence);failures.push(occurrence);
    if((!groupState.primary)&&(!groupState.closed)
      &&(groupState.phase!=='settled')){
      groupState.primary=recorded;groupState.phase='failed';rejectPending({
        error,
        state:'rejected'
      });controller.abort(error);
    }
    return recorded;
  }
function abortOccurrence({
    observed,
    at
  }){
    let recorded=abortOccurrences.get(observed);
    if(!recorded){recorded=recordFailure({
      error:observed.reason,
      at
    });abortOccurrences.set(
      observed,
      recorded
    );}
    return recorded;
  }
function retainBoundaryFailure({
    error,
    at
  }){return error instanceof RecordedFailure?error:recordFailure({
    error,
    at
  });}
  return {recordFailure,abortOccurrence,retainBoundaryFailure};
}
