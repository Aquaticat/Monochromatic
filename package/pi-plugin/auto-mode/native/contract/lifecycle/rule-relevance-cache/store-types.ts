/**
 Persisted estimates and asynchronous cache operations retain explicit domain contracts.
 @module
 */
import type {CACHE_ENTRY_MISSING} from './definition.ts';

//region Persisted data records estimates without granting qualification.
/** Complete persisted entry admitted only after schema and profile validation. */
export type RelevanceEntry={
 /** Fixed persisted schema. */
 readonly schema:1;
 /** Content-addressed rule identity. */
 readonly key:string;
 /** Original fixed classifier profile. */
 readonly profileKey:string;
 /** Finite relevance estimate in the closed unit interval. */
 readonly probability:number;
 /** Cached estimates never qualify an exclusion. */
 readonly qualification:'not-established';
};
/** Diagnostics retain original failures without interpreting policy content. */
export type CacheTrace=(event:{
 /** Original operation event. */
 readonly event:string;
 /** Observed directory, when applicable. */
 readonly path?:string;
 /** Requested digest, when applicable. */
 readonly key?:string;
 /** Original caught value, when applicable. */
 readonly error?:unknown;
})=>void;
/** Publication cannot overwrite the first completed same-key estimate. */
export type RelevancePublication={
 /** Already-derived content digest. */
 readonly key:string;
 /** Validated relevance estimate. */
 readonly probability:number;
};
//endregion

//region The owner joins initialization and same-key publications before returning entries.
/** Cache misses travel to classification as a distinct domain state. */
export type RelevanceStore={
 /** Namespace identity exists before any filesystem work. */
 readonly namespaceKey:string;
 /** Missing files require classification; invalid files reject. */
 readonly read:(key:string)=>Promise<RelevanceEntry|typeof CACHE_ENTRY_MISSING>;
 /** Original completed publication wins over later estimates. */
 readonly put:(input:RelevancePublication)=>Promise<RelevanceEntry>;
};
/** Fixed namespace and profile scope every persisted estimate. */
export type RelevanceStoreInput={
 /** Application-owned private cache parent. */
 readonly directory:string;
 /** Repository identity is separate from source instruction authority. */
 readonly namespace:{
  /** Original repository identity. */
  readonly repository:string;
  /** Fixed primary branch identity. */
  readonly primaryBranch:string;
 };
 /** Classifier profile digest retained in each entry. */
 readonly profileKey:string;
 /** Original diagnostic sink. */
 readonly trace:CacheTrace;
};
//endregion
