//! What: Acceptance and rejection controls for the whole configuration schema.
//! Why: Unknown keys, unknown policy IDs, duplicates, nulls and invalid values must each
//!      fail with a message naming the key; valid documents must yield exact settings.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // expect(() => parseConfig('{"plugin":1}')).toThrow(/Unknown configuration key: plugin/);
//! ```

/// Import the parser under test, the typed settings and the registry identities.
use super::parse_config;
use crate::config_schema::{
    CliGitConfig, ForbiddenStringsOptions, MarkdownAutofixOptions, MarkdownRule, PolicySetting,
};
use crate::policy_registry::{POLICY_REGISTRY, PolicyId, Severity};

/// Return the rejection message of one document; an accepted document fails the test.
fn rejection(source: &str) -> String {
    return parse_config(source).expect_err(source).message;
}

/// Assert that every listed document is rejected with a message containing the fragment.
fn assert_rejections(cases: &[(&str, &str)]) {
    for (source, fragment) in cases {
        let message: String = rejection(source);
        assert!(message.contains(fragment), "{source}\n  got: {message}");
    }
}

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

/// The direct translation of this repository's TypeScript configuration loads to exact settings.
#[test]
fn repository_translation_loads_exact_settings() {
    let config: CliGitConfig = parse_config(
        r#"{
          "policies": {
            // Rewrites Markdown image links that point at LFS-tracked files.
            "markdown/autofix": ["warn", { "rules": ["lfs-image-url"], "exclude": ["package/ssg/"] }],
            "mono/forbidden-root-context": "error",
            "mono/dependent-version-bump": "error",
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
        (PolicyId::DependentVersionBump, Severity::Error, true),
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

/// Documents that are not one JSONC object are rejected before any key is read.
#[test]
fn non_object_documents_and_syntax_errors_are_rejected() {
    assert_rejections(&[
        (
            "[]",
            "The configuration document must be an object, found an array.",
        ),
        (
            "[{ \"policies\": {} }]",
            "The configuration document must be an object, found an array.",
        ),
        // The shared parser accepts only an object or array as a document root.
        (
            "\"policies\"",
            "JSONC syntax error at byte 0: JSONC document root must be an object or array",
        ),
        ("1", "JSONC syntax error at byte 0"),
        ("true", "JSONC syntax error at byte 0"),
        ("null", "JSONC syntax error at byte 0"),
        ("", "JSONC syntax error at byte 0"),
        ("{", "JSONC syntax error at byte"),
        ("{ \"policies\": }", "JSONC syntax error at byte"),
        ("{} {}", "JSONC syntax error at byte"),
        ("export default {};", "JSONC syntax error at byte 0"),
    ]);
}

/// Unknown and retired top-level keys are named, including near misses and executable-era keys.
#[test]
fn unknown_and_retired_top_level_keys_are_named() {
    assert_rejections(&[
        (
            r#"{ "plugin": {} }"#,
            "Unknown configuration key: plugin. Accepted keys: policies, hooks, indexLock, landing.",
        ),
        (
            r#"{ "Policies": {} }"#,
            "Unknown configuration key: Policies.",
        ),
        (
            r#"{ "policies ": {} }"#,
            "Unknown configuration key: policies .",
        ),
        (r#"{ "": {} }"#, "Unknown configuration key: ."),
        (
            r#"{ "__proto__": {} }"#,
            "Unknown configuration key: __proto__.",
        ),
        (
            r#"{ "$schema": "x" }"#,
            "Unknown configuration key: $schema.",
        ),
        (
            r#"{ "imports": ["./x.mjs"] }"#,
            "Unknown configuration key: imports.",
        ),
        (
            r#"{ "index-lock": {} }"#,
            "Unknown configuration key: index-lock.",
        ),
        (
            r#"{ "plugins": { "security": "x" } }"#,
            "Configuration key plugins is retired",
        ),
        (
            r#"{ "trust": { "children": true } }"#,
            "Configuration key trust is retired",
        ),
        (
            r#"{ "policies": {}, "unknown": 1 }"#,
            "Unknown configuration key: unknown.",
        ),
    ]);
}

/// A key defined twice, literally or through an escape alias, is rejected at every level.
#[test]
fn ambiguous_duplicate_settings_are_rejected() {
    assert_rejections(&[
        (
            r#"{ "policies": {}, "policies": {} }"#,
            "Configuration key policies is defined more than once",
        ),
        (
            r#"{ "hooks": {}, "hooks": { "concurrentCommits": true } }"#,
            "Configuration key hooks is defined more than once",
        ),
        (
            r#"{ "policies": { "final-newline": "off", "final-newline": "error" } }"#,
            "Configuration key policies.final-newline is defined more than once",
        ),
        (
            r#"{ "policies": { "final-newline": "off", "final-newline": "off" } }"#,
            "Configuration key policies.final-newline is defined more than once",
        ),
        (
            r#"{ "hooks": { "concurrentCommits": true, "concurrentCommits": true } }"#,
            "Configuration key hooks.concurrentCommits is defined more than once",
        ),
        (
            r#"{ "indexLock": { "unprovenOwnerTimeoutMs": 1, "unprovenOwnerTimeoutMs": 2 } }"#,
            "Configuration key indexLock.unprovenOwnerTimeoutMs is defined more than once",
        ),
        (
            r#"{ "policies": { "security/forbidden-strings": ["error", { "builtinRules": true, "builtinRules": false }] } }"#,
            "Configuration key policies.security/forbidden-strings[1].builtinRules is defined more than once",
        ),
        (
            r#"{ "policies": { "markdown/autofix": ["error", { "exclude": [], "exclude": [] }] } }"#,
            "Configuration key policies.markdown/autofix[1].exclude is defined more than once",
        ),
    ]);
}

/// Null is rejected wherever a setting is expected.
#[test]
fn null_is_rejected_at_every_level() {
    assert_rejections(&[
        (
            r#"{ "policies": null }"#,
            "Configuration key policies must not be null",
        ),
        (
            r#"{ "hooks": null }"#,
            "Configuration key hooks must not be null",
        ),
        (
            r#"{ "indexLock": null }"#,
            "Configuration key indexLock must not be null",
        ),
        (
            r#"{ "landing": null }"#,
            "Configuration key landing must not be null",
        ),
        (
            r#"{ "hooks": { "concurrentCommits": null } }"#,
            "Configuration key hooks.concurrentCommits must not be null",
        ),
        (
            r#"{ "indexLock": { "unprovenOwnerTimeoutMs": null } }"#,
            "Configuration key indexLock.unprovenOwnerTimeoutMs must not be null",
        ),
        (
            r#"{ "landing": { "reserveAfterLostRaces": null } }"#,
            "Configuration key landing.reserveAfterLostRaces must not be null",
        ),
        (
            r#"{ "policies": { "require-root": null } }"#,
            "Configuration key policies.require-root must not be null",
        ),
        (
            r#"{ "policies": { "markdown/autofix": [null, {}] } }"#,
            "Configuration key policies.markdown/autofix[0] must not be null",
        ),
        (
            r#"{ "policies": { "markdown/autofix": ["warn", null] } }"#,
            "Configuration key policies.markdown/autofix[1] must not be null",
        ),
        (
            r#"{ "policies": { "markdown/autofix": ["warn", { "rules": null }] } }"#,
            "Configuration key policies.markdown/autofix[1].rules must not be null",
        ),
        (
            r#"{ "policies": { "markdown/autofix": ["warn", { "exclude": [null] }] } }"#,
            "Configuration key policies.markdown/autofix[1].exclude[0] must not be null",
        ),
        (
            r#"{ "policies": { "security/forbidden-strings": ["warn", { "builtinRules": null }] } }"#,
            "Configuration key policies.security/forbidden-strings[1].builtinRules must not be null",
        ),
    ]);
}

/// Concurrency sections reject wrong shapes, unknown nested keys and out-of-range numbers.
#[test]
fn invalid_concurrency_values_are_rejected_by_key() {
    assert_rejections(&[
        (
            r#"{ "hooks": [] }"#,
            "Configuration key hooks must be an object, found an array.",
        ),
        (
            r#"{ "indexLock": 1000 }"#,
            "Configuration key indexLock must be an object, found a number.",
        ),
        (
            r#"{ "landing": "1" }"#,
            "Configuration key landing must be an object, found a string.",
        ),
        (
            r#"{ "hooks": { "concurrent": true } }"#,
            "Unknown configuration key: hooks.concurrent. The only accepted key under hooks is concurrentCommits.",
        ),
        (
            r#"{ "indexLock": { "timeoutMs": 1 } }"#,
            "Unknown configuration key: indexLock.timeoutMs. The only accepted key under indexLock is unprovenOwnerTimeoutMs.",
        ),
        (
            r#"{ "landing": { "reserveAfterLostRaces": 1, "extra": 1 } }"#,
            "Unknown configuration key: landing.extra. The only accepted key under landing is reserveAfterLostRaces.",
        ),
        (
            r#"{ "hooks": { "unprovenOwnerTimeoutMs": 1 } }"#,
            "Unknown configuration key: hooks.unprovenOwnerTimeoutMs.",
        ),
        (
            r#"{ "hooks": { "concurrentCommits": "true" } }"#,
            "Configuration key hooks.concurrentCommits must be true or false, found a string.",
        ),
        (
            r#"{ "hooks": { "concurrentCommits": 1 } }"#,
            "Configuration key hooks.concurrentCommits must be true or false, found a number.",
        ),
        (
            r#"{ "indexLock": { "unprovenOwnerTimeoutMs": -1 } }"#,
            "Configuration key indexLock.unprovenOwnerTimeoutMs must be a whole number from 0 to 9007199254740991, found -1.",
        ),
        (
            r#"{ "indexLock": { "unprovenOwnerTimeoutMs": 0.5 } }"#,
            "Configuration key indexLock.unprovenOwnerTimeoutMs must be a whole number from 0",
        ),
        (
            r#"{ "indexLock": { "unprovenOwnerTimeoutMs": 9007199254740992 } }"#,
            "Configuration key indexLock.unprovenOwnerTimeoutMs must be a whole number from 0",
        ),
        (
            r#"{ "indexLock": { "unprovenOwnerTimeoutMs": "1000" } }"#,
            "Configuration key indexLock.unprovenOwnerTimeoutMs must be a whole number from 0 to 9007199254740991, found a string.",
        ),
        (
            r#"{ "landing": { "reserveAfterLostRaces": 0 } }"#,
            "Configuration key landing.reserveAfterLostRaces must be a whole number from 1 to 9007199254740991, found 0.",
        ),
        (
            r#"{ "landing": { "reserveAfterLostRaces": true } }"#,
            "Configuration key landing.reserveAfterLostRaces must be a whole number from 1",
        ),
    ]);
}

/// Unknown policy IDs, including traversal-shaped and namespace near misses, list the shipped IDs.
#[test]
fn unknown_policy_ids_are_rejected_with_the_shipped_list() {
    let listed: &str = "Shipped policies: require-root, linked-worktree-only, branch-worktree-only, \
                        add-explicit, final-newline, markdown/autofix, mono/forbidden-root-context, \
                        mono/dependent-version-bump, security/forbidden-strings.";
    for id in [
        "forbidden-strings",
        "security/forbidden-string",
        "Security/forbidden-strings",
        "../security/forbidden-strings",
        "security/forbidden-strings/",
        "my-plugin/custom",
        "",
        "require root",
        "--no-enforce-require-root",
    ] {
        let source: String = format!(r#"{{ "policies": {{ "{id}": "off" }} }}"#);
        let message: String = rejection(source.as_str());
        assert_eq!(
            message,
            format!("Unknown policy ID: {id}. {listed}"),
            "{source}"
        );
    }
}

/// Settings of the wrong shape or with an unknown severity word are rejected by key.
#[test]
fn invalid_policy_settings_are_rejected_by_key() {
    assert_rejections(&[
        (
            r#"{ "policies": [] }"#,
            "Configuration key policies must be an object mapping policy IDs to settings, found an array.",
        ),
        (
            r#"{ "policies": { "require-root": "fatal" } }"#,
            "Configuration key policies.require-root has an invalid severity \"fatal\"; use \"off\", \"warn\" or \"error\".",
        ),
        (
            r#"{ "policies": { "require-root": "Error" } }"#,
            "Configuration key policies.require-root has an invalid severity \"Error\"",
        ),
        (
            r#"{ "policies": { "require-root": "" } }"#,
            "Configuration key policies.require-root has an invalid severity \"\"",
        ),
        (
            r#"{ "policies": { "require-root": 2 } }"#,
            "Configuration key policies.require-root must be a severity string, found a number.",
        ),
        (
            r#"{ "policies": { "require-root": true } }"#,
            "Configuration key policies.require-root must be a severity string, found a boolean.",
        ),
        (
            r#"{ "policies": { "require-root": { "severity": "error" } } }"#,
            "Configuration key policies.require-root must be a severity string, found an object.",
        ),
        (
            r#"{ "policies": { "markdown/autofix": 1 } }"#,
            "Configuration key policies.markdown/autofix must be a severity string or [severity, options], found a number.",
        ),
        (
            r#"{ "policies": { "require-root": ["error", {}] } }"#,
            "Configuration key policies.require-root does not accept options; write the severity alone",
        ),
        (
            r#"{ "policies": { "mono/dependent-version-bump": ["error"] } }"#,
            "Configuration key policies.mono/dependent-version-bump does not accept options",
        ),
        (
            r#"{ "policies": { "markdown/autofix": [] } }"#,
            "Configuration key policies.markdown/autofix must be a severity or exactly [severity, options]; found an array of 0 items.",
        ),
        (
            r#"{ "policies": { "markdown/autofix": ["warn"] } }"#,
            "found an array of 1 items.",
        ),
        (
            r#"{ "policies": { "security/forbidden-strings": ["warn", {}, {}] } }"#,
            "Configuration key policies.security/forbidden-strings must be a severity or exactly [severity, options]; found an array of 3 items.",
        ),
        (
            r#"{ "policies": { "markdown/autofix": [{}, "warn"] } }"#,
            "Configuration key policies.markdown/autofix[0] must be a string, found an object.",
        ),
        (
            r#"{ "policies": { "markdown/autofix": ["loud", {}] } }"#,
            "Configuration key policies.markdown/autofix[0] has an invalid severity \"loud\"",
        ),
        (
            r#"{ "policies": { "markdown/autofix": ["warn", []] } }"#,
            "Configuration key policies.markdown/autofix[1] must be an options object, found an array.",
        ),
        (
            r#"{ "policies": { "security/forbidden-strings": ["warn", "x"] } }"#,
            "Configuration key policies.security/forbidden-strings[1] must be an options object, found a string.",
        ),
    ]);
}

/// Option keys outside each policy's schema, including program-selecting ones, are rejected.
#[test]
fn invalid_policy_options_are_rejected_by_key() {
    assert_rejections(&[
        (
            r#"{ "policies": { "security/forbidden-strings": ["error", { "executable": "./scanner" }] } }"#,
            "Configuration key policies.security/forbidden-strings[1].executable is retired",
        ),
        (
            r#"{ "policies": { "security/forbidden-strings": ["error", { "rules": [] }] } }"#,
            "Unknown configuration key: policies.security/forbidden-strings[1].rules. The only accepted option is builtinRules.",
        ),
        (
            r#"{ "policies": { "security/forbidden-strings": ["error", { "builtinRules": "yes" }] } }"#,
            "Configuration key policies.security/forbidden-strings[1].builtinRules must be true or false, found a string.",
        ),
        (
            r#"{ "policies": { "markdown/autofix": ["warn", { "command": ["node", "x.ts"] }] } }"#,
            "Configuration key policies.markdown/autofix[1].command is retired",
        ),
        (
            r#"{ "policies": { "markdown/autofix": ["warn", { "builtinRules": true }] } }"#,
            "Unknown configuration key: policies.markdown/autofix[1].builtinRules. Accepted options: rules, exclude.",
        ),
        (
            r#"{ "policies": { "markdown/autofix": ["warn", { "rules": "lfs-image-url" }] } }"#,
            "Configuration key policies.markdown/autofix[1].rules must be an array of strings, found a string.",
        ),
        (
            r#"{ "policies": { "markdown/autofix": ["warn", { "rules": [] }] } }"#,
            "Configuration key policies.markdown/autofix[1].rules must name at least one rule",
        ),
        (
            r#"{ "policies": { "markdown/autofix": ["warn", { "rules": ["lfs-image-url", "semantic-line-breaks"] }] } }"#,
            "Configuration key policies.markdown/autofix[1].rules[1] names an unknown Markdown rule \"semantic-line-breaks\"",
        ),
        (
            r#"{ "policies": { "markdown/autofix": ["warn", { "rules": ["--fix"] }] } }"#,
            "Configuration key policies.markdown/autofix[1].rules[0] names an unknown Markdown rule \"--fix\"",
        ),
        (
            r#"{ "policies": { "markdown/autofix": ["warn", { "rules": ["lfs-image-url", "lfs-image-url"] }] } }"#,
            "Configuration key policies.markdown/autofix[1].rules[1] repeats the Markdown rule \"lfs-image-url\"",
        ),
        (
            r#"{ "policies": { "markdown/autofix": ["warn", { "rules": [1] }] } }"#,
            "Configuration key policies.markdown/autofix[1].rules[0] must be a string, found a number.",
        ),
        (
            r#"{ "policies": { "markdown/autofix": ["warn", { "exclude": "package/ssg/" }] } }"#,
            "Configuration key policies.markdown/autofix[1].exclude must be an array of strings, found a string.",
        ),
        (
            r#"{ "policies": { "markdown/autofix": ["warn", { "exclude": ["a", ["b"]] }] } }"#,
            "Configuration key policies.markdown/autofix[1].exclude[1] must be a string, found an array.",
        ),
    ]);
}

/// A rejected later key never leaks earlier settings: the whole document fails.
#[test]
fn any_invalid_key_rejects_the_whole_document() {
    assert!(
        parse_config(r#"{ "hooks": { "concurrentCommits": true }, "landing": { "reserveAfterLostRaces": 0 } }"#)
            .is_err()
    );
    assert!(
        parse_config(r#"{ "policies": { "final-newline": "error", "unknown": "off" } }"#).is_err()
    );
}
