//region Credential mask
// Replaces every copy of a credential a request carried inside the text a
// provider answered with, so the credential never leaves the transport.
//
// WHY AT THE TRANSPORT. A provider may echo a sent credential in a reply body,
// an authentication failure's body being the plausible place, and everything
// above the transport reads that body: the status failure's message and
// excerpt, the raw reply preview a probe prints, a malformed-completion
// message, a cached reply. One mask where the body is assembled closes all of
// them at once.
//
// NO REGULAR EXPRESSION IS BUILT FROM A CREDENTIAL. A key may hold characters a
// pattern reads as syntax, and building the pattern from it is the shape that
// fails on exactly the keys that need masking. Each credential is found by a
// linear scan (Knuth-Morris-Pratt), so a long body and a long credential cost
// the sum of their lengths, never the product.
//
// THE CLOSED LIST OF CREDENTIAL HEADERS is the one place a new client's
// credential header must be written down: a header named here has its value
// masked, a header not named here is taken for no credential (`content-type`
// and `anthropic-version` are values every reply would otherwise be rewritten
// by).

/**
 Text written where a credential was masked.

 FREE OF `"`, `\` AND EVERY CHARACTER A JSON STRING ESCAPES, so a credential
 standing inside a JSON string leaves that string as valid as it was.
 */
export const CREDENTIAL_MARKER = '[masked: credential sent with this request]';

/**
 Fewest UTF-16 units a secret must hold to be masked.

 A CHOICE, NOT A MEASUREMENT. The stand-in key of this package's cases holds
 16 units; a value shorter than 12 is, by inference, no key a provider
 issues, and masking it would rewrite ordinary words of a reply. A credential
 below the bound is left alone.
 */
export const MINIMUM_CREDENTIAL_UNITS = 12;

/**
 Fewest leading units of a credential that a text ending in them is read as a
 credential cut short, and masked.

 A CHOICE, NOT A MEASUREMENT. A head shorter than this is, by inference, too
 little of a 12-unit secret to be worth the ordinary words a shorter rule
 would rewrite at the end of an excerpt (a text ending in `s` would match
 every key that begins with `s`); the cost is that the first three units of a
 credential may show where a stream was cut inside it.
 */
const MINIMUM_HEAD_UNITS = 4;

/**
 Lower-case names of the request headers that carry a credential: an
 authorization value, an API key and a session token.
 */
const CREDENTIAL_HEADER_NAMES: ReadonlySet<string> = new Set([
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'api-key',
  'x-amz-security-token',
],);

/**
 Span of the text one credential occupies.
 */
type Span = {
  /**
   Index of its first unit.
   */
  readonly start: number;

  /**
   Index one past its last unit.
   */
  readonly end: number;
};

/**
 Lists what a request's headers carry as credential: for each credential
 header, its whole value and, where the value is a scheme word and a token, the
 token alone, since a provider may echo either.

 @param headers - request headers, names in any case

 @returns Whole values and tokens whose secret holds at least the minimum
 units; empty where the request carried none

 @example
 ```ts
 credentialsOfHeaders({ headers: { Authorization: 'Bearer whisker-key-7421', }, },);
 // => ['Bearer whisker-key-7421', 'whisker-key-7421']
 ```
 */
export function credentialsOfHeaders(
  { headers, }: { readonly headers: Readonly<Record<string, string>>; },
): readonly string[] {
  return Object.entries(headers,)
    .flatMap(function credentialsOfHeader([name, value,],): readonly string[] {
      if (!CREDENTIAL_HEADER_NAMES.has(name.toLowerCase(),))
        return [];

      /**
       Value as the wire carries it, without the whitespace around it.
       */
      const whole = value.trim();

      /**
       Where the scheme word ends, or nothing when the value has none.
       */
      const gap = whole.indexOf(' ',);

      /**
       The secret: the token after the scheme word, or the whole value.
       */
      const secret = (gap === (-1))
        ? whole
        : whole.slice(gap + 1,)
          .trimStart();
      if (secret.length < MINIMUM_CREDENTIAL_UNITS)
        return [];

      if (secret === whole)
        return [whole,];

      return [
        whole,
        secret,
      ];
    },);
}

/**
 Spellings a credential may take inside a reply: itself, as a JSON string
 holds it, and as a JSON writer that escapes the slash holds it.

 @param credential - credential to spell

 @returns Distinct spellings, the credential first

 @example
 ```ts
 spellingsOf({ credential: 'a/b"c-0123456789', },);
 ```
 */
function spellingsOf({ credential, }: { readonly credential: string; },): readonly string[] {
  /**
   The credential between the quotes JSON writes around it.
   */
  const escaped = JSON.stringify(credential,)
    .slice(
      1,
      -1,
    );
  return [
    ...new Set([
      credential,
      escaped,
      escaped.split('/',)
        .join(String.raw`\/`,),
    ],),
  ];
}

/**
 Builds the Knuth-Morris-Pratt table of a needle: for each prefix, the length
 of its longest proper prefix that is also its suffix.

 @param needle - non-empty text to find

 @returns Table with one entry per unit of the needle

 @example
 ```ts
 failureTable({ needle: 'abab', },); // [0, 0, 1, 2]
 ```
 */
function failureTable({ needle, }: { readonly needle: string; },): readonly number[] {
  /**
   Table being filled, one entry per unit.
   */
  const table = Array.from(
    { length: needle.length, },
    function zero(): number {
      return 0;
    },
  );
  /**
   Length of the prefix the unit under the cursor extends.
   */
  const cursor = { matched: 0, };
  for (let at = 1; at < needle.length; at += 1) {
    while ((cursor.matched > 0) && (needle.codePointAt(at,) !== needle.codePointAt(cursor.matched,)))
      cursor.matched = table[cursor.matched - 1] ?? 0;

    if (needle.codePointAt(at,) === needle.codePointAt(cursor.matched,))
      cursor.matched += 1;

    table[at] = cursor.matched;
  }
  return table;
}

/**
 Finds every span of a needle in a text in one pass over the text.

 @param text - text searched

 @param needle - non-empty text to find

 @returns Spans in the order their ends fall, overlapping ones included

 @example
 ```ts
 findSpans({ text: 'xxabxx', needle: 'ab', },); // [{ start: 2, end: 4, }]
 ```
 */
function findSpans(
  {
    text,
    needle,
  }: {
    readonly text: string;
    readonly needle: string;
  },
): readonly Span[] {
  /**
   Table telling a mismatch how much of the match survives.
   */
  const table = failureTable({ needle, },);
  /**
   Spans found.
   */
  const spans: Span[] = [];
  /**
   Units of the needle matched at the cursor.
   */
  const cursor = { matched: 0, };
  for (let at = 0; at < text.length; at += 1) {
    while ((cursor.matched > 0) && (text.codePointAt(at,) !== needle.codePointAt(cursor.matched,)))
      cursor.matched = table[cursor.matched - 1] ?? 0;

    if (text.codePointAt(at,) === needle.codePointAt(cursor.matched,))
      cursor.matched += 1;

    if (cursor.matched === needle.length) {
      spans.push({
        start: (at + 1) - needle.length,
        end: at + 1,
      },);
      cursor.matched = table[cursor.matched - 1] ?? 0;
    }
  }
  return spans;
}

/**
 Replaces every copy of each credential in a text by the marker.

 EVERY CREDENTIAL IS FOUND IN THE ORIGINAL TEXT and overlapping or touching
 finds become one marker, so a whole header value and the token inside it
 leave one marker, and a marker's own wording is never searched. Matching is by
 UTF-16 unit; a credential is a header value, whose units are all below 256, so
 no match can begin or end inside a surrogate pair.

 @param text - reply text, of any shape: JSON, event frames or prose

 @param credentials - secrets the request carried; one holding fewer than the
 minimum units, or none, is left unmasked

 @returns The text with every copy masked, the very same string when none was found

 @example
 ```ts
 maskCredentials({ text: 'bad key whisker-key-7421', credentials: ['whisker-key-7421',], },);
 ```
 */
export function maskCredentials(
  {
    text,
    credentials,
  }: {
    readonly text: string;
    readonly credentials: readonly string[];
  },
): string {
  /**
   Credentials long enough to mask, each once.
   */
  const needles = [
    ...new Set(credentials.filter(function longEnough(credential,): boolean {
      return credential.length >= MINIMUM_CREDENTIAL_UNITS;
    },),),
  ];

  /**
   Spans of every spelling of every credential, in the original text.
   */
  const found = needles
    .flatMap(function spellings(credential,): readonly string[] {
      return spellingsOf({ credential, },);
    },)
    .flatMap(function spansOf(needle,): readonly Span[] {
      return findSpans({
        text,
        needle,
      },);
    },)
    .toSorted(function byStart(
      left,
      right,
    ): number {
      return left.start - right.start;
    },);
  if (found.length === 0)
    return text;

  /**
   Pieces of the result, in order.
   */
  const parts: string[] = [];
  /**
   Where the unmasked text resumes, and the end of the last masked stretch (nothing before the first).
   */
  const cursor = {
    resume: 0,
    maskedTo: -1,
  };
  for (const span of found) {
    if (span.start <= cursor.maskedTo) {
      cursor.maskedTo = Math.max(
        cursor.maskedTo,
        span.end,
      );
      cursor.resume = cursor.maskedTo;
      continue;
    }
    parts.push(
      text.slice(
        cursor.resume,
        span.start,
      ),
      CREDENTIAL_MARKER,
    );
    cursor.resume = span.end;
    cursor.maskedTo = span.end;
  }
  parts.push(text.slice(cursor.resume,),);
  return parts.join('',);
}

/**
 Length of the longest ending of a text that is the opening of one of the
 needles, a credential the text was cut inside.

 @param text - text that may end inside a credential

 @param needles - spellings of the credentials to look for

 @returns Units of the ending, zero when none is as long as the minimum head

 @example
 ```ts
 trailingHeadUnits({ text: 'says whisker-k', needles: ['whisker-key-7421',], },); // 9
 ```
 */
function trailingHeadUnits(
  {
    text,
    needles,
  }: {
    readonly text: string;
    readonly needles: readonly string[];
  },
): number {
  return Math.max(
    0,
    ...needles.map(function headOf(needle,): number {
      for (let units = Math.min(
        needle.length - 1,
        text.length,
      ); units >= MINIMUM_HEAD_UNITS; units -= 1) {
        if (text.endsWith(needle.slice(
          0,
          units,
        ),))
          return units;
      }
      return 0;
    },),
  );
}

/**
 Replaces every copy of each credential in a text that may have been cut
 short, and the opening of a credential the text ends inside, by the marker.

 FOR TEXT CUT OFF BEFORE ITS END, an excerpt of a stream that was torn down:
 the credential the stream was saying when it stopped has no copy to find, and
 its first units would show. The mask is applied to the whole text first and
 the ending read after it, so a caller cuts its excerpt from what this
 returns and never masks an excerpt already cut.

 @param text - generated text so far, of any shape

 @param credentials - secrets the request carried; one holding fewer than the
 minimum units, or none, is left unmasked

 @returns The text with every copy masked and any ending that is at least the
 minimum head of a credential masked too, the very same string when neither
 was found

 @example
 ```ts
 maskCredentialsInCutText({ text: 'says whisker-k', credentials: ['whisker-key-7421',], },);
 ```
 */
export function maskCredentialsInCutText(
  {
    text,
    credentials,
  }: {
    readonly text: string;
    readonly credentials: readonly string[];
  },
): string {
  /**
   Text with every whole copy masked.
   */
  const masked = maskCredentials({
    text,
    credentials,
  },);

  /**
   Spellings of the credentials long enough to mask.
   */
  const needles = credentials
    .filter(function longEnough(credential,): boolean {
      return credential.length >= MINIMUM_CREDENTIAL_UNITS;
    },)
    .flatMap(function spellings(credential,): readonly string[] {
      return spellingsOf({ credential, },);
    },);

  /**
   Units of the ending that is a credential's opening.
   */
  const head = trailingHeadUnits({
    text: masked,
    needles,
  },);
  if (head === 0)
    return masked;

  return masked.slice(
    0,
    masked.length - head,
  ) + CREDENTIAL_MARKER;
}

//endregion Credential mask
