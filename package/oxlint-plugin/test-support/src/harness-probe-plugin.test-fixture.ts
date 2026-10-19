/**
 Oxlint plugin that exists to misbehave on demand, so the fixture runner can be shown a plugin that throws.

 Three rules, each enabled alone or together by the config a test writes: one reports every program, one
 reports nothing, and one throws on every program the way a crashed plugin does.

 @module
 */

/**
 Diagnostic these rules report.
 */
type ProbeDiagnostic = {
  /**
   Node the diagnostic points at.
   */
  readonly node: unknown;
  /**
   Text shown to the reader.
   */
  readonly message: string;
};

/**
 Subset of the rule context these rules read.
 */
type ProbeContext = {
  /**
   Reports one diagnostic at a node.
   */
  readonly report: (diagnostic: ProbeDiagnostic,) => void;
};

/**
 Message of the error the throwing rule raises, searched for by tests.
 */
export const PROBE_FAILURE_TEXT = 'harness probe plugin failed on purpose';

/**
 Plugin whose rules report, stay quiet, or throw.
 */
const plugin = {
  meta: { name: 'harness-probe', },
  rules: {
    'reports-program': {
      create(context: ProbeContext,): { readonly Program: (node: unknown,) => void; } {
        return {
          Program(node,): void {
            context.report({
              node,
              message: 'harness probe report',
            },);
          },
        };
      },
    },
    'reports-nothing': {
      create(): object {
        return {};
      },
    },
    'always-throws': {
      create(): { readonly Program: () => void; } {
        return {
          Program(): void {
            throw new Error(PROBE_FAILURE_TEXT,);
          },
        };
      },
    },
  },
};

export default plugin;
