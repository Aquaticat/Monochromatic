import { JUDGE_POLICY_BLOCK, } from './house-policy.ts';

//region Polish gate house rules
// THE ONE HUNDRED AND FOURTH CLASS (CuspariaKLSY9, 2026-09-23). The
// consolidation polish gate's two policies were fidelity-first and carried no
// house rule, so when GLM-5.3-Flash's polish moved the seven lines of a life
// that has ended into the past tense, as the house rule sets, the gate refused
// it 4 of 4 as "an unsupported change in meaning" about "a living person". The
// slate before it had split 1.5 to 1 to 1 among past-tense candidates against
// the minimum of 2, so the present-tense standing shipped. Every other judging
// sheet has carried `JUDGE_POLICY_BLOCK` since the seventy-sixth class; the
// polish gate joins them, with the tense point made where the gate reads it.

/**
 House rules the polish gate reads after its fidelity policy: the tense the
 house rule sets is not a change of meaning, and the rest of the block.

 @example
 ```ts
 const system = `${COMPARATIVE_POLISH_POLICY}\n\n${POLISH_GATE_HOUSE_RULES}`;
 ```
 */
export const POLISH_GATE_HOUSE_RULES: string = `A TENSE THE HOUSE RULES SET IS NOT A CHANGE OF MEANING. The Chinese marks no tense, so a polished text that moves the narrative of a life that has ended into the past tense, or holds one tense where the base mixed two, has added nothing and dropped nothing; choose base over it only for a fault of another kind. The person these pages remember has died; a present-tense line about their life is the base's choice, not a fact the polish contradicts.

${JUDGE_POLICY_BLOCK}`;
//endregion Polish gate house rules
