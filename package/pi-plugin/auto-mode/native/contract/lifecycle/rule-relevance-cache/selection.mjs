import {createBootstrapPolicySelection as createOriginalSelection} from '../../collector/host-governing-policy/selection.mjs';
import {bindRuleRelevanceCache} from './cache.ts';

/** Extend the incumbent policy source owner rather than create another source or session registry. */
export function createBootstrapPolicySelection({
  root,
  relativePath,
  requiredMode,
  relevance
}){
 const selection=createOriginalSelection({
   root,
   relativePath,
   requiredMode
 });
 if(relevance===undefined)return selection;
 const cache=bindRuleRelevanceCache({
   ...relevance,
   profile:{
     ...relevance.profile,
     policyScope:relativePath
   },
   selection
 });
 return Object.freeze({
   ...selection,
   refreshRelevance:cache.refresh,
   readRelevance:cache.readCurrent,
   assertRelevanceCurrent:cache.assertCurrent
 });
}
