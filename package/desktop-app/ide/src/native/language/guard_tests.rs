//! The window's reply checks on fabricated replies: request identity and displayed text.

/// The checks under test and the request record they compare against.
use super::{
    Action, Pending,
    guard::{Verdict, verdict},
};
/// Replies and identities as the worker produces them.
use ide_app::language::{
    identity::{DocumentStamp, ServerIdentity},
    reply::{LanguageReply, RequestKind, RequestOutcome},
};

/// A hover request numbered 7 for file 3, revision 2.
fn waiting() -> Pending {
    return Pending {
        action: Action::Hover,
        stamp: DocumentStamp {
            file: 3,
            revision: 2,
        },
        position: 5,
        number: Some(7),
        outcomes: Vec::new(),
        complete: false,
    };
}

/// A reply to request `number` of `kind` about `stamp`.
fn reply(number: u64, kind: RequestKind, stamp: DocumentStamp) -> LanguageReply {
    return LanguageReply {
        request: number,
        stamp,
        server: Some(ServerIdentity {
            name: "scripted-ls".to_string(),
            instance: 1,
        }),
        kind,
        position: 5,
        remaining: 0,
        outcome: RequestOutcome::Empty,
    };
}

/// The answer to the waiting request about the displayed text is applied.
#[test]
fn reply_to_the_waiting_request_about_the_displayed_text_is_applied() {
    let pending = waiting();
    let answer = reply(7, RequestKind::Hover, pending.stamp);
    assert_eq!(verdict(&pending, pending.stamp, &answer), Verdict::Apply);
}

/// A late reply to an earlier request, or a reply of another kind, is never applied.
#[test]
fn reply_to_another_request_is_not_applied() {
    let pending = waiting();
    let earlier = reply(6, RequestKind::Hover, pending.stamp);
    assert_eq!(
        verdict(&pending, pending.stamp, &earlier),
        Verdict::OtherRequest,
        "a reply to an earlier request was applied"
    );
    let other_kind = reply(7, RequestKind::Definition, pending.stamp);
    assert_eq!(
        verdict(&pending, pending.stamp, &other_kind),
        Verdict::OtherRequest,
        "a reply of another kind was applied"
    );
    let unsent = Pending {
        number: None,
        ..waiting()
    };
    assert_eq!(
        verdict(&unsent, pending.stamp, &earlier),
        Verdict::OtherRequest,
        "a reply was applied to a request that was never sent"
    );
}

/// A reply about a revision a reload replaced, or about another file, is never applied,
/// even when the handle's fence has not caught up yet.
#[test]
fn reply_about_text_no_longer_displayed_is_not_applied() {
    let pending = waiting();
    let answer = reply(7, RequestKind::Hover, pending.stamp);
    let reloaded = DocumentStamp {
        file: 3,
        revision: 3,
    };
    assert_eq!(
        verdict(&pending, reloaded, &answer),
        Verdict::OtherText,
        "a reply for the previous revision was applied after a reload"
    );
    let switched = DocumentStamp {
        file: 4,
        revision: 0,
    };
    assert_eq!(
        verdict(&pending, switched, &answer),
        Verdict::OtherText,
        "a reply for the previous file was applied after a file switch"
    );
}
