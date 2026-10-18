/**
 Preserve declared compaction file collections as ordinary snapshot data.

 @module
 */
import {types} from 'node:util';
import {tagged,type Logger} from '@monochromatic-dev/module-logger/ts';
import {SourceCollectionError} from '../errors.ts';

//region Native file collections have one declared input location

/** Native iteration bypasses properties supplied by a collection instance. */
const nativeSetValues: (this: ReadonlySet<unknown>) => Iterable<unknown> = Set.prototype.values;
/** Prototype compatibility narrows normalization without accepting arbitrary containers. */
const nativeSetPrototype: object = Set.prototype;
/** Collection diagnostics retain their module boundary. */
const l=tagged({tag:'auto-mode-native-compaction-file-paths'});

/**
 Keep descriptor reads inside ordinary records without invoking caller traps.

 @param value - borrowed field may require the existing strict copier instead
 @returns whether descriptor access can retain the original data boundary
 */
function isCompactionRecord(value: unknown): value is Readonly<Record<string,unknown>> {
  tagged({tag:isCompactionRecord.name,l}).debug('checking native compaction record shape');
  return value!==null&&typeof value==='object'&&!types.isProxy(value)
    &&Object.getPrototypeOf(value)===Object.prototype;
}

/**
 Retain path values without calling an instance iterator or discarding extra fields.

 @param value - declared native file-operation slot remains ordinary data when not a native set
 @param l - caller diagnostics retain the projection boundary
 @returns ordinary path snapshot or original value for strict ordinary-data validation
 @throws SourceCollectionError when a native collection cannot preserve its complete path data
 */
function projectPathSet({value,l:parentLogger}: {readonly value:unknown;readonly l:Logger}): unknown {
  const sl=tagged({tag:projectPathSet.name,l:parentLogger});
  sl.debug('projecting declared native file-operation collection');
  if(value===null||typeof value!=='object')return value;
  if(types.isProxy(value))throw new SourceCollectionError('Native compaction file paths require a non-proxy collection');
  if(Object.getPrototypeOf(value)!==nativeSetPrototype)return value;
  if(!types.isSet(value))throw new SourceCollectionError('Native compaction file paths require native set storage');
  if(Reflect.ownKeys(value).length!==0)
    throw new SourceCollectionError('Native compaction file sets cannot discard additional own properties');
  const paths:string[]=[];
  for(const path of nativeSetValues.call(value)){
    if(typeof path!=='string')throw new SourceCollectionError('Native compaction file sets require string paths');
    paths.push(path);
  }
  sl.debug(`retained ${paths.length} native file paths`);
  return Object.freeze({nativeCollection:'file-path-set',values:Object.freeze(paths)});
}

/**
 Replace one declared data field while preserving every unrelated descriptor.

 @param record - borrowed ordinary record remains unchanged for the native callback
 @param key - declared compaction field selects an existing own data slot
 @param value - projected nested value retains the field's original descriptor flags
 @param l - caller diagnostics retain the projection boundary
 @returns descriptor-preserving ordinary record for the existing copier
 @throws SourceCollectionError when the selected native field lost its own data slot
 */
function replaceDataField({record,key,value,l:parentLogger}: {
  readonly record:Readonly<Record<string,unknown>>;
  readonly key:'preparation'|'fileOps';
  readonly value:unknown;
  readonly l:Logger
}): unknown {
  tagged({tag:replaceDataField.name,l:parentLogger}).debug(`projecting native ${key} data field`);
  const descriptors=Object.getOwnPropertyDescriptors(record);
  const field=descriptors[key];
  if(!field||!Object.hasOwn(field,'value'))throw new SourceCollectionError('Native compaction projection requires its original own data field');
  descriptors[key]={...field,value};
  const projected:unknown=Object.create(Object.prototype,descriptors);
  return projected;
}

/**
 Normalize only the SDK preparation's declared file-operation sets.

 @param value - original compaction event remains untouched for native extension callbacks
 @returns ordinary event snapshot with complete path data and unrelated fields retained
 @throws SourceCollectionError when a declared native set cannot retain its complete data
 @example
 ```ts
 const projected=projectNativeCompactionFilePaths(event);
 ```
 */
export function projectNativeCompactionFilePaths(value: unknown): unknown {
  const pl=tagged({tag:projectNativeCompactionFilePaths.name,l});
  pl.debug('projecting declared compaction preparation file operations');
  if(!isCompactionRecord(value))return value;
  const preparationField=Object.getOwnPropertyDescriptor(value,'preparation');
  if(!preparationField||!Object.hasOwn(preparationField,'value'))return value;
  const preparation:unknown=preparationField.value;
  if(!isCompactionRecord(preparation))return value;
  const operationsField=Object.getOwnPropertyDescriptor(preparation,'fileOps');
  if(!operationsField||!Object.hasOwn(operationsField,'value'))return value;
  const operations:unknown=operationsField.value;
  if(!isCompactionRecord(operations))return value;
  const descriptors=Object.getOwnPropertyDescriptors(operations);
  const state={changed:false};
  for(const key of ['read','written','edited'] as const){
    const field=descriptors[key];
    if(!field||!Object.hasOwn(field,'value'))continue;
    const original:unknown=field.value;
    const projected=projectPathSet({value:original,l:pl});
    if(projected!==original){descriptors[key]={...field,value:projected};state.changed=true;}
  }
  if(!state.changed)return value;
  const projectedOperations:unknown=Object.create(Object.prototype,descriptors);
  const projectedPreparation=replaceDataField({record:preparation,key:'fileOps',value:projectedOperations,l:pl});
  return replaceDataField({record:value,key:'preparation',value:projectedPreparation,l:pl});
}

//endregion Native file collections have one declared input location
