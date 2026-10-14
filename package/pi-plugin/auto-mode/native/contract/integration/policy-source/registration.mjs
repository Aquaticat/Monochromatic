export class InstructionRegistrationError extends Error {
 constructor(message){super(message);this.name=this.constructor.name;}
}
const priorities=Object.freeze({system:0,developer:1,user:2});

/**
 * Accepted trust root: startup configuration assigns authority, not the wire role.
 * Copy only the declared fields so later caller mutation cannot change policy.
 * This initial scope covers original requests retaining this owner's source.
 */
export function copyAuthorityRegistration(input){
 if(input===undefined)return undefined;
 if(!input||typeof input!=='object'||Object.getPrototypeOf(input)!==Object.prototype)throw new InstructionRegistrationError('Authority registration requires an ordinary startup declaration');
 const keys=Reflect.ownKeys(input);
 if(keys.length!==2||!keys.includes('tier')||!keys.includes('scope'))throw new InstructionRegistrationError('Authority registration accepts only tier and scope');
 const values={};
 for(const key of keys){
  const field=Object.getOwnPropertyDescriptor(input,key);
  if(!field?.enumerable||!Object.hasOwn(field,'value'))throw new InstructionRegistrationError('Authority registration requires data fields');
  values[key]=field.value;
 }
 if(typeof values.tier!=='string'||!Object.hasOwn(priorities,values.tier))throw new InstructionRegistrationError('Authority tier must be system, developer or user');
 if(values.scope!=='original-request')throw new InstructionRegistrationError('This registration supports only original-request scope');
 return Object.freeze({
  tier:values.tier,priority:priorities[values.tier],scope:values.scope,
  origin:'trusted-host-startup-registration'
 });
}
