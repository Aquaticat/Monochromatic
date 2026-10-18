/** Original policy-input capability follows its typed implementation. @module */
export {
  PolicySlotBindingError,
  readPolicyInput,
  readSystemPolicyInput,
  assertPolicyInput,
  assertSystemPolicyInput,
  readAuthorityRegistration,
  readHostPromptInput,
  bindPolicyCollector,
  bindPolicySessionCollector,
  createGoverningPolicyLoader,
  createSystemPolicyLoader
} from './system-slot.ts';
