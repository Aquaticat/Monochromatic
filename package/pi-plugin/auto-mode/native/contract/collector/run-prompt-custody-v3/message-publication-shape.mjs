import {types} from 'node:util';

//region Read original data descriptors without invoking accessors.
export function ordinary(value){
 return (value!==null)&&((typeof value)==='object')
   &&(!types.isProxy(value))
   &&(Object.getPrototypeOf(value)===Object.prototype)
   &&(!('toJSON' in value));
}
export function field({value,key}){
 if(!ordinary(value))return undefined;
 const property=Object.getOwnPropertyDescriptor(
   value,
   key
 );
 return property?.enumerable&&Object.hasOwn(
   property,
   'value'
 )?property:undefined;
}
export function dense(value){
 return Array.isArray(value)
   &&(!types.isProxy(value))
   &&(Object.getPrototypeOf(value)===Array.prototype)
   &&(!('toJSON' in value))
   &&(Reflect.ownKeys(value)
     .length
     ===(value.length
     +1))
   &&Array.from(
     {length:value.length},
     function readArrayDescriptor(
       _,
       index
     ) { return (Object.getOwnPropertyDescriptor(
       value,
       String(index)
     )); }
   )
   .every(function isEnumerableDataProperty(property) { return (property?.enumerable&&Object.hasOwn(
     property,
     'value'
   )); });
}
export function textPart(value){
 return ordinary(value)&&(Reflect.ownKeys(value)
   .length
   ===2)
   &&(field({value:value,key:'type'})
     ?.value
     ==='text')
   &&((typeof field({value:value,key:'text'})
     ?.value)==='string');
}
export function flags(property){
 return Object.freeze({
   enumerable:property.enumerable,
   writable:property.writable,
   configurable:property.configurable
 });
}

//endregion
