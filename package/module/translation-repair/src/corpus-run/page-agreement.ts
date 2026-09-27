import type { ParsedArchiveText, } from './artifact-two-lane-read-contract.ts';
import type { WouldShipSource, } from './would-ship-text.ts';
import {
  type PageLengthCheck,
  pageCarriesEveryWording,
  pageWeighsWhatItShould,
  pageWeightRefutes,
  type PageWordingCheck,
} from './published-page-check.ts';

//region Page agreement
// WHETHER A PAGE ON DISK CARRIES WHAT ITS ARTIFACT SAYS SHIPS, decided once for
// both readers (ledger A16c). `verify-published` reports it, and a pass starting
// in a runs directory rewrites from its artifact a page that does not; two
// definitions would have the pass rewrite pages the verifier accepts, or leave
// pages the verifier reports. Moved out of `verify-published.ts`, where it was
// the body of the entry report.

/**
 What one entry's page came to against its artifact.

 THREE ANSWERS, NOT TWO. A page that carries every wording but whose length
 could not be checked is not the evidence a weighed page is.

 @example
 ```ts
 const agreement: EntryAgreement = 'agreed-unweighed';
 ```
 */
export type EntryAgreement = 'agreed-weighed' | 'agreed-unweighed' | 'disagreed';

/**
 What the judgement reads of an artifact: what each slice ships, and the
 archive text it stored, which a parsed settled artifact carries.

 @example
 ```ts
 const source: AgreementSource = parseSettledTwoLaneArtifact({ value, },);
 ```
 */
export type AgreementSource = WouldShipSource & {
  /**
   The slicing's record, read for the archive it stored.
   */
  readonly preparation: {
    /**
     Whole archive English, or that the file predates storing it.
     */
    readonly archiveText: ParsedArchiveText;
  };
};

/**
 The verdict and the two checks behind it, for a reader that reports them.

 @example
 ```ts
 const { agreement, wording, weight, wrongLength, } = pageAgreement({ artifact, pageText, },);
 ```
 */
export type PageAgreement = {
  /**
   The verdict.
   */
  readonly agreement: EntryAgreement;

  /**
   Which wordings the page carries.
   */
  readonly wording: PageWordingCheck;

  /**
   What the page weighs against what it should.
   */
  readonly weight: PageLengthCheck;

  /**
   Whether the length says text no slice decided on was lost or added.
   */
  readonly wrongLength: boolean;
};

/**
 Judges one page against its artifact.

 @param artifact - settled artifact, read for what each slice ships and the
 archive text it stored

 @param pageText - page as it sits on disk

 @returns The verdict and what decided it

 @example
 ```ts
 if (pageAgreement({ artifact, pageText, },).agreement === 'disagreed') republish();
 ```
 */
export function pageAgreement(
  {
    artifact,
    pageText,
  }: {
    readonly artifact: AgreementSource;
    readonly pageText: string;
  },
): PageAgreement {
  /**
   What the page turned out to carry.
   */
  const wording = pageCarriesEveryWording({
    artifact,
    pageText,
  },);

  /**
   What the page should weigh against what it does, or that the artifact
   predates the stored archive text and nothing can be weighed.
   */
  const weight = pageWeighsWhatItShould({
    artifact,
    archive: artifact
      .preparation
      .archiveText,
    pageText,
  },);

  /**
   Whether the length says the page lost or gained text nobody decided on.
   */
  const wrongLength = pageWeightRefutes({ weight, },);

  /**
   Wordings the page does not carry.
   */
  const { missing, } = wording;

  /**
   The verdict both checks come to.
   */
  const agreement: EntryAgreement = (wrongLength || (missing.length > 0))
    ? 'disagreed'
    : ((weight.kind === 'unweighable') ? 'agreed-unweighed' : 'agreed-weighed');

  return {
    agreement,
    wording,
    weight,
    wrongLength,
  };
}

//endregion Page agreement
