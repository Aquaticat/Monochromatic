# ESLint v10.4.1: disable comment descriptions require a whitespace-surrounded hyphen run

> Scratch-path note: `/tmp/agent` paths in this document are historical.
> Use `~/temp/agent` for current work.

Current status (2026-06-06):
 ESLint intentionally parses disable comment
reasons only after a whitespace-surrounded run of two or more hyphens.
 The
shortest supported separator is ` -- `.
 Longer runs such as ` -------- ` are
also supported.
 A single hyphen,
 a colon,
 or `--` without whitespace stays in
the directive value and is treated as part of the rule name.

## Symptom

A disable comment with the documented separator suppresses the target rule and
records the text after the separator as the suppression justification:

```js
// doc/troubleshooting/eslint-disable-description-separator.md
// eslint-disable-next-line no-undef -- reason
foo;
```

The same is true for longer hyphen runs:

```js
// doc/troubleshooting/eslint-disable-description-separator.md
// eslint-disable-next-line no-undef -------- reason
foo;
```

Alternate separators do not split the directive from the reason.
 ESLint treats
the entire suffix as the rule identifier and then also reports the original
rule violation:

```js
// doc/troubleshooting/eslint-disable-description-separator.md
// eslint-disable-next-line no-undef - reason
foo;

// eslint-disable-next-line no-undef: reason
foo;

// eslint-disable-next-line no-undef-- reason
foo;

// eslint-disable-next-line no-undef --reason
foo;
```

Observed ESLint v10.4.1 messages:

```text
# doc/troubleshooting/eslint-disable-description-separator.md
Definition for rule 'no-undef - reason' was not found.
Definition for rule 'no-undef: reason' was not found.
Definition for rule 'no-undef-- reason' was not found.
Definition for rule 'no-undef --reason' was not found.
'foo' is not defined.
```

## Root cause

ESLint's current JavaScript source-code path delegates directive parsing to
`@eslint/plugin-kit`.
`eslint/eslint` commit `217b2a91f46137c5ffd693965e71306c4c15ea6b`
uses `commentParser.parseDirective(comment.value)` in
`lib/languages/js/source-code/source-code.js:887` and passes the parsed
`justificationPart` into the directive in `lib/languages/js/source-code/source-code.js:925`:

```js
// /tmp/agent/eslint-disable-separator-20260606/lib/languages/js/source-code/source-code.js
const {
    label,
    value,
    justification: justificationPart,
} = commentParser.parseDirective(comment.value);

// ...

directives.push(
    new Directive({
        type: directiveType,
        node: comment,
        value,
        justification: justificationPart,
    }),
);
```

`@eslint/plugin-kit` v0.7.2 documents the field as text after `--` in
`package/plugin-kit/src/config-comment-parser.js:66`:

```js
// /tmp/agent/eslint-rewrite-plugin-kit-20260606/packages/plugin-kit/src/config-comment-parser.js
/**
 * The justification of the directive (the string after the --).
 * @type {string}
 */
justification = "";
```

The parser splits only on `\s-{2,}\s` in
`package/plugin-kit/src/config-comment-parser.js:210`.
 That means the
separator must have whitespace before it,
 at least two hyphens,
 and whitespace
after it:

```js
// /tmp/agent/eslint-rewrite-plugin-kit-20260606/packages/plugin-kit/src/config-comment-parser.js
#extractDirectiveComment(value) {
    const match = /\s-{2,}\s/u.exec(value);

    if (!match) {
        return { directivePart: value.trim(), justificationPart: "" };
    }

    const directive = value.slice(0, match.index).trim();
    const justification = value.slice(match.index + match[0].length).trim();

    return { directivePart: directive, justificationPart: justification };
}
```

`parseDirective()` then parses only the directive part before that separator,
from `package/plugin-kit/src/config-comment-parser.js:228-244`:

```js
// /tmp/agent/eslint-rewrite-plugin-kit-20260606/packages/plugin-kit/src/config-comment-parser.js
parseDirective(string) {
    const { directivePart, justificationPart } =
        this.#extractDirectiveComment(string);
    const match = directivesPattern.exec(directivePart);

    if (!match) {
        return undefined;
    }

    const directiveText = match[1];
    const directiveValue = directivePart.slice(
        match.index + directiveText.length,
    );

    return new DirectiveComment(
        directiveText,
        directiveValue.trim(),
        justificationPart,
    );
}
```

So unsupported separators are not rejected by a separate reason parser.
 They are
never recognized as separators.
 The disable directive's rule-name parser sees
`no-undef - reason`,
 `no-undef: reason`,
 or `no-undef --reason` as the rule
identifier.

The behavior comes from RFC 33 rather than an accidental implementation detail.
The RFC motivation says directive comments need colocated explanations because
exceptions to static analysis need maintenance context,
 but ESLint previously
had no comfortable way to write that explanation
(`eslint/rfcs/designs/2019-description-in-directive-comments/README.md:11-14`).
The detailed design chose exactly the same split pattern,
`\s-{2,}\s`,
 in
`eslint/rfcs/designs/2019-description-in-directive-comments/README.md:17`:

```md
<!-- /tmp/agent/eslint-rfcs-20260606/designs/2019-description-in-directive-comments/README.md -->
ESLint ignores the part preceded by `\s-{2,}\s` in directive comments.
```

The RFC also records two design constraints that explain why the separator is a
whitespace-surrounded hyphen run rather than arbitrary free text:

- It should not affect `--` inside rule configuration values.
   The RFC example
  `/* eslint spaced-comment: [error, { exceptions: ["--"] }] */` is explicitly
  called out as not affected in
  `eslint/rfcs/designs/2019-description-in-directive-comments/README.md:40-41`.
- It follows prior art from PHP_CodeSniffer,
   whose ignore syntax uses
  `// phpcs:disable PEAR,Squiz.Arrays -- this isn't our code`,
   cited in
  `eslint/rfcs/designs/2019-description-in-directive-comments/README.md:81-85`.

Earlier issue discussion also pushed against arbitrary trailing text because it
would increase directive parsing complexity and the surface area for bugs.
 That
concern appears in
[eslint/eslint#11298](https://github.com/eslint/eslint/issues/11298#issuecomment-456223984)
and
[eslint/eslint#11806](https://github.com/eslint/eslint/issues/11806#issuecomment-498802003).

## Verification

Version under test:

```text
# doc/troubleshooting/eslint-disable-description-separator.md
node v26.3.0
eslint v10.4.1
@eslint/plugin-kit v0.7.2
eslint commit 217b2a91f46137c5ffd693965e71306c4c15ea6b
plugin-kit commit ec004e6df54f52e8fbe7ec60a1abe3cb4cee55d8
```

Harness:

```sh
# doc/troubleshooting/eslint-disable-description-separator.md
TMP_DIR=$(mktemp --directory /tmp/agent/eslint-separator-harness.XXXXXXXX)
cat > "$TMP_DIR/eslint.config.js" <<'EOF'
export default [
  {
    files: ["**/*.js"],
    languageOptions: { ecmaVersion: 2026, sourceType: "script" },
    rules: { "no-undef": "error" }
  }
];
EOF
cat > "$TMP_DIR/double.js" <<'EOF'
// eslint-disable-next-line no-undef -- reason
foo;
EOF
cat > "$TMP_DIR/eight.js" <<'EOF'
// eslint-disable-next-line no-undef -------- reason
foo;
EOF
cat > "$TMP_DIR/single.js" <<'EOF'
// eslint-disable-next-line no-undef - reason
foo;
EOF
cat > "$TMP_DIR/colon.js" <<'EOF'
// eslint-disable-next-line no-undef: reason
foo;
EOF
cat > "$TMP_DIR/no-space-before.js" <<'EOF'
// eslint-disable-next-line no-undef-- reason
foo;
EOF
cat > "$TMP_DIR/no-space-after.js" <<'EOF'
// eslint-disable-next-line no-undef --reason
foo;
EOF
npx --yes eslint@10.4.1 --format json \
  "$TMP_DIR/double.js" \
  "$TMP_DIR/eight.js" \
  "$TMP_DIR/single.js" \
  "$TMP_DIR/colon.js" \
  "$TMP_DIR/no-space-before.js" \
  "$TMP_DIR/no-space-after.js"
```

Cleanly supported patterns:

- `// eslint-disable-next-line no-undef -- reason` suppressed `no-undef` and
  recorded `justification: "reason"`.
- `// eslint-disable-next-line no-undef -------- reason` suppressed `no-undef`
  and recorded `justification: "reason"`.

Failure variant,
 unrecognized rule identifier plus unsuppressed original rule:

- `// eslint-disable-next-line no-undef - reason` produced
  `Definition for rule 'no-undef - reason' was not found.` and
  `'foo' is not defined.`
- `// eslint-disable-next-line no-undef: reason` produced
  `Definition for rule 'no-undef: reason' was not found.` and
  `'foo' is not defined.`
- `// eslint-disable-next-line no-undef-- reason` produced
  `Definition for rule 'no-undef-- reason' was not found.` and
  `'foo' is not defined.`
- `// eslint-disable-next-line no-undef --reason` produced
  `Definition for rule 'no-undef --reason' was not found.` and
  `'foo' is not defined.`

## Verified workarounds

### Use the documented separator

```js
// doc/troubleshooting/eslint-disable-description-separator.md
// eslint-disable-next-line no-undef -- reason for the suppression
foo;
```

Tradeoff:
 the reason syntax is fixed by ESLint.
 A whitespace-surrounded hyphen
run is the only separator family that round-trips through ESLint's
`suppressedMessages[].suppressions[].justification` field.

### Use a longer hyphen fence when visual separation matters

```js
// doc/troubleshooting/eslint-disable-description-separator.md
// eslint-disable-next-line no-undef -------- reason for the suppression
foo;
```

Tradeoff:
 it is less common than ` -- `,
 but it is documented and covered by the
same `\s-{2,}\s` parser.

### Put the explanation in a separate normal comment

```js
// doc/troubleshooting/eslint-disable-description-separator.md
// reason for the suppression
// eslint-disable-next-line no-undef
foo;
```

Tradeoff:
 ESLint does not attach the normal comment to the suppression
justification field,
 so formatter output and `suppressedMessages` consumers do
not treat the explanation as part of the directive.

## What does not work

- Single hyphen separators such as `no-undef - reason`.
- Colon separators such as `no-undef: reason`.
- `--` without whitespace before it,
   such as `no-undef-- reason`.
- `--` without whitespace after it,
   such as `no-undef --reason`.
- Arbitrary trailing prose,
   such as `no-undef because reason`.

All of these keep the supposed reason inside the directive value,
 so ESLint
looks for a rule with that whole string as its name.

## Upstream filing artifact

Nothing to file as-is.
 This is intended,
 documented behavior from a merged RFC,
not an upstream defect.

### Out-of-scope check

No matching exemption was found under `.out-of-scope/`.
 Checked the current
files there on 2026-06-06.

### Duplicate and history search

Searches run:

```text
# doc/troubleshooting/eslint-disable-description-separator.md
gh search issues --repo eslint/eslint "Allow explanation of eslint-disable"
gh search issues --repo eslint/eslint "Allow comments after eslint-disable-line rule-name"
gh search prs --repo eslint/eslint "refs eslint/rfcs#33"
```

Relevant existing upstream records:

- [eslint/eslint#11298](https://github.com/eslint/eslint/issues/11298),
  closed issue proposing free-form comments after disable lines.
- [eslint/eslint#11806](https://github.com/eslint/eslint/issues/11806),
  closed issue proposing explanations for `eslint-disable`.
- [eslint/rfcs#33](https://github.com/eslint/rfcs/pull/33),
   merged RFC that
  selected `\s-{2,}\s`.
- [eslint/eslint#12699](https://github.com/eslint/eslint/pull/12699),
   merged
  implementation PR for RFC 33.

### Upstream filing decision

1.  Is it really upstream's fault?
     No. ESLint behaves as its current docs,
     RFC,
    and source say it should behave.
2.  Can upstream fix it?
     Upstream could add more separators as a feature
    change,
     but there is no defect to fix in the current behavior.
3.  Are they supporting this use case?
     Yes,
     they support disable comment
    descriptions through `\s-{2,}\s`,
     not through arbitrary trailing text.
4.  Would the repo welcome our contribution?
     The repository has
    `CONTRIBUTING.md`,
     issue templates,
     and `PULL_REQUEST_TEMPLATE.md`.
    `CONTRIBUTING.md:9-11` points contributors to the AI usage policy,
     and
    `doc/src/contribute/ai-policy.md:16-18` permits AI-assisted issues and
    PRs with disclosure and human review.
5.  Will they likely fix it?
     No evidence supports filing a change now.
     The
    accepted RFC and implemented docs already chose the separator.
     A broader
    separator set would need a new change request and likely another RFC.
6.  Have we prototyped a minimal fix compatible with their architecture?
     No.
    The auto-prototype condition does not hold because constraint 1 fails and
    constraint 5 is not a yes.
     A prototype would be feature work,
     not a bug
    diagnosis artifact.
