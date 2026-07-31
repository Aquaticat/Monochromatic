# Oxlint plugin test support

Dev-only helpers shared by the oxlint plugin fixture tests.

The package owns common fixture-path resolution,
 oxlint JSON capture,
 temp fixture copying,
 and
rule-code de-duplication.
 It is private because the helpers support this monorepo's tests rather
than a published runtime plugin.
