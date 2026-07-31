# Oxlint shared runtime helpers

Small runtime primitives shared by the Monochromatic oxlint plugin packages.

The package intentionally stays tiny:
 it owns character-class predicates and untyped-record guards
that multiple shipped plugins need while linting source code.
