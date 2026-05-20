# Low-impact TypeScript formatter rules

This project does not invest in low-impact TypeScript formatter rules while
building newline-first formatting in `@monochromatic-dev/config-oxlint-stylistic`.

## Why this is out of scope

The formatter direction is newline-first readability, not dprint equivalence.
Dense same-line structure hurts scanning more than token-level polish. The useful
work is to make high-impact lists, block bodies, and expression chains expand
predictably across lines.

Several formatter ideas do not clear that bar:

- Type parameter newline rules add noise in generic-heavy code but rarely make
  everyday code easier to scan. A single `<T>` or `<const TData>` is already
  readable, and multi-parameter generic declarations are much less common than
  function arguments, object literals, arrays, and type members.
- Type argument newline rules have the same problem. They mostly affect call
  sites with explicit generic arguments, which are uncommon compared with normal
  value arguments. Splitting value arguments provides the readable call shape;
  splitting type arguments adds little.
- Import attribute newline rules have tiny surface area in this workspace. Static
  asset imports exist, but the attribute object is usually short and not a major
  readability bottleneck.
- Enum member newline rules are irrelevant because enums are banned by local
  syntax policy. Do not write formatter work for syntax the repo should not
  contain.
- Quote normalization is not part of the newline-first formatter goal. It is
  token polish, not structure. Safe quote conversion has edge cases around
  escapes, directive prologues, JSX, and template literals; the readability payoff
  does not justify the rule surface.

## What we do instead

Implement newline-first rules that change code shape in places readers actually
scan:

- one item per line for high-impact lists;
- trailing delimiters in multiline lists;
- block body content on separate lines;
- binary, logical, member, and call-chain newline rules.

Token-level details such as quote style, semicolon style, and ordinary spacing
can remain outside the local formatter unless a later concrete readability bug
shows they matter.

## Related tracking issues

- #206: high-impact one-item-per-line rules.
- #207: trailing delimiters in multiline lists.
- #208: block body newline rule.
- #209: expression newline rules.

## Re-evaluation

Revisit one of these exclusions only with evidence from real code review pain:
repeated comments, recurring unreadable diffs, or a measurable lint backlog in
that exact syntax category. General formatter completeness is not enough.
