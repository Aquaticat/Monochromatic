//! Merging configuration files, and resolving one rule's severity for one file.

/// Imports the ordered map rule tables are held in.
use std::collections::BTreeMap;
/// Imports the borrowed path type resolution matches globs against.
use std::path::Path;

// What:     `use globset::{Glob, GlobSet, GlobSetBuilder};`. `Glob` is one
//           compiled pattern, `GlobSet` is many matched in a single pass, and the
//           builder accumulates patterns before compiling them together.
// Why:      A config may carry hundreds of globs across its overrides. Matching
//           them one at a time would rescan the path per pattern; a set matches
//           them all in one pass.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Glob, GlobSet, GlobSetBuilder } from "globset";
// ```
/// Imports the glob matcher used for ignore patterns and override scoping.
use globset::{Glob, GlobSet, GlobSetBuilder};

/// Imports the command-line severity overrides applied last.
use crate::config::cli_override::CliOverride;
/// Imports the on-disk configuration shapes being merged.
use crate::config::file::{ConfigFile, Options, Override, PatternConfig, RuleSetting};
/// Imports the configured-severity and category types.
use crate::severity::{Category, RuleSeverity};

// What:     `pub struct ResolvedRule { .. }` is the answer resolution produces:
//           what severity this rule runs at for this file, and with what options.
// Why:      The runner needs both, and computing them separately would walk the
//           override list twice.
/// Outcome of resolving one rule against one file path.
#[derive(Clone, Debug)]
pub struct ResolvedRule {
    /// Severity this rule reports at, or `Off` when it does not run.
    pub severity: RuleSeverity,

    // What:     `options: Option<toml::Table>`. Owned rather than borrowed,
    //           because the winning table may come from any layer and outlives
    //           the walk that found it.
    // Why:      Absent when no layer configured options for this rule.
    /// Option table the winning layer supplied, absent when none did.
    pub options: Option<toml::Table>,
}

// What:     `pub struct LinterConfig { .. }` is the merged result of an entire
//           `extends` chain plus any nested configs, with every glob already
//           compiled.
// Why:      Compiling globs once at load time rather than per file is the
//           difference between one compile and 310 of them on this repo.
/// Fully merged configuration with its globs compiled.
#[derive(Debug)]
pub struct LinterConfig {
    /// Run-wide switches from the merged files.
    pub options: Options,

    /// Compiled matcher for files excluded from the run entirely.
    ignore: GlobSet,

    /// Severity per category, from the merged files.
    categories: BTreeMap<Category, RuleSeverity>,

    /// Severity and options per rule, from the merged files.
    rules: BTreeMap<String, RuleSetting>,

    /// Compiled include and exclude globs for the rules above, keyed by name.
    rule_scopes: BTreeMap<String, CompiledScope>,

    /// Compiled matcher for the files a run is restricted to, when it is.
    include: GlobSet,

    /// Whether an include list was given, since an empty set matches nothing.
    has_include: bool,

    // What:     `Vec<CompiledOverride>` is a growable array of overrides whose
    //           globs are already compiled.
    // Why:      Overrides apply in order, so they stay a sequence rather than a
    //           map: resolution walks them front to back and the last match wins.
    /// Overrides in declaration order, each with its globs compiled.
    overrides: Vec<CompiledOverride>,

    // What:     Command-line overrides, kept separate from the file ones rather
    //           than appended to them.
    // Why:      They are a different shape (no globs, so they apply everywhere)
    //           and they apply strictly after every file layer. `-D correctness`
    //           on the command line beats what any config file said, which is
    //           the whole point of passing it.
    /// Command-line severity flags, in the order they appeared in argv.
    cli_overrides: Vec<CliOverride>,

    /// Declarative pattern rules, kept so the runner can build rules from them.
    pub patterns: Vec<PatternConfig>,

    /// Plugins whose rules run, absent when every compiled-in plugin runs.
    plugins: Option<Vec<String>>,

    /// Per-plugin configuration, keyed by plugin name.
    settings: BTreeMap<String, toml::Table>,
}

// What:     `struct CompiledScope { .. }` is one rule's include and exclude
//           globs, compiled.
// Why:      Compiling per resolve call would mean rebuilding a matcher once per
//           rule per file. Compiling once at load time is the difference between
//           one compile and several thousand.
/// One rule's file scope, with its globs compiled.
#[derive(Debug)]
struct CompiledScope {
    /// Files this rule applies to; empty means wherever it is otherwise enabled.
    include: GlobSet,

    /// Whether an include list was given at all, since an empty set matches nothing.
    has_include: bool,

    /// Files this rule does not apply to.
    exclude: GlobSet,
}

/// Scope matching for one rule.
impl CompiledScope {
    /// Report whether this rule applies to the given path.
    fn covers(&self, path: &Path) -> bool {
        // An exclude always wins, whatever the include list says.
        if self.exclude.is_match(path) {
            return false;
        }

        // No include list means no restriction. An empty `GlobSet` matches
        // nothing, so testing it without this guard would disable every rule
        // that did not name an include.
        if !self.has_include {
            return true;
        }

        return self.include.is_match(path);
    }
}

/// One override with its globs already compiled.
#[derive(Debug)]
struct CompiledOverride {
    /// Files this override applies to.
    files: GlobSet,

    /// Files subtracted from `files`, still linted but unaffected here.
    exclude_files: GlobSet,

    /// Rule settings this override imposes.
    rules: BTreeMap<String, RuleSetting>,

    /// Compiled include and exclude globs for those settings, keyed by name.
    rule_scopes: BTreeMap<String, CompiledScope>,
}

/// Merging and resolution over a fully loaded configuration.
impl LinterConfig {
    // What:     `pub fn compile(merged: ConfigFile) -> Result<Self, globset::Error>`.
    //           `Result<T, E>` is how a fallible operation answers: `Ok(value)`
    //           or `Err(error)`. Rust has no exceptions, so failure is in the
    //           return type and the caller cannot ignore it.
    // Why:      A malformed glob in config is a user error worth naming, not a
    //           reason to panic.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // static compile(merged: ConfigFile): LinterConfig // throws on a bad glob
    // ```
    /// Compile a merged configuration's globs, readying it for resolution.
    pub fn compile(merged: ConfigFile) -> Result<Self, globset::Error> {
        // The `?` operator unwraps an `Ok` or returns the `Err` from this whole
        // function, which is how errors travel without exceptions.
        let ignore = build_glob_set(&merged.ignore_patterns)?;
        let include = build_glob_set(&merged.include_patterns)?;
        let has_include = !merged.include_patterns.is_empty();
        let rule_scopes = compile_scopes(&merged.rules)?;

        // What:     `let mut overrides = Vec::new();` then a `for` loop pushing
        //           into it. `mut` is required to mutate a binding at all;
        //           bindings are immutable by default in Rust.
        // Why:      Each override's two glob sets are compiled here, once.
        let mut overrides = Vec::new();
        for entry in merged.overrides {
            overrides.push(compile_override(entry)?);
        }

        return Ok(Self {
            options: merged.options,
            ignore,
            categories: merged.categories,
            rules: merged.rules,
            rule_scopes,
            include,
            has_include,
            overrides,
            cli_overrides: Vec::new(),
            patterns: merged.patterns,
            plugins: merged.plugins,
            settings: merged.settings,
        });
    }

    // What:     `pub fn is_ignored(&self, path: &Path) -> bool`. Answers for both
    //           lists: a path is out if an ignore pattern matches it, OR if an
    //           include list exists and does not.
    // Why:      Excludes subtract from whatever the includes admit, which is the
    //           order a reader expects: say what you lint, then carve out the
    //           exceptions.
    /// Report whether a path is excluded from the run entirely.
    pub fn is_ignored(&self, path: &Path) -> bool {
        if self.ignore.is_match(path) {
            return true;
        }

        // An empty `GlobSet` matches nothing, so an absent include list has to
        // be checked separately rather than tested against an empty matcher.
        if self.has_include && !self.include.is_match(path) {
            return true;
        }

        return false;
    }

    // What:     `pub fn resolve(&self, path: &Path, plugin: &str, rule_id: &str,
    //           category: Category) -> ResolvedRule`. Every argument is borrowed
    //           read-only; nothing here takes ownership.
    // Why:      Resolution runs once per rule per file, so it must not allocate
    //           or copy the config.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // resolve(path: string, plugin: string, ruleId: string, category: Category): ResolvedRule
    // ```
    /// Resolve one rule's severity and options for one file.
    pub fn resolve(
        &self,
        path: &Path,
        plugin: &str,
        rule_id: &str,
        category: Category,
    ) -> ResolvedRule {
        // Layer 1: the category's own default, which is what an empty config means.
        let mut severity = category.default_severity();
        let mut options = None;

        // Layer 2: an explicit category setting replaces that default.
        if let Some(configured) = self.categories.get(&category) {
            severity = *configured;
        }

        // Layer 2b: a configured pattern rule carries its own severity, which
        // stands in for the category default. Without this a pattern rule would
        // sit in the restriction category, be off by default, and do nothing
        // until enabled a second time in the `rules` table.
        if let Some(configured) = self
            .patterns
            .iter()
            .find(|candidate| return candidate.id == rule_id)
        {
            severity = configured.severity;
        }

        // What:     `scope` tracks the file scope of whichever layer last won,
        //           alongside the severity and options it supplied.
        // Why:      A rule's `include`/`exclude` belongs to the SETTING that
        //           won, not to the rule name globally. An override restating a
        //           rule with a different scope must replace the outer one
        //           rather than being intersected with it.
        let mut scope: Option<&CompiledScope> = None;

        // Layer 3: a setting naming this rule directly, by either spelling.
        if let Some(setting) = lookup_rule(&self.rules, plugin, rule_id) {
            severity = setting.severity();
            // `.cloned()` copies the borrowed table into an owned one, needed
            // because the answer outlives this borrow of the config.
            options = setting.options().cloned();
            scope = lookup_scope(&self.rule_scopes, plugin, rule_id);
        }

        // Layer 4: every matching override, in order, so the last one wins.
        for entry in &self.overrides {
            if !entry.files.is_match(path) || entry.exclude_files.is_match(path) {
                continue;
            }

            if let Some(setting) = lookup_rule(&entry.rules, plugin, rule_id) {
                severity = setting.severity();
                options = setting.options().cloned();
                scope = lookup_scope(&entry.rule_scopes, plugin, rule_id);
            }
        }

        // The winning layer's own file scope, applied before the command-line
        // flags below. A rule scoped away from this path does not run, but an
        // explicit `-D rule` on the command line still turns it back on: the
        // flag is a deliberate instruction and the scope is a default.
        if let Some(scope) = scope
            && !scope.covers(path)
        {
            severity = RuleSeverity::Off;
        }

        // Layer 5: command-line flags, which beat every file layer. They
        // accumulate left to right, so `-A all -D no-unwrap` enables exactly one
        // rule and `-D all -A no-unwrap` disables exactly one.
        for entry in &self.cli_overrides {
            if entry.matches(plugin, rule_id, category) {
                severity = entry.severity;
            }
        }

        return ResolvedRule { severity, options };
    }

    // What:     `pub fn with_cli_overrides(mut self, overrides: Vec<CliOverride>)
    //           -> Self`. Takes OWNERSHIP of the configuration, stores the flags,
    //           and hands it back, so the call chains onto `compile`.
    // Why:      The flags are known only after argv is parsed, while compiling
    //           the globs happens when the files are read. Keeping them separate
    //           means neither step has to wait for the other.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // withCliOverrides(overrides: CliOverride[]): LinterConfig
    // ```
    // What:     `pub fn plugin_enabled(&self, plugin: &str) -> bool`.
    // Why:      An absent `plugins` key enables every compiled-in plugin, which
    //           is what a configuration that says nothing about plugins means. A
    //           present one is the complete set, so naming `["builtin"]` turns
    //           every other plugin off.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // pluginEnabled(plugin: string): boolean
    // ```
    /// Report whether a plugin's rules run at all.
    pub fn plugin_enabled(&self, plugin: &str) -> bool {
        // `.as_ref()` borrows the inner vector rather than moving it out of the
        // `Option`, and `.is_none_or(..)` is true when absent OR when the
        // closure accepts, which is exactly "unset means all".
        return self
            .plugins
            .as_ref()
            .is_none_or(|named| return named.iter().any(|entry| return entry == plugin));
    }

    // What:     `pub fn settings_for(&self, plugin: &str) -> Option<&toml::Table>`.
    //           Hands back a BORROWED view rather than a copy.
    // Why:      This is oxlint's `settings`, the parity hole the planning
    //           document named. A plugin reads its own table; this layer cannot
    //           type it, because it does not know what any plugin's settings
    //           mean.
    /// Return one plugin's settings table, absent when it configured none.
    pub fn settings_for(&self, plugin: &str) -> Option<&toml::Table> {
        return self.settings.get(plugin);
    }

    /// Attach command-line severity flags, returning the config for chaining.
    pub fn with_cli_overrides(mut self, overrides: Vec<CliOverride>) -> Self {
        self.cli_overrides = overrides;
        return self;
    }
}

// What:     `pub fn merge(base: ConfigFile, nearer: ConfigFile) -> ConfigFile`.
//           Takes OWNERSHIP of both and returns a new one, rather than mutating
//           in place, so neither input can be observed half-merged.
// Why:      Both `extends` and nested config discovery need the same operation:
//           lay one configuration over another. Decision D3's follow-up settled
//           that this is a FULL merge, unlike oxlint's `extends`, which merges
//           only rules and silently drops categories, ignore patterns and
//           overrides. `oxlint.config.ts:7` documents that limitation as the
//           reason the repo's own root config spreads its base instead of
//           extending it, so reproducing the limitation would be copying a bug.
//
// In TS you'd write (pseudocode):
// ```ts
// function merge(base: ConfigFile, nearer: ConfigFile): ConfigFile
// ```
/// Lay one configuration over another, with the nearer one winning.
pub fn merge(base: ConfigFile, nearer: ConfigFile) -> ConfigFile {
    // Sequences concatenate, base first, so a nearer config adds to the ignore
    // list and appends overrides that therefore win by running later.
    let mut include_patterns = base.include_patterns;
    include_patterns.extend(nearer.include_patterns);

    let mut ignore_patterns = base.ignore_patterns;
    ignore_patterns.extend(nearer.ignore_patterns);

    let mut overrides = base.overrides;
    overrides.extend(nearer.overrides);

    // Pattern rules concatenate like any other sequence, so a package config
    // adds rules to the repository-wide set rather than replacing it.
    let mut patterns = base.patterns;
    patterns.extend(nearer.patterns);

    // Settings merge per plugin, so a package config restates only the plugin
    // whose settings it changes.
    let mut settings = base.settings;
    settings.extend(nearer.settings);

    // What:     `nearer.plugins.or(base.plugins)` keeps the nearer list when
    //           present and inherits otherwise.
    // Why:      The plugin set REPLACES rather than concatenating, unlike every
    //           other sequence here. A config that names its plugins is stating
    //           the whole set it wants; appending to an inherited list would
    //           make it impossible to narrow one.
    let plugins = nearer.plugins.or(base.plugins);

    // Maps merge key by key, so a nearer config restates only what it changes.
    let mut categories = base.categories;
    categories.extend(nearer.categories);

    let mut rules = base.rules;
    rules.extend(nearer.rules);

    // What:     `extends` concatenates like any other sequence, rather than
    //           being cleared.
    // Why:      This function is public and merges two arbitrary `ConfigFile`s,
    //           which may not have been through the loader. Dropping the key
    //           here would silently discard whatever the base said it extended,
    //           and silence is the one thing a config merge must never do.
    //           `load_with_trail` clears the key explicitly once it HAS resolved
    //           the chain, which is the only place that knows the chain is done.
    let mut extends = base.extends;
    extends.extend(nearer.extends);

    return ConfigFile {
        extends,
        include_patterns,
        ignore_patterns,
        options: merge_options(base.options, nearer.options),
        categories,
        rules,
        overrides,
        patterns,
        plugins,
        settings,
    };
}

/// Lay one options table over another, field by field.
fn merge_options(base: Options, nearer: Options) -> Options {
    return Options {
        // A nearer `true` turns the switch on; a nearer `false` cannot turn off
        // what a base enabled, because absent and false are the same value in a
        // bool. That is the cost of the plain `bool` this key uses.
        deny_warnings: base.deny_warnings || nearer.deny_warnings,

        // `.or(fallback)` keeps the nearer value when present and falls back
        // otherwise, which is exactly "nearer wins, absent inherits".
        max_warnings: nearer.max_warnings.or(base.max_warnings),
        report_unused_disable_directives: nearer
            .report_unused_disable_directives
            .or(base.report_unused_disable_directives),
    };
}

// What:     `fn lookup_rule<'a>(..) -> Option<&'a RuleSetting>`. The `'a` is a
//           LIFETIME parameter, naming how long the returned borrow stays valid:
//           as long as the map it came from. TS has no equivalent, because its
//           garbage collector makes the question moot.
// Why:      Returning a borrow rather than a copy keeps resolution allocation
//           free in the common case where a rule is not configured at all.
//
// In TS you'd write (pseudocode):
// ```ts
// function lookupRule(rules: Map<string, RuleSetting>, plugin: string, ruleId: string)
// ```
/// Find a rule's setting by its qualified name, falling back to its bare name.
fn lookup_rule<'a>(
    rules: &'a BTreeMap<String, RuleSetting>,
    plugin: &str,
    rule_id: &str,
) -> Option<&'a RuleSetting> {
    // The qualified spelling wins, so `builtin/max-lines` beats a bare
    // `max-lines` when a config happens to carry both.
    let qualified = format!("{plugin}/{rule_id}");
    if let Some(setting) = rules.get(&qualified) {
        return Some(setting);
    }

    return rules.get(rule_id);
}

// What:     `fn lookup_scope<'a>(..) -> Option<&'a CompiledScope>`. The scope
//           counterpart of `lookup_rule`, matching the same two spellings.
// Why:      A rule named `builtin/max-lines` in one place and `max-lines` in
//           another must find its scope either way, or the scope would silently
//           not apply.
/// Find a rule's compiled scope by its qualified name, then its bare one.
fn lookup_scope<'a>(
    scopes: &'a BTreeMap<String, CompiledScope>,
    plugin: &str,
    rule_id: &str,
) -> Option<&'a CompiledScope> {
    let qualified = format!("{plugin}/{rule_id}");
    if let Some(scope) = scopes.get(&qualified) {
        return Some(scope);
    }

    return scopes.get(rule_id);
}

/// Compile one override's include and exclude globs.
fn compile_override(entry: Override) -> Result<CompiledOverride, globset::Error> {
    let rule_scopes = compile_scopes(&entry.rules)?;

    return Ok(CompiledOverride {
        files: build_glob_set(&entry.files)?,
        exclude_files: build_glob_set(&entry.exclude_files)?,
        rules: entry.rules,
        rule_scopes,
    });
}

// What:     `fn build_glob_set(patterns: &[String]) -> Result<GlobSet, globset::Error>`.
//           `&[String]` is a borrowed VIEW of an array, which accepts a `Vec`
//           without taking it.
// Why:      One matcher per pattern list, compiled once.
// What:     `fn compile_scopes(..) -> Result<BTreeMap<String, CompiledScope>, globset::Error>`.
//           Compiles the include and exclude globs of every rule in one table.
// Why:      Both the top-level `rules` table and each override's carry them, so
//           the work is written once and called twice.
/// Compile the file scope of every rule in one settings table.
fn compile_scopes(
    rules: &BTreeMap<String, RuleSetting>,
) -> Result<BTreeMap<String, CompiledScope>, globset::Error> {
    let mut scopes = BTreeMap::new();

    for (name, setting) in rules {
        let (include, exclude) = setting.scope();

        // A rule that named neither needs no scope entry at all, which keeps the
        // lookup in `resolve` cheap for the common case.
        if include.is_empty() && exclude.is_empty() {
            continue;
        }

        scopes.insert(
            name.clone(),
            CompiledScope {
                include: build_glob_set(include)?,
                has_include: !include.is_empty(),
                exclude: build_glob_set(exclude)?,
            },
        );
    }

    return Ok(scopes);
}

/// Compile a list of glob patterns into a single matcher.
fn build_glob_set(patterns: &[String]) -> Result<GlobSet, globset::Error> {
    let mut builder = GlobSetBuilder::new();
    for pattern in patterns {
        // `Glob::new` rejects malformed patterns, which `?` propagates so the
        // user sees which pattern was wrong rather than a silent non-match.
        builder.add(Glob::new(pattern)?);
    }

    return builder.build();
}
