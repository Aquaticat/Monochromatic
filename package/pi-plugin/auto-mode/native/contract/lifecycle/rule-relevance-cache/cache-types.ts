/**
 Relevance refresh contracts retain original source custody without granting permission.
 @module
 */
import type {PolicyIndex,PolicyIndexInput,PolicySourceSpan} from '../../policy-index-types.ts';
import type {RelevanceQuestion} from './definition.ts';
import type {CacheTrace,RelevanceStoreInput} from './store-types.ts';

//region Source and rule identities precede relevance estimates.
/** Minimal original policy view consumed by relevance indexing. */
export type RelevanceSource={
 /** Complete source text retained by its original selector. */
 readonly content:string;
 /** Digest of the exact original source bytes. */
 readonly sha256:string;
};
/** Literal tagged rule with a context-sensitive cache key. */
export type RelevanceRule=PolicySourceSpan&{
 /** Original literal source handle. */
 readonly id:string;
 /** Fixed profile, scope, context, and text digest. */
 readonly key:string;
 /** Original heading text without semantic interpretation. */
 readonly headings:readonly string[];
};
/** Structural index and cache keys refer to one original source occurrence. */
export type MaterializedRelevance={
 /** Complete structural source accounting. */
 readonly index:PolicyIndex;
 /** Ordered literal source rules. */
 readonly rules:readonly RelevanceRule[];
};
/** Fixed classifier identity separates entries belonging to different relevance tasks. */
export type RelevanceProfile={
 /** Original classifier model identity. */
 readonly model:string;
 /** Fixed question revision. */
 readonly questionVersion:string;
 /** Fixed guard remit revision. */
 readonly remitVersion:string;
 /** Fixed qualification revision, without establishing qualification. */
 readonly qualificationVersion:string;
 /** Declared policy path, defaulting to the incumbent root filename. */
 readonly policyScope?:string;
};
//endregion

//region One changed-rule batch remains data for the fixed relevance question.
/** Classification request cannot choose instruction authority or grant execution. */
export type RelevanceRequest={
 /** Complete source retained for classifier context. */
 readonly fullPolicy:string;
 /** Exact original source digest. */
 readonly sourceSHA256:string;
 /** Fixed classifier profile digest. */
 readonly profileKey:string;
 /** Original unchanged relevance wording. */
 readonly definition:RelevanceQuestion;
 /** Only changed or missing rules require classification. */
 readonly rules:readonly RelevanceRule[];
 /** Classification alone cannot qualify exclusions. */
 readonly semanticQualification:'not-established';
};
/** Original caller owns cancellation throughout the refresh lifetime. */
export type RelevanceRefreshInput={
 /** Absence means the caller supplied no cancellation signal. */
 readonly signal?:AbortSignal;
};
/** Diagnostic boundaries allow original failures to remain inspectable. */
export type RelevanceTrace=(event:Parameters<CacheTrace>[0]&{
 /** Original source digest when the event belongs to a refresh. */
 readonly sourceSHA256?:string;
 /** Changed batch membership. */
 readonly count?:number;
 /** Requested classification membership at view publication. */
 readonly requested?:number;
 /** Reused completed cache membership at view publication. */
 readonly reused?:number;
})=>void;
//endregion

//region Current views keep every rule included until independent qualification exists.
/** Completed unqualified view belongs to one original source occurrence and cache owner. */
export type RelevanceView={
 /** Original source digest. */
 readonly sourceSHA256:string;
 /** Fixed repository namespace. */
 readonly namespaceKey:string;
 /** Fixed classifier profile. */
 readonly profileKey:string;
 /** Estimates retain exact original rule identity and source span. */
 readonly rules:readonly (RelevanceRule&{
  /** Validated finite relevance estimate. */
  readonly probability:number;
  /** No cached estimate establishes an exclusion. */
  readonly qualification:'not-established';
 })[];
 /** Exact changed or missing membership for this refresh. */
 readonly requestedRuleIds:readonly string[];
 /** Structural accounting is separate from semantic qualification. */
 readonly structuralCoverage:PolicyIndex['structuralCoverage'];
 /** Original retained nodes outside the literal-tag profile. */
 readonly unclassifiedNodes:number;
 /** All original tagged rules remain candidates. */
 readonly candidateRuleIds:readonly string[];
 /** Relevance caching cannot exclude a rule. */
 readonly exclusionsAdmitted:false;
 /** Relevance caching cannot approve execution. */
 readonly permission:false;
};
/** Source-identity jobs and view ownership remain private to this bound cache. */
export type RelevanceCache={
 /** Join one original source occurrence's pending or completed refresh. */
 readonly refresh:(input?:RelevanceRefreshInput)=>Promise<RelevanceView>;
 /** Reject foreign, superseded, or stale original-source views. */
 readonly assertCurrent:(view:RelevanceView)=>void;
 /** Read only the last completed view still owned by the current original source. */
 readonly readCurrent:()=>RelevanceView;
 /** Fixed classifier profile digest. */
 readonly profileKey:string;
 /** Fixed repository namespace digest. */
 readonly namespaceKey:string;
};
/** Bootstrap supplies the original selector, qualified parser, and classifier callback. */
export type RelevanceCacheInput=Pick<RelevanceStoreInput,'directory'|'namespace'>&{
 /** Source custody stays with the incumbent original selector. */
 readonly selection:{
  /** Return the current original source occurrence. */
  readonly capture:()=>RelevanceSource;
  /** Recheck original source custody and freshness. */
  readonly assertCurrent:(source:RelevanceSource)=>void;
 };
 /** Incumbent Markdown parser retains original source positions. */
 readonly parse:PolicyIndexInput['parse'];
 /** Exact original classifier identity and scope. */
 readonly profile:RelevanceProfile;
 /** Untrusted classifier delivery is validated before any entry is published. */
 readonly assessBatch:(input:RelevanceRefreshInput&{
  /** Original changed membership and complete source context. */
  readonly request:RelevanceRequest;
 })=>Promise<unknown>;
 /** Original diagnostic sink, including controlled lifecycle boundaries. */
 readonly trace:RelevanceTrace;
};
//endregion
