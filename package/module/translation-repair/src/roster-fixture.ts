//region Roster fixture
// THE SEATS UNIT TESTS SIT MODELS IN, NAMED BY THE ROLE THE TEST LEANS ON
// rather than by model, so a model leaving the roster changes one line here
// and not the hundred-odd tests that only needed "a Hyper-only model" or
// "a Synthetic model that reads pictures". The owner asked for this on
// 2026-09-16 after the DeepSeek V4 unseat touched fifty-eight test files.
//
// EACH NAME IS A CLAIM ABOUT REACH, IMAGE INPUT AND HOLDS, and
// `roster-fixture.unit.test.ts` holds every claim against the cards, so a
// remapping that no longer fits its name fails there before any test that
// leaned on the claim fails somewhere else.
//
// One exported constant per seat rather than one object: declaration emit
// (`isolatedDeclarations`) infers a string literal's type and not an
// object literal's; the `as const` keeps each literal non-widening so a
// fixture object built from it keeps the id's literal type.

/**
 Synthetic, Hyper and OpenRouter serve it; reads pictures; holds the first
 editor seat and is out of the wide and late judge seats.
 */
export const SEAT_SYNTHETIC_VISION_EDITOR = 'hf:zai-org/GLM-5.3-Flash' as const;

/**
 Synthetic and Hyper serve it, OpenRouter dropped it; reads pictures.
 */
export const SEAT_SYNTHETIC_VISION_NO_OPENROUTER = 'hf:Qwen/Qwen3.8-27B' as const;

/**
 Synthetic, Hyper and OpenRouter serve it, OpenRouter withheld on cost;
 reads pictures; too slow in the select seats when Hyper serves it.
 */
export const SEAT_SYNTHETIC_VISION_WITHHELD = 'hf:moonshotai/Kimi-K3' as const;

/**
 Every provider serves it; text only; measured out of the translator seat.
 */
export const SEAT_SYNTHETIC_TEXT_EVERYWHERE = 'hf:openai/gpt-oss-120b' as const;

/**
 Hyper and OpenRouter serve it; reads pictures; holds a refiner seat.
 */
export const SEAT_HYPER_VISION = 'minimax-m3' as const;

/**
 Hyper, OpenRouter and Bedrock serve it; Bedrock alone shows it pictures.
 */
export const SEAT_HYPER_TEXT_BEDROCK = 'gemma-4-26b-a4b-it' as const;

/**
 Only Hyper serves it (OpenRouter dropped it); text only; out of the wide
 seats; holds an editor seat.
 */
export const SEAT_HYPER_ONLY = 'glm-5.3' as const;

/**
 Hyper and OpenRouter serve it; reads pictures; its writing and its
 picture reading are unmeasured.
 */
export const SEAT_HYPER_OPENROUTER_UNMEASURED = 'deepseek-v4.1-flash' as const;

/**
 Only Bedrock serves it; text only; a seated judge and measured writer.
 */
export const SEAT_BEDROCK_ONLY_TEXT = 'google.gemma-4-e2b' as const;

/**
 Only Bedrock serves it; reads pictures; no judge seat yet.
 */
export const SEAT_BEDROCK_ONLY_VISION_UNSEATED = 'google.gemma-4-31b' as const;

/**
 Only OpenRouter serves it; text only; a seated judge and measured writer.
 */
export const SEAT_OPENROUTER_ONLY = 'inception/mercury-2.5' as const;

//endregion Roster fixture
