import {RequestObservationProfileError} from './observation-errors.mjs';
//region Native identity and serialized endpoint boundaries.
export function object(value){return (value!==null)&&(((typeof value)==='object')||((typeof value)==='function'));}

export function parseObservationEndpoint(endpoint){
  try{return new URL(endpoint);}
  catch(error){throw new RequestObservationProfileError('Declared endpoint is not a URL',{cause:error});}
}
export function parseRequestBody(body){
  try{return JSON.parse(body);}
  catch(error){throw new RequestObservationProfileError('Serialized request is not valid JSON',{cause:error});}
}
//endregion
