/** Observe every issued completion even after transport delivery closes. */
export function createGroupCompletions({groupState,records,signal,onParentAbort}) {
function detach(){
    signal.removeEventListener(
      'abort',
      onParentAbort
    );
    for(const record of records){record.removeAbort?.();record.removeAbort=undefined;}
  }
function completed(){
    if(records.every(function isCompleteRecord(record) { return (record.completion!==undefined); })){
      detach();if((!groupState.primary)&&(!groupState.closed))groupState.phase='settled';
    }
  }
async function observeCompletion({
    record,
    completion
  }){
    using lifetime2={ [Symbol.dispose]() {record.removeAbort?.();record.removeAbort=undefined;completed();} };
    try{
      const value=await completion;record.completion=Object.freeze({
        status:'fulfilled',
        value
      });
      if(record.state==='pending'){record.state='fulfilled';record.ticket
        .resolve(value);}
    }catch(error){
      record.completion=Object.freeze({
        status:'rejected',
        reason:error
      });
      if(record.state==='pending'){record.state='rejected';record.ticket
        .reject(error);}
    }
  }
  return {detach,observeCompletion};
}
