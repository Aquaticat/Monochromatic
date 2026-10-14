/** Code-owned script-value guard category, distinct from the native tool's ordinary conversion error. */
export class NativeScriptValueGuardError extends AggregateError{
  constructor({errors,call}){
    const input=call?'tool '+JSON.stringify(call.name)+' call '+JSON.stringify(call.id):'original program result';
    super(errors,'Native result binding for '+input+' was rejected. Resolve the original source, lifetime, ownership or supported-value failure; do not replace its judgment with a fresh budget.');this.name=this.constructor.name;Object.freeze(this.errors);
  }
}
export function scriptValueGuard({error,call}){return error instanceof NativeScriptValueGuardError?error:new NativeScriptValueGuardError({errors:[error],call});}
