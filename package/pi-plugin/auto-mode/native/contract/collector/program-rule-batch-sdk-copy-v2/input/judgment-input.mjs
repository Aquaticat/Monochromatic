export class JudgmentConstructionError extends Error {constructor(message,options){super(message,options);this.name=this.constructor.name;}}
/** Reject admitted JSON-like values whose meaning ordinary JSON would silently change. */
export function requireJSONInput(input){JSON.stringify(input,function validateNativeJSONValue(_key,value) {if(value===undefined||(typeof value==='number'&&(!Number.isFinite(value)||Object.is(value,-0))))throw new JudgmentConstructionError('Native tool input contains a value not preserved by the declared JSON profile');return value;});}
