//! What: Acceptance controls for the configuration schema.
//! Why: A valid document must yield exactly the settings it states and the defaults for
//!      everything it leaves out, so a silently dropped or widened setting fails here.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // expect(parseConfig('{}')).toEqual(defaults());
//! ```

/// Import the parser under test, the typed settings and the registry identities.
use super::parse_config;
use crate::config_schema::{
    CliGitConfig, ForbiddenStringsOptions, MarkdownAutofixOptions, MarkdownRule, PolicySetting,
};
use crate::policy_registry::{POLICY_REGISTRY, PolicyId, Severity};

/// An empty object, with or without comments and trailing commas, is exactly the defaults.
#[test]
fn empty_documents_equal_the_defaults() {
    let defaults: CliGitConfig = CliGitConfig::defaults();
    for source in [
        "{}",
        " { } ",
        "// only a comment\n{}\n",
        "/* block */ { /* inner */ }",
        "{ \"policies\": {}, }",
        "{ \"hooks\": {}, \"indexLock\": {}, \"landing\": {}, }",
    ] {
        assert_eq!(parse_config(source), Ok(defaults.clone()), "{source}");
    }
    assert!(!defaults.concurrency.hooks.concurrent_commits);
    assert_eq!(
        defaults.concurrency.index_lock.unproven_owner_timeout_ms,
        1_000
    );
    assert_eq!(defaults.concurrency.landing.reserve_after_lost_races, 1);
    assert!(defaults.policies.forbidden_strings.builtin_rules);
    assert_eq!(
        defaults.policies.markdown_autofix,
        MarkdownAutofixOptions {
            rules: vec![MarkdownRule::LfsImageUrl],
            exclude: Vec::<String>::new(),
        }
    );
    for descriptor in POLICY_REGISTRY {
        assert_eq!(
            defaults.policies.setting(descriptor.id),
            PolicySetting {
                id: descriptor.id,
                severity: descriptor.default_severity,
                explicit: false,
            }
        );
    }
}

/// The direct translation of this repository's TypeScript `policies` map loads to the
/// severities the incumbent applies, including the unlisted `mono/dependent-version-bump`.
#[test]
fn repository_translation_loads_exact_settings() {
    let config: CliGitConfig = parse_config(
        r#"{
          "policies": {
            // Rewrites Markdown image links that point at LFS-tracked files.
            "markdown/autofix": ["warn", { "rules": ["lfs-image-url"], "exclude": ["package/ssg/"] }],
            "mono/forbidden-root-context": "error",
            "security/forbidden-strings": ["error", { "builtinRules": true }],
          },
        }"#,
    )
    .expect("translated repository configuration");
    for (id, severity, explicit) in [
        (PolicyId::RequireRoot, Severity::Error, false),
        (PolicyId::LinkedWorktreeOnly, Severity::Error, false),
        (PolicyId::BranchWorktreeOnly, Severity::Error, false),
        (PolicyId::AddExplicit, Severity::Error, false),
        (PolicyId::FinalNewline, Severity::Warn, false),
        (PolicyId::MarkdownAutofix, Severity::Warn, true),
        (PolicyId::ForbiddenRootContext, Severity::Error, true),
        // Not listed in the root configuration, yet enforced at its default today.
        (PolicyId::DependentVersionBump, Severity::Error, false),
        (PolicyId::ForbiddenStrings, Severity::Error, true),
    ] {
        assert_eq!(
            config.policies.setting(id),
            PolicySetting {
                id,
                severity,
                explicit
            }
        );
    }
    assert_eq!(config.policies.settings.len(), POLICY_REGISTRY.len());
    assert_eq!(
        config.policies.markdown_autofix,
        MarkdownAutofixOptions {
            rules: vec![MarkdownRule::LfsImageUrl],
            exclude: vec![String::from("package/ssg/")],
        }
    );
    assert_eq!(
        config.policies.forbidden_strings,
        ForbiddenStringsOptions {
            builtin_rules: true
        }
    );
    assert_eq!(config.concurrency, CliGitConfig::defaults().concurrency);
}

/// A repository without a configuration file runs the built-ins only; a configured one
/// runs every shipped policy at its incumbent default unless the file says otherwise.
#[test]
fn unconfigured_and_configured_defaults_differ_only_for_plugin_era_policies() {
    let configured: CliGitConfig = CliGitConfig::defaults();
    let unconfigured: CliGitConfig = CliGitConfig::unconfigured();
    assert_eq!(unconfigured.concurrency, configured.concurrency);
    assert_eq!(
        unconfigured.policies.forbidden_strings,
        configured.policies.forbidden_strings
    );
    assert_eq!(
        unconfigured.policies.markdown_autofix,
        configured.policies.markdown_autofix
    );
    for (id, without_file, with_file) in [
        (PolicyId::RequireRoot, Severity::Error, Severity::Error),
        (
            PolicyId::LinkedWorktreeOnly,
            Severity::Error,
            Severity::Error,
        ),
        (
            PolicyId::BranchWorktreeOnly,
            Severity::Error,
            Severity::Error,
        ),
        (PolicyId::AddExplicit, Severity::Error, Severity::Error),
        (PolicyId::FinalNewline, Severity::Warn, Severity::Warn),
        (PolicyId::MarkdownAutofix, Severity::Off, Severity::Warn),
        (
            PolicyId::ForbiddenRootContext,
            Severity::Off,
            Severity::Error,
        ),
        (
            PolicyId::DependentVersionBump,
            Severity::Off,
            Severity::Error,
        ),
        (PolicyId::ForbiddenStrings, Severity::Off, Severity::Error),
    ] {
        assert_eq!(
            unconfigured.policies.setting(id),
            PolicySetting {
                id,
                severity: without_file,
                explicit: false
            }
        );
        assert_eq!(
            configured.policies.setting(id),
            PolicySetting {
                id,
                severity: with_file,
                explicit: false
            }
        );
    }
    assert_eq!(unconfigured.policies.settings.len(), POLICY_REGISTRY.len());
    // An explicit "off" in a file is the way to stop a shipped policy.
    let disabled: CliGitConfig =
        parse_config(r#"{ "policies": { "mono/dependent-version-bump": "off" } }"#)
            .expect("explicit off");
    assert_eq!(
        disabled.policies.setting(PolicyId::DependentVersionBump),
        PolicySetting {
            id: PolicyId::DependentVersionBump,
            severity: Severity::Off,
            explicit: true
        }
    );
}

/// Every policy accepts every severity word, and the setting is marked explicit.
#[test]
fn every_policy_accepts_every_severity() {
    for descriptor in POLICY_REGISTRY {
        for (word, severity) in [
            ("off", Severity::Off),
            ("warn", Severity::Warn),
            ("error", Severity::Error),
        ] {
            let source: String =
                format!(r#"{{ "policies": {{ "{}": "{word}" }} }}"#, descriptor.name);
            let config: CliGitConfig = parse_config(source.as_str()).expect(source.as_str());
            for other in POLICY_REGISTRY {
                let expected: PolicySetting = if other.id == descriptor.id {
                    PolicySetting {
                        id: other.id,
                        severity,
                        explicit: true,
                    }
                } else {
                    PolicySetting {
                        id: other.id,
                        severity: other.default_severity,
                        explicit: false,
                    }
                };
                assert_eq!(config.policies.setting(other.id), expected, "{source}");
            }
        }
    }
}

/// Options override only their own field; a bare severity keeps default options.
#[test]
fn policy_options_apply_field_by_field() {
    let scanner: CliGitConfig = parse_config(
        r#"{ "policies": { "security/forbidden-strings": ["warn", { "builtinRules": false }] } }"#,
    )
    .expect("scanner options");
    assert!(!scanner.policies.forbidden_strings.builtin_rules);
    assert_eq!(
        scanner
            .policies
            .setting(PolicyId::ForbiddenStrings)
            .severity,
        Severity::Warn
    );
    assert_eq!(
        scanner.policies.markdown_autofix,
        CliGitConfig::defaults().policies.markdown_autofix
    );
    let empty_options: CliGitConfig = parse_config(
        r#"{ "policies": { "security/forbidden-strings": ["error", {}], "markdown/autofix": ["off", {}] } }"#,
    )
    .expect("empty option objects");
    assert!(empty_options.policies.forbidden_strings.builtin_rules);
    assert_eq!(
        empty_options.policies.markdown_autofix,
        CliGitConfig::defaults().policies.markdown_autofix
    );
    assert_eq!(
        empty_options
            .policies
            .setting(PolicyId::MarkdownAutofix)
            .severity,
        Severity::Off
    );
    let excluded: CliGitConfig = parse_config(
        r#"{ "policies": { "markdown/autofix": ["error", { "exclude": ["b/", "", "a/**", "b/"] }] } }"#,
    )
    .expect("exclusions");
    assert_eq!(
        excluded.policies.markdown_autofix,
        MarkdownAutofixOptions {
            rules: vec![MarkdownRule::LfsImageUrl],
            exclude: vec![
                String::from("b/"),
                String::new(),
                String::from("a/**"),
                String::from("b/")
            ],
        }
    );
    let bare: CliGitConfig =
        parse_config(r#"{ "policies": { "security/forbidden-strings": "error" } }"#)
            .expect("bare severity");
    assert!(bare.policies.forbidden_strings.builtin_rules);
    assert!(bare.policies.setting(PolicyId::ForbiddenStrings).explicit);
}

/// Each concurrency key is read independently with its own lower bound.
#[test]
fn concurrency_keys_apply_independently() {
    let all: CliGitConfig = parse_config(
        r#"{
          "hooks": { "concurrentCommits": true },
          "indexLock": { "unprovenOwnerTimeoutMs": 0 },
          "landing": { "reserveAfterLostRaces": 9007199254740991 }
        }"#,
    )
    .expect("all concurrency keys");
    assert!(all.concurrency.hooks.concurrent_commits);
    assert_eq!(all.concurrency.index_lock.unproven_owner_timeout_ms, 0);
    assert_eq!(
        all.concurrency.landing.reserve_after_lost_races,
        9_007_199_254_740_991
    );
    assert_eq!(all.policies, CliGitConfig::defaults().policies);
    let hooks_only: CliGitConfig =
        parse_config(r#"{ "hooks": { "concurrentCommits": false } }"#).expect("hooks");
    assert_eq!(hooks_only, CliGitConfig::defaults());
    let lock_only: CliGitConfig =
        parse_config(r#"{ "indexLock": { "unprovenOwnerTimeoutMs": 2.5e3 } }"#).expect("lock");
    assert_eq!(
        lock_only.concurrency.index_lock.unproven_owner_timeout_ms,
        2_500
    );
    assert_eq!(lock_only.concurrency.landing.reserve_after_lost_races, 1);
    assert!(!lock_only.concurrency.hooks.concurrent_commits);
    let landing_only: CliGitConfig =
        parse_config(r#"{ "landing": { "reserveAfterLostRaces": 1 } }"#).expect("landing");
    assert_eq!(landing_only.concurrency.landing.reserve_after_lost_races, 1);
    assert_eq!(
        landing_only
            .concurrency
            .index_lock
            .unproven_owner_timeout_ms,
        1_000
    );
}
