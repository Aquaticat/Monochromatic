# Lessons learned

Documenting tasks where AI assistance failed to produce usable results,
so future sessions don't repeat the same dead ends.

## Kasane Teto SV character art for Duik rigging (2026-03-12)

**Goal:** produce 26 individual SVG body parts from the official Teto SV 3-view reference sheet,
suitable for After Effects Duik rigging and animation.

**Time spent:** 8+ hours across many Claude instances. No approach produced usable results.

### Attempt 1: Blender 3D modeling

Tried generating Blender models of character components via MCP.
Could not produce even a single accurate body part.
3D modeling from a 2D character sheet requires spatial reasoning
and artistic judgment that the model lacks.

### Attempt 2: Hand-writing SVG paths (`duik/teto`)

Claude attempted to manually author SVG path data for each body part,
with comparison tools (ImageMagick metrics, AI perceptual embeddings),
measurement scripts (silhouette width profiling), and narrowing transforms available.
Despite extensive tooling and many iterations, the generated paths
never converged on an accurate representation of the character.
SVG path authoring requires visual feedback loops that a text-based model cannot close.

### Attempt 3: Auto-tracing from reference image (`duik/teto-generated`)

Built a full pipeline: ImageMagick color segmentation, potrace bitmap tracing,
coordinate transforms into the 800x1200 viewBox.
The pipeline infrastructure works, but the output is unusable for rigging:

- The reference crop is only **290px wide** (JPEG, printed sheet with annotations)
- JPEG compression muddies colors into overlapping warm grays
- Color-based segmentation cannot separate parts sharing the same gray tones
- Auto-traced silhouettes lack gradients, strokes, and decorative detail
- Fine features (eyes, buttons, lace, trim) are a few pixels each

### Conclusion

**Draw the SVG parts manually in vector software.**
Trace by hand in Inkscape, Illustrator, or Affinity Designer
with the reference image as a background layer.
This is the only viable path for producing Duik-quality rigging parts
from this reference material.

AI assistance is not effective for this task as of March 2026.
