//! What: Controls for the typed configuration values themselves.
//! Why: Rule names are printed in diagnostics and passed to the linter, and the setting
//!      lookup is what every policy asks, so both are pinned apart from the parser.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // expect(markdownRuleName(markdownRuleFromName('lfs-image-url'))).toBe('lfs-image-url');
//! ```

/// Import the values under test and the registry they are derived from.
use super::{
    CliGitConfig, ConcurrencyConfig, DEFAULT_RESERVE_AFTER_LOST_RACES,
    DEFAULT_UNPROVEN_OWNER_TIMEOUT_MS, MarkdownRule, PolicyConfig, PolicySetting,
    markdown_rule_from_name, markdown_rule_name,
};
use crate::policy_registry::{POLICY_REGISTRY, PolicyId, Severity};

/// The shipped rule has one exact spelling in both directions; near misses are not rules.
#[test]
fn markdown_rule_names_are_exact_in_both_directions() {
    assert_eq!(
        markdown_rule_name(MarkdownRule::LfsImageUrl),
        "lfs-image-url"
    );
    assert_eq!(
        markdown_rule_from_name("lfs-image-url"),
        Some(MarkdownRule::LfsImageUrl)
    );
    assert_eq!(
        markdown_rule_from_name(markdown_rule_name(MarkdownRule::LfsImageUrl)),
        Some(MarkdownRule::LfsImageUrl)
    );
    for name in [
        "",
        "LFS-IMAGE-URL",
        "lfs-image-url ",
        " lfs-image-url",
        "lfs-image-urls",
        "lfs-image",
        "markdown/lfs-image-url",
        "lfs_image_url",
    ] {
        assert_eq!(markdown_rule_from_name(name), None, "{name:?}");
    }
}

/// The lookup returns each policy's own row, in both default sets and after a change.
#[test]
fn setting_lookup_returns_each_policy_row() {
    let mut config: PolicyConfig = PolicyConfig::defaults();
    assert_eq!(config.settings.len(), POLICY_REGISTRY.len());
    for (index, descriptor) in POLICY_REGISTRY.iter().enumerate() {
        assert_eq!(config.settings[index].id, descriptor.id);
        assert_eq!(
            config.setting(descriptor.id),
            PolicySetting {
                id: descriptor.id,
                severity: descriptor.default_severity,
                explicit: false,
            },
            "{}",
            descriptor.name
        );
    }
    // Changing the last row changes only that policy's answer.
    let last: usize = config.settings.len() - 1;
    config.settings[last].severity = Severity::Off;
    config.settings[last].explicit = true;
    assert_eq!(
        config.setting(PolicyId::ForbiddenStrings),
        PolicySetting {
            id: PolicyId::ForbiddenStrings,
            severity: Severity::Off,
            explicit: true,
        }
    );
    assert_eq!(
        config.setting(PolicyId::RequireRoot).severity,
        Severity::Error
    );
}

/// A settings list missing a row answers with the registry default instead of stopping Git.
#[test]
fn setting_lookup_falls_back_to_the_registry_default() {
    let mut config: PolicyConfig = PolicyConfig::unconfigured();
    config.settings.clear();
    for descriptor in POLICY_REGISTRY {
        assert_eq!(
            config.setting(descriptor.id),
            PolicySetting {
                id: descriptor.id,
                severity: descriptor.default_severity,
                explicit: false,
            },
            "{}",
            descriptor.name
        );
    }
}

/// Without a configuration file only the policies that need one are off; tuning is unchanged.
#[test]
fn unconfigured_defaults_turn_off_only_file_dependent_policies() {
    let configured: CliGitConfig = CliGitConfig::defaults();
    let unconfigured: CliGitConfig = CliGitConfig::unconfigured();
    for descriptor in POLICY_REGISTRY {
        let expected: Severity = if descriptor.needs_configuration_file {
            Severity::Off
        } else {
            descriptor.default_severity
        };
        assert_eq!(
            unconfigured.policies.setting(descriptor.id).severity,
            expected,
            "{}",
            descriptor.name
        );
        assert!(!unconfigured.policies.setting(descriptor.id).explicit);
        assert_eq!(
            configured.policies.setting(descriptor.id).severity,
            descriptor.default_severity,
            "{}",
            descriptor.name
        );
    }
    assert_eq!(configured.concurrency, unconfigured.concurrency);
    assert_eq!(configured.concurrency, ConcurrencyConfig::defaults());
    assert!(!configured.concurrency.hooks.concurrent_commits);
    assert_eq!(
        configured.concurrency.index_lock.unproven_owner_timeout_ms,
        DEFAULT_UNPROVEN_OWNER_TIMEOUT_MS
    );
    assert_eq!(DEFAULT_UNPROVEN_OWNER_TIMEOUT_MS, 1_000);
    assert_eq!(
        configured.concurrency.landing.reserve_after_lost_races,
        DEFAULT_RESERVE_AFTER_LOST_RACES
    );
    assert_eq!(DEFAULT_RESERVE_AFTER_LOST_RACES, 1);
    assert_eq!(
        configured.policies.markdown_autofix.rules,
        vec![MarkdownRule::LfsImageUrl]
    );
    assert_eq!(
        configured.policies.markdown_autofix.exclude,
        Vec::<String>::new()
    );
    assert!(configured.policies.forbidden_strings.builtin_rules);
    assert_eq!(
        unconfigured.policies.markdown_autofix,
        configured.policies.markdown_autofix
    );
    assert_eq!(
        unconfigured.policies.forbidden_strings,
        configured.policies.forbidden_strings
    );
}
