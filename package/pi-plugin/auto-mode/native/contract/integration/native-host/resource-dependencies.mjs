/**
 Static native dependencies preserve original generated constructors and private-field reader identities.
 */
export { createResourceInputOwner } from '../../collector/rule-relevance-sdk-copy/input/resource-owner.mjs';
export { createGoverningPolicyLoader } from '../policy-source/system-slot.mjs';
export {
  DefaultResourceLoader,
  readNativeExtensionToolInputs,
  readNativeExtensionToolOrigin,
  readNativeExtensionToolInputUsage,
} from '../native-batch/generated/resource-loader.mjs';
export {
  readActiveSessionResourceLoader,
  readActiveSessionSystemPrompt,
  readActiveSessionBaseComposition,
  readActiveSessionRunComposition,
  readActiveSessionInputUsage,
  readActiveSessionDomainEvents,
  readActiveSessionConstructedInputs,
} from '../native-batch/generated/agent-session.mjs';
