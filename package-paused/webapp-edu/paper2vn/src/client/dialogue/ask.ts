/**
 * Ask-the-persona flow.
 *
 * Sends the paper text plus the user's question to the LLM, returning
 * a single in-character reply. Caller appends both turns to the save's
 * memory log.
 */
import { rawString, } from '../i18n/runtime.ts';
import { chat, } from '../llm/index.ts';

/**
 * Same truncation cap as the chapter generator.
 */
const PAPER_TEXT_BUDGET = 60_000;

/**
 * Asks the persona a question grounded in the paper.
 *
 * @param paperText - the parsed paper text
 *
 * @param question - the user's question
 *
 * @param signal - optional abort signal
 *
 * @returns persona reply text
 *
 * @example
 * ```ts
 * const reply = await askPersona({
 *   paperText: 'Title: A Tiny Note...\n\nAbstract. ...',
 *   question: 'What is the convergence criterion?',
 *   signal: undefined,
 * });
 * console.error(reply); // 'Master, the criterion plateaus when ...'
 * ```
 */
export async function askPersona(
  {
    paperText,
    question,
    signal,
  }: {
    paperText: string;
    question: string;
    signal: AbortSignal | undefined;
  },
): Promise<string> {
  /**
   * Paper body capped to {@link PAPER_TEXT_BUDGET} so prompts fit context windows.
   */
  const truncated = paperText.length
    > PAPER_TEXT_BUDGET
    ? paperText.slice(
      0,
      PAPER_TEXT_BUDGET,
    )
    : paperText;
  /*
   * `rawString` instead of typesafe-i18n's templated accessor: matches
   * `generator.ts` (see comment there). The persona/askInstruction
   * strings don't contain `{}` patterns themselves, but staying on the
   * same accessor keeps these prompts immune to future i18n edits that
   * might introduce them.
   */
  /**
   * Persona prompt assembled with the paper body so the model stays grounded.
   */
  const systemMessage = `${rawString('persona',)}\n\n${
    rawString('askInstruction',)
  }\n\nPaper text follows:\n---BEGIN PAPER---\n${truncated}\n---END PAPER---`;
  return await chat({
    messages: [
      {
        role: 'system',
        content: systemMessage,
      },
      {
        role: 'user',
        content: question,
      },
    ],
    signal,
    expectJson: undefined,
  },);
}
