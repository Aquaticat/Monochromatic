/**
 Authored facts for pure-kernel tests, never native admission evidence.

 @module
 */
import type {
  AuthorizationRequirement,
  InstructionRule,
} from '@monochromatic-dev/pi-plugin-auto-mode';

/**
 Each optional field is a genuine test-case override of the authored default.
 */
type RuleFixtureOverrides = {
  /**
   Identity override for cases with multiple rules.
   */
  readonly id?: string;
  /**
   Priority override for precedence cases.
   */
  readonly priority?: number;
  /**
   Effect override for directive and uncertainty cases.
   */
  readonly effect?: InstructionRule['effect'];
  /**
   Application override for scope and uncertainty cases.
   */
  readonly applicability?: InstructionRule['applicability'];
};

/**
 Each optional field independently varies one authorization proposition.
 */
type RequirementFixtureOverrides = {
  /**
   Identity override for cases with multiple constraints.
   */
  readonly id?: string;
  /**
   Application override for scope and uncertainty cases.
   */
  readonly applicability?: AuthorizationRequirement['applicability'];
  /**
   Fulfillment override independent of directive permission.
   */
  readonly satisfaction?: AuthorizationRequirement['satisfaction'];
  /**
   Channel-sufficiency override independent of UI availability.
   */
  readonly channel?: AuthorizationRequirement['channel'];
};

/**
 Make independently varied directive facts.
 
 @param overrides - facts varied by the current case
 
 @returns authored rule, not source authority
 
 @example
 ```ts
 policyRule({ effect: 'prohibit' });
 ```
 */
export function policyRule(overrides: RuleFixtureOverrides = {},): InstructionRule {
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
 
 @example
 ```ts
 policyRequirement({ satisfaction: 'satisfied' });
 ```
 */
export function policyRequirement(overrides: RequirementFixtureOverrides = {},): AuthorizationRequirement {
  return {
    id: 'requirement',
    applicability: 'applies',
    satisfaction: 'unsatisfied',
    channel: 'incumbent-approval',
    ...overrides,
  };
}
