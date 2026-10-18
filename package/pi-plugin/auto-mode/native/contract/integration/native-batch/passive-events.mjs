import {createPassiveCapture} from './passive-capture.mjs';

//region Evidence failures never replace native extension invocation, results, or errors.
/** Context capture retains its failure until the run's completed-context reader rejects missing evidence. */
export function createPassiveContextObserver(owner){
 const capture=createPassiveCapture();
 return Object.freeze({
  begin(input){capture.observe({capture(){owner.begin(input);}});},
  before(input){capture.observe({capture(){owner.before(input);}});},
  returned(input){capture.observe({capture(){owner.returned(input);}});},
  failed(error){capture.observe({capture(){owner.failed(error);}});},
  end(kind){capture.observe({capture(){owner.end(kind);}});},
  complete(){return capture.observe({capture(){return owner.complete();}});}
 });
}

/** Event readers reject unavailable evidence while the native event traversal always continues. */
export function createPassiveEventObserver(owner){
 const capture=createPassiveCapture();
 function begin(input){
  const traversal=capture.observe({capture(){return owner.begin(input);}});
  return Object.freeze({
   before(value){capture.observe({capture(){traversal.before(value);}});},
   returned(value){capture.observe({capture(){traversal.returned(value);}});},
   failed(error){capture.observe({capture(){traversal.failed(error);}});},
   end(){capture.observe({capture(){traversal.end();}});},
   stopped(){capture.observe({capture(){traversal.stopped();}});},
   aborted(error){capture.observe({capture(){traversal.aborted(error);}});}
  });
 }
 function read(kinds){capture.assertCaptured();return owner.read(kinds);}
 return Object.freeze({begin,read});
}
//endregion
