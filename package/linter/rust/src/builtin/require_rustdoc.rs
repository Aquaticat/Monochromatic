//! Require-rustdoc rule implementation.

// What:     `use crate::config::{missing_rustdoc_exempt, Config};` imports the
//           skip predicate and the settings struct from this crate's config
//           module. `crate::` means "from the root of this same crate", not an
//           external dependency.
// Why:      The rule skips test/fixture/build files via the predicate, and its
//           `check` signature must name the `Config` type even though this rule
//           reads no settings.
//
// In TS you'd write (pseudocode):
// ```ts
// import { missingRustdocExempt, Config } from "../config";
// ```
/// Imports require-rustdoc configuration and exemption predicate.
use crate::config::{missing_rustdoc_exempt, Config};

// What:     `use crate::context::LintContext;` imports the per-file bundle type.
// Why:      The rule reads the parsed tree and path from it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { LintContext } from "../context";
// ```
/// Imports parsed per-file context.
use crate::context::LintContext;

// What:     `use crate::diagnostic::{Diagnostic, Severity};` imports the finding
//           record and its severity enum.
// Why:      The rule constructs `Diagnostic`s with `Severity::Error`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Diagnostic, Severity } from "../diagnostic";
// ```
/// Imports diagnostic payload and severity types.
use crate::diagnostic::{Diagnostic, Severity};

// What:     `use crate::rule::Rule;` imports the trait this rule implements.
// Why:      Needed so we can write `impl Rule for RequireRustdoc`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Rule } from "../rule";
// ```
/// Imports rule trait implemented by this rule.
use crate::rule::Rule;

// What:     `use ra_ap_syntax::ast::{DocCommentIter, Impl};`. `DocCommentIter` is
//           rust-analyzer's iterator over an item's doc comments; `Impl` is the
//           typed AST view of an `impl` block.
// Why:      `DocCommentIter::from_syntax_node(node)` answers "does this item carry a
//           `///` / `//!` / `/** */` doc comment?"; `Impl` lets the trait-impl
//           carve-out ask `impl_.trait_().is_some()` (true only for `impl T for U`).
//
// In TS you'd write (pseudocode):
// ```ts
// import { DocCommentIter, Impl } from "<rust-parser>/ast";
// ```
/// Imports rust-analyzer doc-comment iterator and typed `impl` view.
use ra_ap_syntax::ast::{DocCommentIter, Impl};

// What:     `use ra_ap_syntax::{AstNode, NodeOrToken, SyntaxKind, SyntaxNode};`.
//           `SyntaxKind` names every node/token kind (FN, STRUCT, USE, ...);
//           `SyntaxNode` is a handle to one tree node; `NodeOrToken` is the
//           node-or-token enum yielded by `descendants_with_tokens()`; `AstNode` is
//           the trait whose `cast` turns a `SyntaxNode` into a typed AST view.
// Why:      We match each node's `kind()`, scan tokens for a `cxx_qt` identifier, and
//           cast an `impl` node to `Impl` (which needs `AstNode` in scope).
//
// In TS you'd write (pseudocode):
// ```ts
// import { AstNode, NodeOrToken, SyntaxKind, SyntaxNode } from "<rust-parser>";
// ```
/// Imports syntax node, kind, node-or-token, and the AST cast trait.
use ra_ap_syntax::{AstNode, NodeOrToken, SyntaxKind, SyntaxNode};

// What:     `use std::path::Path;` imports the borrowed-path type.
// Why:      The exemption check takes a `&Path`; we build one from the path string.
//
// In TS you'd write (pseudocode):
// ```ts
// import path from "node:path";
// ```
/// Imports path helper used by exemption checks.
use std::path::Path;

// What:     `const KIND_LABELS: &[(SyntaxKind, &str)] = &[ ... ];`. A compile-time
//           table pairing every node kind that must carry rustdoc with the human
//           word used in its diagnostic. `&[(SyntaxKind, &str)]` is a borrowed
//           slice of 2-tuples (sibling shapes: owned `Vec<(..)>`, fixed
//           `[(..); N]`). The `&str`s are `&'static str` string literals baked
//           into the binary.
// Why:      One source of truth for BOTH "which kinds need docs" and "what to call
//           each kind", so the two never drift apart. Matching the TSDoc policy
//           (`require-tsdoc`), the set is maximal: every doc-comment-legal item,
//           item-part, and the file root, public AND private. Macros and extern
//           blocks are deliberately EXCLUDED: rustc emits `unused_doc_comments`
//           for a `///` on a macro invocation ("rustdoc does not generate
//           documentation for macro invocations") and on an `extern "C" { }`
//           block, so requiring docs there would be unsatisfiable. Items INSIDE
//           an extern block (foreign fns/statics) are still documentable and
//           remain required.
//
// In TS you'd write (pseudocode):
// ```ts
// const KIND_LABELS: [SyntaxKind, string][] = [ [SyntaxKind.FN, "function"], ... ];
// ```
/// Node kinds that require rustdoc and their diagnostic labels.
const KIND_LABELS: &[(SyntaxKind, &str)] = &[
    (SyntaxKind::FN, "function"),
    (SyntaxKind::STRUCT, "struct"),
    (SyntaxKind::ENUM, "enum"),
    (SyntaxKind::UNION, "union"),
    (SyntaxKind::TRAIT, "trait"),
    (SyntaxKind::TYPE_ALIAS, "type alias"),
    (SyntaxKind::CONST, "constant"),
    (SyntaxKind::STATIC, "static"),
    (SyntaxKind::MODULE, "module"),
    (SyntaxKind::EXTERN_CRATE, "extern crate"),
    (SyntaxKind::USE, "use"),
    (SyntaxKind::IMPL, "impl block"),
    (SyntaxKind::VARIANT, "enum variant"),
    (SyntaxKind::RECORD_FIELD, "field"),
    (SyntaxKind::TUPLE_FIELD, "field"),
    (SyntaxKind::SOURCE_FILE, "file"),
];

// What:     `fn kind_is_documented(kind: SyntaxKind) -> bool`. Answers whether a
//           node kind is in the must-document table above.
// Why:      The first gate of `requires_rustdoc`: kinds not in the table (blocks,
//           expressions, statements, paths, ...) are never flagged.
//
// In TS you'd write (pseudocode):
// ```ts
// function kindIsDocumented(kind: SyntaxKind): boolean { return KIND_LABELS.some(p => p[0] === kind); }
// ```
/// Return whether a syntax kind is in the documentable-kind table.
fn kind_is_documented(kind: SyntaxKind) -> bool {
    // What:     `KIND_LABELS.iter().any(|pair| pair.0 == kind)`. `.iter()` borrows
    //           each `&(SyntaxKind, &str)`; `.any(closure)` is true when the
    //           closure holds for at least one. `|pair| pair.0 == kind` compares
    //           the tuple's first field (the kind) to the argument. Tail
    //           expression, so it is returned.
    // Why:      Table membership test, allocation-free.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return KIND_LABELS.some(pair => pair[0] === kind);
    // ```
    KIND_LABELS.iter().any(|pair| pair.0 == kind)
}

// What:     `fn file_uses_cxx_qt(root: &SyntaxNode) -> bool`. Scans the file's tokens
//           for an identifier `cxx_qt` or `cxx_qt_lib`.
// Why:      cxx-qt bridge files carry `#[cxx_qt::bridge]` and import cxx-qt-lib types,
//           both of which surface `cxx_qt`/`cxx_qt_lib` as IDENT tokens. When one is
//           present, the rule relaxes on `use` and trait-impl items (see
//           `requires_rustdoc`), because that companion code is plumbing the macro
//           and trait impls require, not hand-written API. Matching IDENT tokens (not
//           raw text) means a `cxx_qt` inside a comment or string never counts.
//
// In TS you'd write (pseudocode):
// ```ts
// function fileUsesCxxQt(root: SyntaxNode): boolean {
//   return [...root.descendantsWithTokens()].some(
//     el => el.isToken && el.kind === "ident" && ["cxx_qt", "cxx_qt_lib"].includes(el.text));
// }
// ```
/// Return whether the file references cxx-qt (an IDENT `cxx_qt`/`cxx_qt_lib`).
fn file_uses_cxx_qt(root: &SyntaxNode) -> bool {
    // What:     `root.descendants_with_tokens().any(|element| match element { ... })`.
    //           Walks every node AND leaf token; `.any` stops at the first match. The
    //           `Token` arm keeps only IDENT tokens whose text is one of the two crate
    //           idents; the `Node` arm ignores inner nodes.
    // Why:      One allocation-free pass; non-IDENT tokens (comments, strings) can
    //           never match, so the detection is not fooled by text in a doc comment.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return [...root.descendantsWithTokens()].some(el => el.isToken && el.kind === "ident" && ...);
    // ```
    root.descendants_with_tokens().any(|element| match element {
        NodeOrToken::Token(token) => {
            token.kind() == SyntaxKind::IDENT && matches!(token.text(), "cxx_qt" | "cxx_qt_lib")
        }
        NodeOrToken::Node(_) => false,
    })
}

// What:     `fn is_trait_impl_assoc_item(node: &SyntaxNode) -> bool`. Answers whether
//           the node is an associated item (method/const/type) of a TRAIT impl, i.e.
//           lives directly inside an `impl Trait for Type { ... }` block.
// Why:      The cxx-qt carve-out exempts trait-impl items (like `impl Default`'s
//           `fn default`), matching rustc's own `missing_docs`, which never requires
//           docs on trait-impl items. Inherent-impl items (`impl Type { ... }`) and
//           trait DEFINITIONS stay required, so this must tell them apart: a trait
//           impl is an `Impl` whose `trait_()` is present (the `for Trait` clause).
//
// In TS you'd write (pseudocode):
// ```ts
// function isTraitImplAssocItem(node: SyntaxNode): boolean {
//   const list = node.parent;
//   if (list?.kind !== "assoc_item_list") return false;
//   return Impl.cast(list.parent)?.trait !== undefined;
// }
// ```
/// Return whether the node is an associated item of a trait `impl` block.
fn is_trait_impl_assoc_item(node: &SyntaxNode) -> bool {
    // What:     Climb `node -> ASSOC_ITEM_LIST -> IMPL`, cast the impl to the typed
    //           `Impl`, and check it has a `for Trait` clause via `trait_().is_some()`.
    // Why:      Only items whose grandparent is a trait impl are exempted; anything
    //           else (inherent impl, trait definition, free item) yields false.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return Impl.cast(node.parent?.kind === "assoc_item_list" ? node.parent.parent : undefined)?.trait !== undefined;
    // ```
    node.parent()
        .filter(|parent| parent.kind() == SyntaxKind::ASSOC_ITEM_LIST)
        .and_then(|list| list.parent())
        .and_then(Impl::cast)
        .is_some_and(|impl_block| impl_block.trait_().is_some())
}

// What:     `fn requires_rustdoc(node: &SyntaxNode, uses_cxx_qt: bool) -> bool`. The
//           overall predicate deciding whether a node must carry a doc comment;
//           `uses_cxx_qt` says the enclosing file references cxx-qt.
// Why:      Keep the walk in `check` simple: one call per node says yes or no. The
//           flag lets the cxx-qt carve-out drop `use` and trait-impl items.
//
// In TS you'd write (pseudocode):
// ```ts
// function requiresRustdoc(node: SyntaxNode, usesCxxQt: boolean): boolean { /* ... */ }
// ```
/// Return whether a syntax node must carry rustdoc (`uses_cxx_qt` relaxes cxx-qt files).
fn requires_rustdoc(node: &SyntaxNode, uses_cxx_qt: bool) -> bool {
    // What:     `let kind = node.kind();`. The node's `SyntaxKind`.
    // Why:      Both gates below branch on it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const kind = node.kind;
    // ```
    let kind = node.kind();

    // What:     `if !kind_is_documented(kind) { return false; }`. `!` negates.
    //           Early return when the kind is not in the must-document table.
    // Why:      Skip the vast majority of nodes (expressions, blocks, paths, ...).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (!kindIsDocumented(kind)) return false;
    // ```
    if !kind_is_documented(kind) {
        return false;
    }

    // What:     `if uses_cxx_qt && (kind == SyntaxKind::USE ||
    //           is_trait_impl_assoc_item(node)) { return false; }`. In a file that
    //           references cxx-qt, skip `use` imports and trait-impl associated items.
    // Why:      cxx-qt bridge companion code needs plumbing imports (`use
    //           cxx_qt_lib::QString;`) and trait impls (`impl Default`, ...) that would
    //           otherwise demand redundant docs; rustc's own `missing_docs` never
    //           requires docs on either. Scoping the relaxation to cxx-qt files keeps
    //           the maximal policy everywhere else.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (usesCxxQt && (kind === "use" || isTraitImplAssocItem(node))) return false;
    // ```
    if uses_cxx_qt && (kind == SyntaxKind::USE || is_trait_impl_assoc_item(node)) {
        return false;
    }

    // What:     `true`. Bare tail expression: every listed kind always needs docs
    //           (macros are not in the table, so they never reach here).
    // Why:      Default to requiring documentation.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return true;
    // ```
    true
}

// What:     `fn has_doc_comment(node: &SyntaxNode) -> bool`. Reports whether the
//           node carries a rustdoc comment.
// Why:      A node that requires docs but has none is the violation we report.
//
// In TS you'd write (pseudocode):
// ```ts
// function hasDocComment(node: SyntaxNode): boolean { /* ... */ }
// ```
/// Return whether a syntax node already has rustdoc attached.
fn has_doc_comment(node: &SyntaxNode) -> bool {
    // What:     `DocCommentIter::from_syntax_node(node).next().is_some()`. Builds
    //           the doc-comment iterator over this node's own child tokens (a `///`
    //           attaches as a child of the item it precedes; `//!` as a child of
    //           the file/module). `.next()` pulls the first doc comment, if any;
    //           `.is_some()` turns "found one" into a bool. The iterator filters by
    //           rust-analyzer's `Comment::is_doc`, which matches `///`, `//!`, and
    //           `/** */` but NOT plain `//` or `/* */`. Tail expression.
    // Why:      This is the linchpin: every item in this repo already has a plain
    //           `// What:` block, so the rule is only meaningful because `//` is
    //           excluded and only true doc comments count.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return DocCommentIter.fromSyntaxNode(node).next() !== undefined;
    // ```
    DocCommentIter::from_syntax_node(node).next().is_some()
}

// What:     `fn item_name(node: &SyntaxNode) -> Option<String>`. Returns the item's
//           declared name as an owned `String`, or `None` for nameless nodes
//           (`impl` blocks, `use`, tuple fields, the file root, ...).
// Why:      Diagnostics read better with the name ("function \"foo\"") when one
//           exists.
//
// In TS you'd write (pseudocode):
// ```ts
// function itemName(node: SyntaxNode): string | undefined { /* ... */ }
// ```
/// Return a syntax node name when the item has one.
fn item_name(node: &SyntaxNode) -> Option<String> {
    // What:     `node.children().find(|child| child.kind() == SyntaxKind::NAME)
    //           .map(|child| child.text().to_string())`. `.children()` yields the
    //           node's direct child NODES (not tokens). `.find(closure)` returns
    //           the first `NAME` child as `Option<SyntaxNode>`. `.map(|child|
    //           child.text().to_string())` turns that node into its source text as
    //           an owned `String` (sibling: borrowed `&str`; we own it because the
    //           diagnostic outlives this node borrow). Tail expression.
    // Why:      A named item has exactly one `NAME` child holding its identifier;
    //           nameless items have none, yielding `None`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const nameNode = node.children().find(c => c.kind === SyntaxKind.NAME);
    // return nameNode?.text;
    // ```
    node.children()
        .find(|child| child.kind() == SyntaxKind::NAME)
        .map(|child| child.text().to_string())
}

// What:     `fn kind_label(kind: SyntaxKind) -> &'static str`. Looks up the human
//           word for a kind in `KIND_LABELS`. `&'static str` is a program-lifetime
//           borrowed string (the literal in the table).
// Why:      Build readable messages like "Missing rustdoc on struct ...".
//
// In TS you'd write (pseudocode):
// ```ts
// function kindLabel(kind: SyntaxKind): string { /* ... */ }
// ```
/// Return human-readable label for a documentable syntax kind.
fn kind_label(kind: SyntaxKind) -> &'static str {
    // What:     `KIND_LABELS.iter().find(|pair| pair.0 == kind).map(|pair| pair.1)
    //           .unwrap_or("item")`. Find the matching row, take its label (the
    //           tuple's second field), or substitute the generic `"item"` if
    //           somehow absent (it never is: callers only ask for listed kinds).
    //           Tail expression.
    // Why:      One lookup against the same source-of-truth table.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return KIND_LABELS.find(pair => pair[0] === kind)?.[1] ?? "item";
    // ```
    KIND_LABELS
        .iter()
        .find(|pair| pair.0 == kind)
        .map(|pair| pair.1)
        .unwrap_or("item")
}

// What:     `fn describe_missing(node: &SyntaxNode) -> String`. Builds the
//           diagnostic message for one undocumented node.
// Why:      Mirror the TSDoc plugin's "Missing TSDoc comment on ..." wording.
//
// In TS you'd write (pseudocode):
// ```ts
// function describeMissing(node: SyntaxNode): string { /* ... */ }
// ```
/// Build diagnostic message for one undocumented syntax node.
fn describe_missing(node: &SyntaxNode) -> String {
    // What:     `let label = kind_label(node.kind());`. The human word for the kind.
    // Why:      Both message shapes start with it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const label = kindLabel(node.kind);
    // ```
    let label = kind_label(node.kind());

    // What:     `if let Some(name) = item_name(node) { ... } else { ... }`. Run the
    //           first block (binding the owned `String` to `name`) when the item
    //           has a name; otherwise the second block.
    // Why:      Named items read better with the name; nameless ones omit it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const name = itemName(node);
    // return name !== undefined ? `Missing rustdoc on ${label} "${name}".` : `Missing rustdoc on ${label}.`;
    // ```
    if let Some(name) = item_name(node) {
        // What:     `format!("Missing rustdoc on {label} \"{name}\".")`. Builds an
        //           owned `String`; `{label}`/`{name}` interpolate the locals,
        //           `\"` emits literal double quotes around the name. Tail
        //           expression of this branch.
        // Why:      Name the exact undocumented declaration.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return `Missing rustdoc on ${label} "${name}".`;
        // ```
        format!("Missing rustdoc on {label} \"{name}\".")
    } else {
        // What:     `format!("Missing rustdoc on {label}.")`. Same, without a name.
        // Why:      Nameless nodes (impl, use, tuple field, file) have no
        //           identifier to print.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return `Missing rustdoc on ${label}.`;
        // ```
        format!("Missing rustdoc on {label}.")
    }
}

// What:     `pub struct RequireRustdoc;`. A UNIT struct (no fields, no braces). It
//           exists only to implement the `Rule` trait.
// Why:      Rules are values living together in a `Vec<Box<dyn Rule>>`; this one
//           needs no state.
//
// In TS you'd write (pseudocode):
// ```ts
// class RequireRustdoc implements Rule { /* no fields */ }
// ```
/// Rule enforcing rustdoc on documentable Rust items.
pub struct RequireRustdoc;

// What:     `impl Rule for RequireRustdoc { ... }`. Provides the trait's methods.
// Why:      So the runner can hold it as a `Box<dyn Rule>` and call `check`.
//
// In TS you'd write (pseudocode):
// ```ts
// class RequireRustdoc implements Rule { id() {...} check(...) {...} }
// ```
/// Rule trait implementation for rustdoc enforcement.
impl Rule for RequireRustdoc {
    // What:     `fn id(&self) -> &'static str { "require-rustdoc" }`. Returns the
    //           fixed rule id. The string literal is the tail expression.
    // Why:      Identify this rule in diagnostics, mirroring the TS `require-tsdoc`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // id(): string { return "require-rustdoc"; }
    // ```
    /// Return require-rustdoc rule identifier.
    fn id(&self) -> &'static str {
        "require-rustdoc"
    }

    // What:     The trait leaves this method without a default body, so every
    //           rule states its own answer rather than inheriting one.
    // Why:      `false`, because AGENTS.md RDC requires rustdoc on every
    //           documentable item and says never to disable the check: the remedy
    //           for an undocumented item is to document it. A directive aimed at
    //           this rule is therefore itself reported rather than obeyed.
    /// Refuse inline suppression, per the never-disable policy for this rule.
    fn allows_suppression(&self) -> bool {
        false
    }

    // What:     `fn check(&self, context: &LintContext, _config: &Config, out: &mut
    //           Vec<Diagnostic>)`. Read-only borrows of the file context and config
    //           (the leading `_` on `_config` marks it intentionally unused: this
    //           rule reads no settings), and a MUTABLE borrow of the shared
    //           findings vector to push into.
    // Why:      Inspect one file's tree and append a finding per undocumented node.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // check(ctx: LintContext, _cfg: Config, out: Diagnostic[]): void { /* ... */ }
    // ```
    /// Append diagnostics for undocumented nonexempt syntax nodes.
    fn check(&self, context: &LintContext, _config: &Config, out: &mut Vec<Diagnostic>) {
        // What:     `let path = Path::new(&context.path);`. Wrap the borrowed path
        //           string as a `&Path` without copying.
        // Why:      The exemption check works on path segments.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const p = ctx.path;
        // ```
        let path = Path::new(&context.path);

        // What:     `if missing_rustdoc_exempt(path) { return; }`. Bail out early on
        //           test, fixture, fuzz, and build-script files.
        // Why:      Throwaway code is off-policy, mirroring oxlint's TSDoc skips.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (missingRustdocExempt(p)) return;
        // ```
        if missing_rustdoc_exempt(path) {
            return;
        }

        // What:     `let uses_cxx_qt = file_uses_cxx_qt(context.syntax_node());`.
        //           Detect once whether this file references cxx-qt. `syntax_node()`
        //           already returns `&SyntaxNode`, so no extra `&` is needed.
        // Why:      The per-node predicate relaxes `use`/trait-impl items only in
        //           cxx-qt files; compute it once rather than rescanning per node.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const usesCxxQt = fileUsesCxxQt(ctx.syntaxNode());
        // ```
        let uses_cxx_qt = file_uses_cxx_qt(context.syntax_node());

        // What:     `for node in context.syntax_node().descendants()`. `.descendants
        //           ()` yields every node of the parsed tree, INCLUDING the root
        //           `SOURCE_FILE` itself, each as an owned `SyntaxNode`. (It yields
        //           nodes only, not tokens.)
        // Why:      Walk every item, item-part, and the file root to check each for
        //           documentation; nested items inside modules and impls are
        //           reached because the walk recurses.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // for (const node of ctx.syntaxNode().descendants()) { /* ... */ }
        // ```
        for node in context.syntax_node().descendants() {
            // What:     `if !requires_rustdoc(&node, uses_cxx_qt) { continue; }`.
            //           `&node` lends the node read-only; `uses_cxx_qt` carries the
            //           per-file cxx-qt flag. Skip nodes that need no docs.
            // Why:      Only the listed item kinds are subject to the rule, minus the
            //           cxx-qt carve-out for `use`/trait-impl items.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (!requiresRustdoc(node, usesCxxQt)) continue;
            // ```
            if !requires_rustdoc(&node, uses_cxx_qt) {
                continue;
            }

            // What:     `if has_doc_comment(&node) { continue; }`. Skip the node
            //           when it already carries a rustdoc comment.
            // Why:      A documented item is not a violation.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (hasDocComment(node)) continue;
            // ```
            if has_doc_comment(&node) {
                continue;
            }

            // What:     `let offset = usize::from(node.text_range().start());`.
            //           `.text_range()` is the node's `[start, end)` byte span;
            //           `.start()` is a `TextSize` (a newtype over a 32-bit offset);
            //           `usize::from(...)` widens it to a plain `usize` index.
            // Why:      We map the node's first byte to a line number next.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const offset = node.range.start;
            // ```
            let offset = usize::from(node.text_range().start());

            // What:     `let length = usize::from(node.text_range().len());`.
            //           `usize::from(..)` converts rust-analyzer's `TextSize`
            //           newtype into a plain number. `.len()` is the node's full
            //           byte width, which for an item spans its entire body.
            // Why:      `span_at_offset` clamps this to the end of the line the
            //           item starts on, so the underline covers the declaration
            //           rather than every line of a long function.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const length = node.range.end - node.range.start;
            // ```
            let length = usize::from(node.text_range().len());

            // What:     `let message = describe_missing(&node);`. Build the
            //           human-readable message for this undocumented node.
            // Why:      Tell the reader exactly what lacks documentation.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const message = describeMissing(node);
            // ```
            let message = describe_missing(&node);

            // What:     `out.push(Diagnostic { ... });`. Append a finding to the
            //           shared vector. `rule_id: "require-rustdoc"` is a borrowed
            //           literal; `severity: Severity::Error` selects the failing
            //           variant; `path: context.path.clone()` makes an OWNED copy of
            //           the path string (`.clone()` deep-copies the `String`)
            //           because the diagnostic outlives this borrow of `context`.
            // Why:      Record the violation; its presence drives a non-zero exit.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // out.push(Diagnostic.create("builtin", "require-rustdoc", "error", message, ctx.path, span));
            // ```
            // Built from the item's own offset rather than from its line, so the
            // reported column is where the item actually starts. Going through
            // `line_span` here would report column 1 for every finding.
            let span = context.span_at_offset(offset, length);

            out.push(Diagnostic::new(
                "builtin",
                "require-rustdoc",
                Severity::Error,
                message,
                context.path.clone(),
                span,
            ));
        }
    }
}
