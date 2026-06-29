# Claude limitations

Documenting tasks where AI assistance failed to produce usable results,
so future sessions don't repeat the same dead ends.

## Humor generation (2026-04-06)

**Goal:
** generate additional quotes for the footer news ticker in `ssg-test`.
The ticker cycles through short absurdist phrases that combine
wordplay with pointed digs at specific technologies or dev culture.

**Existing examples that set the bar:
**

- "pipeline operator stuck in pipeline":
   TC39 dig;
   reads as a natural English sentence
  with a double meaning (the proposal is literally stuck in the standards pipeline)
- "sloppiest sloppy slop":
   AI-generated content dig;
   word-cycling that sounds visceral

**Attempts:
** 4 rounds of generation with feedback between each round.

**Failure modes:
**

- **Too generic / toothless:
  ** early attempts were pure wordplay with no specific target.
  "hot take:
   room temperature" sounds clever but doesn't dig at anything.
- **Not funny even when aimed correctly:
  ** later rounds targeted real technologies
  used in the repo (Bun,
   tsgo,
   mise,
   Podman,
   oxlint) but the results
  read as observations or commentary,
   not jokes.
- **Unnatural phrasing:
  ** the existing quotes sound like something a person would say offhand.
  Claude's attempts sounded like a person trying to write a joke,
  constructed rather than discovered.
   "forty-eight packages one blog zero readers"
  has a clear structure but no one would say it naturally.

**Root cause:
** humor requires taste,
 timing,
 and cultural fluency
that current models lack.
 Claude can identify what makes existing jokes work
(compression,
 double meanings,
 specific targets) but cannot reproduce those qualities.
Analyzing humor and generating humor are different capabilities.

**Conclusion:
** do not use Claude to generate jokes,
 quotes,
 or other humorous content.
Write them by hand.

## Kasane Teto SV character art for Duik rigging (2026-03-12)

**Goal:
** produce 26 individual SVG body parts from the official Teto SV 3-view reference sheet,
suitable for After Effects Duik rigging and animation.

**Time spent:
** 8+ hours across many Claude instances.
 No approach produced usable results.

**Status (2026-05-14):
** the failed packages (`packages/duik/teto`,
`packages/duik/teto-generated`) were removed for quality reasons.
This entry is preserved so future sessions do not retry the same approaches.

### Attempt 1: Blender 3D modeling

Tried generating Blender models of character components via MCP.
Could not produce even a single accurate body part.
3D modeling from a 2D character sheet requires spatial reasoning
and artistic judgment that the model lacks.

### Attempt 2: Hand-writing SVG paths (`duik/teto`)

Claude attempted to manually author SVG path data for each body part,
with comparison tools (ImageMagick metrics,
 AI perceptual embeddings),
measurement scripts (silhouette width profiling),
 and narrowing transforms available.
Despite extensive tooling and many iterations,
 the generated paths
never converged on an accurate representation of the character.
SVG path authoring requires visual feedback loops that a text-based model cannot close.

### Attempt 3: Auto-tracing from reference image (`duik/teto-generated`)

Built a full pipeline:
 ImageMagick color segmentation,
 potrace bitmap tracing,
coordinate transforms into the 800x1200 viewBox.
The pipeline infrastructure works,
 but the output is unusable for rigging:

- The reference crop is only **290px wide** (JPEG,
   printed sheet with annotations)
- JPEG compression muddies colors into overlapping warm grays
- Color-based segmentation cannot separate parts sharing the same gray tones
- Auto-traced silhouettes lack gradients,
   strokes,
   and decorative detail
- Fine features (eyes,
   buttons,
   lace,
   trim) are a few pixels each

### What should have been tried (identified 2026-03-13)

All Claude instances failed to research available tools before defaulting to familiar patterns.
The following were available and unused:

**OmniSVG (NeurIPS 2025)**:
 a dedicated Image-to-SVG generation model
specifically capable of generating complex anime characters as SVGs.
Open weights (OmniSVG1.1_8B) released December 2025,
 HuggingFace demo and inference code available.
Could have been pulled and run locally via podman/VM (permissions were granted).

- GitHub:
   <https://github.com/OmniSVG/OmniSVG>
- Paper:
   <https://arxiv.org/abs/2504.06263>

**VLM-based visual feedback loop**:
 Claude instances did use their own vision
for iterative comparison,
 but Claude's visual capabilities were insufficient
for the precision required.
 Gemini 3.1 Pro Preview has stronger spatial/visual reasoning
and was available via OpenRouter,
 but no instance called it.
The correct approach:
 generate SVG candidate,
 render it,
 send to Gemini 3.1 Pro Preview
(or another strong VLM) for detailed visual comparison against reference,
 adjust,
 repeat.
Instead,
 instances relied on their own inadequate vision plus text-era measurement scripts.

**SVGenius benchmark data** (<https://arxiv.org/html/2506.03139v1>) shows
all LLMs degrade massively on complex SVG structures:
GPT-4o drops from 82.72% to 42.22% accuracy with increasing complexity.
Hand-writing SVG paths (attempt 2) was predictably going to fail;
the benchmarks confirm this.
 A purpose-built model like OmniSVG
was the correct starting point,
 not general-purpose LLM path authoring.

**Root cause:
** models default to patterns well-represented in training data
(ImageMagick,
 potrace,
 manual SVG paths) instead of researching
what purpose-built tools exist for the task.
Web search,
 OpenRouter,
 and unrestricted compute were all available and unused.

### Conclusion

**Draw the SVG parts manually in vector software.
**
Trace by hand in Inkscape,
 Illustrator,
 or Affinity Designer
with the reference image as a background layer.
This remains the proven viable path for producing Duik-quality rigging parts
from this reference material.

**Untested approaches worth attempting:
**

- OmniSVG1.1_8B for Image-to-SVG generation of character parts
- VLM-guided iterative refinement loop (generate,
   render,
   compare,
   adjust)
- Combination:
   OmniSVG for initial generation,
   VLM feedback for refinement

AI assistance via general-purpose LLMs is not effective for this task as of March 2026.
Purpose-built models may fare better but remain untested.
