---
name: source-audited-report
description: Use for cited reader-facing reports, not quick research, code work, or docs edits.
---

# Source-audited report

Fires when drafting or revising cited reader-facing reports.
Does not apply to quick research, code investigation, implementation planning,
issue triage, ordinary documentation edits, or short analytical answers.
Covers gathering sources, structuring sections, maintaining source quality awareness,
and writing to professional editorial standards.

Structured process for producing reference-quality research documents.
The benchmark is professional tech journalism (Ars Technica, The Verge longform) --
sourced, specific, honest about uncertainty.

## Anti-patterns to avoid

These are the most common failure modes when drafting research.
Internalize them before writing a single line.

### Confident assertion without evidence

Never present a claim without a source URL.
Third-party blog data and primary sources are not equal --
say so when citing weaker sources.

```md
<!-- Bad -->

Kickstarter has over 20 million backers worldwide.

<!-- Good -->

Kickstarter reports "over 22 million people have backed a project"
on its about page ([source](https://www.kickstarter.com/about)).
```

### Abstraction over specificity

Default to concrete examples, named entities, dates, and dollar amounts.
Never write "grew fast" when you can write "crossed $1 billion in pledges by March 2014."
Never write "a thing" when you can name the thing.

### Surface-level self-critique

When asked to evaluate your own draft, be adversarial.
A draft that "looks competent" because it has clean formatting and confident tone
is worse than a rough draft with obvious gaps --
fluency masks emptiness and tricks the reader into trusting unsupported claims.

### Narrow interpretation of scope

If the user asks for "marketing," research all channels (editorial, social, email, outreach, paid, content publishing), not just paid ad campaigns.
If the user asks for "target audience," consider all audience segments (creators, consumers, partners), not just the obvious one.
Ask yourself: "Am I only thinking about one angle?" before drafting each section.

### Padding with filler

If removing a sentence does not reduce the information content of a paragraph, the sentence does not belong.
Common forms: restating what was just said in different words, circular definitions ("X is defined as something that does X"),
truisms that apply to any topic ("understanding the landscape is important for stakeholders"),
and throat-clearing transitions ("It is worth noting that...").

Filler is harder to detect than missing sources because it reads fluently.
Check each paragraph by asking: "What does the reader know after this paragraph that they did not know before?"
If the answer is nothing, cut it.

### Tone-fixing without substance-fixing

Removing AI-sounding vocabulary ("empowering," "vibrant," "community-driven") is necessary but not sufficient.
Source quality, analytical depth, and honest uncertainty markers
matter more than voice.
Fix substance first, then tone.

## Process

### 1. Scope and structure

- Confirm the list of sections with the user before writing
- For each section, identify what primary sources exist (official pages, SEC filings, press releases)
  and what is only available from secondary sources (blogs, SEO sites, marketing pages)
- Flag sections where no reliable data exists upfront rather than filling them with weak claims

### 2. Source gathering

- Prefer primary sources: official company pages, published reports, academic papers, government filings
- When using secondary sources, attribute them explicitly and rate their reliability
- Never treat an SEO blog citing a shipping company's marketing page as authoritative demographic data
- If a number cannot be traced to a primary source, say so: "No primary source available; estimate from [blog name]"
- When two sources disagree on a number or claim, present both, attribute each, and note the discrepancy -- do not silently pick one
- Include full URLs inline after factual claims

### 3. Drafting

- Write with specificity: named people with roles, exact dates, dollar amounts, percentages with methodology
- Explain **why** facts matter, not just what they are
  (e.g., "15 categories, but success rates diverge sharply" tells the reader more than listing 15 categories)
- Use concrete edge cases to explain abstract rules
  (e.g., a real example of a rejected project explains a policy better than paraphrasing the policy)
- State what you don't know with the same confidence as what you do know
- Maintain consistent voice across sections -- the document should read like one author wrote it

### 4. Source quality transparency

Every section should signal its source reliability to the reader:

```md
<!-- Good: explicit quality signal -->

**Data quality note:** Creator demographics below come from [6sense](https://6sense.com/...)
and [Search Logistics](https://searchlogistics.com/...), both secondary aggregators.
No primary demographic survey from Kickstarter exists.
The "0-9 employees" classification from 6sense is a firmographic artifact,
not meaningful demographic data.
```

### 5. Self-review checklist

Before presenting a draft, verify each item:

- Every factual claim has an inline source URL
- Source quality varies by section and this is signaled to the reader
- No section relies entirely on a single weak secondary source
- Demographics and statistics include methodology context (sample size, date, who collected the data)
- Rules and policies are illustrated with concrete edge cases, not just paraphrased
- The document reads as one coherent piece, not as separately authored sections stitched together
- No AI vocabulary remains ("empowering," "vibrant," "innovative," "landscape," "ecosystem," "community-driven")
- Sections have enough analytical depth to justify inclusion -- thin entries should be cut or merged
- Any measurability caveats are stated (e.g., "no published metrics exist for this channel")

### 6. Revision

When the user provides corrections:

- Distinguish between style fixes and substance fixes; prioritize substance
- Do not frame problems gently -- if a section is weak, say it is weak and explain why
- When corrected on scope, broaden aggressively: the user's correction likely reveals
  a pattern of narrowness throughout the document, not just in the flagged section

## Output format

Research documents should follow these conventions:

- Sentence case headings; **bold** for emphasis
- No tables -- use nested headings or lists
- Full source URLs inline after claims, not in footnotes or a references section
- Break lines at semantic boundaries
- Data quality warnings at the top of sections that rely on weak sources
- Active voice; present tense for current state
- No emojis, no promotional language, no narrative framing
