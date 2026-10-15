import {SourceCollectionError} from '../../collector.mjs';
import {createBootstrapPolicySelection} from '../../../lifecycle/rule-relevance-cache/selection.mjs';
/** Keep governing selection and relevance attached to the original resource record. */
export function createResourcePolicy({known}){
/** Only the bootstrap holder of this existing constructor owner may designate a governing policy input. */
  function designateGoverningPolicy({
    loader,
    root,
    relativePath,
    requiredMode,
    relevance
  }){
    const record=known(loader);
    if(record.policySelection)throw new SourceCollectionError('Governing policy selection is already fixed for this resource owner');
    const selection=createBootstrapPolicySelection({
      root,
      relativePath,
      requiredMode,
      relevance
    });
    selection.capture();record.policySelection=selection;
  }
/** Bootstrap and fixed native consumers read the exact constructor-owned policy selection. */
  function captureGoverningPolicy(loader){
    const selection=known(loader)
      .policySelection;
    if(!selection)throw new SourceCollectionError('Resource constructor has no explicit governing policy designation');
    return selection.capture();
  }
async function refreshGoverningRelevance({
    loader,
    signal
  }){
    const record=known(loader);
      const selection=record.policySelection;
    if((typeof selection?.refreshRelevance)!=='function')throw new SourceCollectionError('Governing policy relevance was not configured by this constructor owner');
    if((typeof signal?.throwIfAborted)!=='function')throw new SourceCollectionError('Original relevance refresh cancellation is required');
    signal.throwIfAborted();
    const completion=Promise.withResolvers();record.relevancePending
      .add(completion.promise);
    try{
      const view=await selection.refreshRelevance({signal});
      signal.throwIfAborted();selection.assertRelevanceCurrent(view);return view;
    }catch(error){record.relevanceFailureCount+=1;throw error;}
    finally{record.relevancePending
      .delete(completion.promise);completion.resolve();}
  }
function readGoverningRelevance(loader){
    const selection=known(loader)
      .policySelection;
    if((typeof selection?.readRelevance)!=='function')throw new SourceCollectionError('Governing policy relevance is unavailable; keep rules included');
    return selection.readRelevance();
  }
function assertGoverningRelevanceCurrent({
    loader,
    view
  }){
    const selection=known(loader)
      .policySelection;
    if((typeof selection?.assertRelevanceCurrent)!=='function')throw new SourceCollectionError('Governing policy relevance is unavailable');
    selection.assertRelevanceCurrent(view);
  }
return {designateGoverningPolicy,captureGoverningPolicy,refreshGoverningRelevance,readGoverningRelevance,assertGoverningRelevanceCurrent};
}
