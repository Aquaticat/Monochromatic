//! The rule that runs declarative `[[pattern]]` rules from configuration.

/// Imports the settings record every rule receives.
use crate::config::Config;
/// Imports the parsed per-file context the pattern is matched against.
use crate::context::LintContext;
/// Imports the finding record this rule emits.
use crate::diagnostic::{Diagnostic, Severity};
/// Imports the rule trait this type implements.
use crate::rule::Rule;
/// Imports the category this rule declares itself into.
use crate::severity::Category;
/// Imports the source-range and edit types a pattern fix produces.
use crate::span::Span;
use monochromatic_rust_linter_core::fix::{Edit, Fix, FixKind};

/// Imports the on-disk shape of one configured pattern rule.
use monochromatic_rust_linter_core::config::file::PatternConfig;
/// Imports the pattern cascade, matcher and rewrite renderer.
use monochromatic_rust_linter_pattern::fragment::parse as parse_fragment;
use monochromatic_rust_linter_pattern::matcher::find_all;
use monochromatic_rust_linter_pattern::rewrite::{render, unbound_metavariables};

// What:     `pub const PLUGIN: &str = "pattern";`. The plugin name every
//           configured pattern rule reports under.
// Why:      A finding's code is `plugin(rule)`, so this is what distinguishes
//           `pattern(no-unwrap)` from a compiled-in `builtin(max-lines)`.
/// Plugin name configured pattern rules report under.
pub const PLUGIN: &str = "pattern";

// What:     `pub struct PatternRule { .. }` holds one configured pattern with
//           its snippet ALREADY parsed.
// Why:      Parsing the snippet once when the rule is built, rather than once
//           per file, is the difference between one parse and 310 of them.
/// One declarative pattern rule, ready to run.
pub struct PatternRule {
    /// Rule id, as configured.
    id: String,

    // What:     The pattern is held as TEXT and re-parsed in `check`, rather
    //           than parsed once at build time and stored.
    // Why:      Forced by threading. rowan's `SyntaxNode` is deliberately not
    //           `Send` or `Sync`: it holds a `NonNull` into a tree with
    //           non-atomic reference counts. A rule must be shareable across
    //           worker threads, so it cannot hold one. Snippets are a few tokens
    //           long, so re-parsing costs far less than the file being linted.
    /// Pattern snippet, re-parsed per file because a syntax tree is not `Sync`.
    pattern: String,

    /// Message reported when the pattern matches.
    message: String,

    /// Replacement snippet, absent when the rule is not fixable.
    fix: Option<String>,

    /// Remediation hint, absent when the rule offers none.
    help: Option<String>,
}

/// Construction and interrogation for configured pattern rules.
impl PatternRule {
    // What:     `pub fn build(configured: &PatternConfig) -> Result<Self, String>`.
    //           Answers the failure as a message rather than a typed error.
    // Why:      The only caller turns it straight into a CLI diagnostic, so a
    //           richer error type would be converted to text immediately.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // static build(configured: PatternConfig): PatternRule // throws a message
    // ```
    /// Build a runnable rule from one configured pattern.
    pub fn build(configured: &PatternConfig) -> Result<Self, String> {
        // A snippet that does not parse is a configuration error worth naming.
        // Reporting it at startup beats silently matching nothing all run. The
        // parsed tree is discarded here: this call is a validation, and `check`
        // parses again per file for the threading reason above.
        if parse_fragment(&configured.pattern).is_none() {
            return Err(format!(
                "pattern rule \"{}\": the `match` snippet is not parseable Rust: {}",
                configured.id, configured.pattern,
            ));
        }

        return Ok(Self {
            id: configured.id.clone(),
            pattern: configured.pattern.clone(),
            message: configured.message.clone(),
            fix: configured.fix.clone(),
            help: configured.help.clone(),
        });
    }
}

/// Rule trait implementation for configured pattern rules.
impl Rule for PatternRule {
    // What:     `fn id(&self) -> &'static str` cannot be satisfied by a
    //           configured name, because `&'static str` must live for the whole
    //           program and this one is read from a file at run time.
    // Why:      `Box::leak` deliberately gives the string away to the process,
    //           which is exactly what a `'static` borrow needs. A rule lives for
    //           the whole run, so nothing is reclaimed that could have been.
    /// Return the configured rule id.
    fn id(&self) -> &'static str {
        return Box::leak(self.id.clone().into_boxed_str());
    }

    /// Return the plugin name configured patterns report under.
    fn plugin(&self) -> &'static str {
        return PLUGIN;
    }

    // What:     `true`, unlike both compiled-in rules.
    // Why:      A pattern rule is written by whoever configured it, and nothing
    //           in AGENTS.md forbids silencing one. This is also the first rule
    //           the directive engine actually applies to: until now every rule
    //           refused suppression, so the mechanism had no beneficiary.
    /// Permit inline suppression, unlike the compiled-in rules.
    fn allows_suppression(&self) -> bool {
        return true;
    }

    // What:     `Category::Restriction`.
    // Why:      oxlint files "lints which prevent the use of language and
    //           library features" there, which is what a pattern rule banning a
    //           construct is. The category is off by default, but a configured
    //           pattern carries its own severity, so it still runs.
    /// Return the restriction category.
    fn category(&self) -> Category {
        return Category::Restriction;
    }

    /// Report every place the configured pattern matches.
    fn check(&self, context: &LintContext, _config: &Config, out: &mut Vec<Diagnostic>) {
        // `build` already proved this parses, so an absent result here would be
        // a bug rather than bad configuration. Returning quietly is still better
        // than panicking mid-run.
        let Some(pattern) = parse_fragment(&self.pattern) else {
            return;
        };

        for found in find_all(&pattern.root, context.syntax_node()) {
            let range = found.node.text_range();
            let offset = usize::from(range.start());
            let span = context.span_at_offset(offset, usize::from(range.len()));

            let mut diagnostic = Diagnostic::new(
                PLUGIN,
                self.id(),
                // The runner overwrites this with the resolved severity, so the
                // value here only has to be a valid one.
                Severity::Error,
                self.message.clone(),
                context.path.clone(),
                span,
            );

            if let Some(help) = &self.help {
                diagnostic = diagnostic.with_help(help.clone());
            }

            // A rewrite naming a hole the pattern never bound would write the
            // literal text `META_Y` into someone's source, so the fix is
            // dropped rather than offered.
            if let Some(template) = &self.fix
                && unbound_metavariables(template, &found.bindings).is_empty()
            {
                diagnostic = diagnostic.with_fix(Fix::single(
                    // Suggestion rather than Safe: a pattern rewrite is written
                    // by hand in a config file, and nothing checks that it means
                    // the same thing as what it replaces. `--fix` alone should
                    // not apply it.
                    FixKind::Suggestion,
                    format!("apply the {} rewrite", self.id),
                    Edit::new(
                        Span::new(offset, usize::from(range.len()), span.line, span.column),
                        render(template, &found),
                    ),
                ));
            }

            out.push(diagnostic);
        }
    }
}
