//! What: Exact JSON Lines text of every event kind, its optional fields, escaping and numbering.
//! Why: Readers of the incumbent's events match field names and rely on one object per
//!      line; a reordered, missing or unescaped field breaks them without any error here.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // expect(renderPolicyEvent(0, finding)).toBe(JSON.stringify(expected) + '\n');
//! ```

/// The renderer, its event types and the names it prints.
use super::{
    FindingEvent, FindingLocation, PolicyEvent, WARN_UNSAFE_CODE, event_blocks,
    render_policy_event, render_policy_events,
};
use crate::diagnostics::EngineFailureCode;
use crate::policy_registry::{PolicyId, Severity};
use crate::policy_trigger::Trigger;

/// A finding with only its required fields.
fn finding(severity: Severity) -> FindingEvent {
    return FindingEvent {
        trigger: Trigger::PreForward,
        policy: PolicyId::RequireRoot,
        severity,
        code: "not-at-root",
        message: String::from("Not at root"),
        path: None,
        location: None,
        fix_available: false,
    };
}

/// A finding prints the incumbent's fields in the incumbent's order, with the code prefixed by the policy name.
#[test]
fn finding_has_the_incumbent_shape() {
    assert_eq!(
        render_policy_event(0, &PolicyEvent::Finding(finding(Severity::Error))),
        "{\"schemaVersion\":1,\"sequence\":0,\"type\":\"finding\",\"trigger\":\"pre-forward\",\
         \"policyId\":\"require-root\",\"severity\":\"error\",\"code\":\"require-root/not-at-root\",\
         \"message\":\"Not at root\",\"fix\":\"none\"}\n"
    );
    let full: FindingEvent = FindingEvent {
        trigger: Trigger::DirectCheck,
        policy: PolicyId::ForbiddenStrings,
        severity: Severity::Warn,
        code: "match",
        message: String::from("found"),
        path: Some(String::from("dir/a.txt")),
        location: Some(FindingLocation {
            byte_start: 3,
            byte_end: 18_446_744_073_709_551_615,
        }),
        fix_available: true,
    };
    assert_eq!(
        render_policy_event(41, &PolicyEvent::Finding(full)),
        "{\"schemaVersion\":1,\"sequence\":41,\"type\":\"finding\",\"trigger\":\"direct-check\",\
         \"policyId\":\"security/forbidden-strings\",\"severity\":\"warn\",\
         \"code\":\"security/forbidden-strings/match\",\"message\":\"found\",\"path\":\"dir/a.txt\",\
         \"location\":{\"byteStart\":3,\"byteEnd\":18446744073709551615},\"fix\":\"available\"}\n"
    );
}

/// The unsafe-severity warning names its policy and trigger and carries the fixed code and message.
#[test]
fn warn_unsafe_has_the_incumbent_shape() {
    assert_eq!(WARN_UNSAFE_CODE, "warn-unsafe");
    assert_eq!(
        render_policy_event(
            2,
            &PolicyEvent::WarnUnsafe {
                trigger: Trigger::PreForward,
                policy: PolicyId::AddExplicit,
            }
        ),
        "{\"schemaVersion\":1,\"sequence\":2,\"type\":\"configuration-warning\",\
         \"trigger\":\"pre-forward\",\"policyId\":\"add-explicit\",\"code\":\"warn-unsafe\",\
         \"message\":\"Policy add-explicit is warn-unsafe but configured as warn.\"}\n"
    );
}

/// A fixed-transform rejection always carries the pre-forward trigger and a code prefixed by the transform.
#[test]
fn core_finding_has_the_incumbent_shape() {
    assert_eq!(
        render_policy_event(
            1,
            &PolicyEvent::CoreFinding {
                core_id: "commit-only",
                code: "all-flag",
                message: String::from("Name a path."),
            }
        ),
        "{\"schemaVersion\":1,\"sequence\":1,\"type\":\"core-finding\",\"trigger\":\"pre-forward\",\
         \"coreId\":\"commit-only\",\"code\":\"commit-only/all-flag\",\"message\":\"Name a path.\"}\n"
    );
}

/// An engine failure prints code and message, then trigger, policy and path only when present.
#[test]
fn engine_failure_prints_optional_fields_in_order() {
    assert_eq!(
        render_policy_event(
            0,
            &PolicyEvent::EngineFailure {
                code: EngineFailureCode::CoreIncomplete,
                message: String::from("transform failed"),
                trigger: None,
                policy: None,
                path: None,
            }
        ),
        "{\"schemaVersion\":1,\"sequence\":0,\"type\":\"engine-failure\",\"code\":\"core-incomplete\",\
         \"message\":\"transform failed\"}\n"
    );
    assert_eq!(
        render_policy_event(
            7,
            &PolicyEvent::EngineFailure {
                code: EngineFailureCode::ContentUnavailable,
                message: String::from("unreadable"),
                trigger: Some(Trigger::DirectFix),
                policy: Some(PolicyId::LinkedWorktreeOnly),
                path: Some(String::from("a b")),
            }
        ),
        "{\"schemaVersion\":1,\"sequence\":7,\"type\":\"engine-failure\",\"code\":\"content-unavailable\",\
         \"message\":\"unreadable\",\"trigger\":\"direct-fix\",\"policyId\":\"linked-worktree-only\",\
         \"path\":\"a b\"}\n"
    );
    // Each optional field alone, so none depends on another being present.
    for (trigger, policy, path, tail) in [
        (
            Some(Trigger::ManualPush),
            None,
            None,
            ",\"trigger\":\"manual-push\"}\n",
        ),
        (
            None,
            Some(PolicyId::FinalNewline),
            None,
            ",\"policyId\":\"final-newline\"}\n",
        ),
        (None, None, Some(String::from("p")), ",\"path\":\"p\"}\n"),
    ] {
        let rendered: String = render_policy_event(
            0,
            &PolicyEvent::EngineFailure {
                code: EngineFailureCode::FixCycle,
                message: String::from("m"),
                trigger,
                policy,
                path,
            },
        );
        assert_eq!(
            rendered,
            format!(
                "{{\"schemaVersion\":1,\"sequence\":0,\"type\":\"engine-failure\",\"code\":\"fix-cycle\",\"message\":\"m\"{tail}"
            )
        );
    }
}

/// A fix summary prints its pass count and its paths as a JSON array, empty included.
#[test]
fn fix_summary_has_the_incumbent_shape() {
    assert_eq!(
        render_policy_event(
            3,
            &PolicyEvent::FixSummary {
                trigger: Trigger::DirectFix,
                passes: 2,
                changed_paths: vec![String::from("a.txt"), String::from("dir/b \"c\".md")],
            }
        ),
        "{\"schemaVersion\":1,\"sequence\":3,\"type\":\"fix-summary\",\"trigger\":\"direct-fix\",\
         \"passes\":2,\"changedPaths\":[\"a.txt\",\"dir/b \\\"c\\\".md\"]}\n"
    );
    assert_eq!(
        render_policy_event(
            0,
            &PolicyEvent::FixSummary {
                trigger: Trigger::PreForward,
                passes: 0,
                changed_paths: Vec::<String>::new(),
            }
        ),
        "{\"schemaVersion\":1,\"sequence\":0,\"type\":\"fix-summary\",\"trigger\":\"pre-forward\",\
         \"passes\":0,\"changedPaths\":[]}\n"
    );
}

/// Text that tries to end its string or its line stays inside one JSON string on one line.
#[test]
fn hostile_text_cannot_leave_its_field() {
    let mut hostile: FindingEvent = finding(Severity::Error);
    hostile.message = String::from("a\"}\n{\"type\":\"x\"\\");
    hostile.path = Some(String::from("p\n\"q\"\u{1}"));
    let rendered: String = render_policy_event(0, &PolicyEvent::Finding(hostile));
    assert_eq!(
        rendered,
        "{\"schemaVersion\":1,\"sequence\":0,\"type\":\"finding\",\"trigger\":\"pre-forward\",\
         \"policyId\":\"require-root\",\"severity\":\"error\",\"code\":\"require-root/not-at-root\",\
         \"message\":\"a\\\"}\\n{\\\"type\\\":\\\"x\\\"\\\\\",\"path\":\"p\\n\\\"q\\\"\\u0001\",\"fix\":\"none\"}\n"
    );
    assert_eq!(rendered.matches('\n').count(), 1);
}

/// A list is numbered consecutively from its first sequence; an empty list prints nothing.
#[test]
fn lists_are_numbered_from_the_first_sequence() {
    assert_eq!(render_policy_events(5, &[]), "");
    let events: [PolicyEvent; 3] = [
        PolicyEvent::Finding(finding(Severity::Warn)),
        PolicyEvent::WarnUnsafe {
            trigger: Trigger::PreForward,
            policy: PolicyId::RequireRoot,
        },
        PolicyEvent::Finding(finding(Severity::Error)),
    ];
    let rendered: String = render_policy_events(4, &events);
    let mut lines: Vec<&str> = Vec::<&str>::new();
    for line in rendered.lines() {
        lines.push(line);
    }
    assert_eq!(lines.len(), 3);
    assert!(rendered.ends_with('\n'));
    for (index, line) in lines.iter().enumerate() {
        assert!(
            line.starts_with(format!("{{\"schemaVersion\":1,\"sequence\":{},", index + 4).as_str()),
            "{line}"
        );
        assert_eq!(
            format!("{line}\n"),
            render_policy_event(index as u64 + 4, &events[index])
        );
    }
    assert_eq!(
        render_policy_events(0, &events[..1]),
        render_policy_event(0, &events[0])
    );
}

/// Only error findings and fixed-transform rejections block the command.
#[test]
fn only_errors_and_core_findings_block() {
    assert!(event_blocks(&PolicyEvent::Finding(finding(
        Severity::Error
    ))));
    assert!(!event_blocks(&PolicyEvent::Finding(finding(
        Severity::Warn
    ))));
    assert!(event_blocks(&PolicyEvent::CoreFinding {
        core_id: "commit-only",
        code: "all-flag",
        message: String::from("m"),
    }));
    assert!(!event_blocks(&PolicyEvent::WarnUnsafe {
        trigger: Trigger::PreForward,
        policy: PolicyId::AddExplicit,
    }));
    assert!(!event_blocks(&PolicyEvent::EngineFailure {
        code: EngineFailureCode::CoreIncomplete,
        message: String::from("m"),
        trigger: None,
        policy: None,
        path: None,
    }));
    assert!(!event_blocks(&PolicyEvent::FixSummary {
        trigger: Trigger::DirectFix,
        passes: 1,
        changed_paths: Vec::<String>::new(),
    }));
}
