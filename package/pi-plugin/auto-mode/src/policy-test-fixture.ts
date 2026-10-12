/**
 Authored facts for pure-kernel tests, never native admission evidence.

 @module
 */
import type {
  AuthorizationRequirement,
  InstructionRule,
} from '@monochromatic-dev/pi-plugin-auto-mode';

/**
 Make independently varied directive facts.
 
 @param overrides - facts varied by the current case
 
 @returns authored rule, not source authority
 */
export function policyRule(overrides: Partial<InstructionRule> = {},): InstructionRule {
  return {
    id: 'rule',
    priority: 0,
    effect: 'permit',
    applicability: 'applies',
    ...overrides,
  };
}

/**
 Make independently varied authorization constraints.
 
 @param overrides - facts varied by the current case
 
 @returns authored constraint with explicitly assumed approval sufficiency
 */
export function policyRequirement(overrides: Partial<AuthorizationRequirement> = {},): AuthorizationRequirement {
  return {
    id: 'requirement',
    applicability: 'applies',
    satisfaction: 'unsatisfied',
    channel: 'incumbent-approval',
    ...overrides,
  };
}
