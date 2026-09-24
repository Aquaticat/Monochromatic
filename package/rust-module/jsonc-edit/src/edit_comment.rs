//! What:     The comment-as-data surface: reading and replacing the comment attached to a value or to an
//!           object key.
//! Why:      Comments are queryable and editable in this crate rather than merely preserved, and a key's
//!           comment is separate from the comment on the value it introduces.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // module editComment: jsoncComment(root, path), jsoncSetComment(root, path, comment), and the key pair.
//! ```

/// What:     Import the immutable rebuild walk used by comment edits.
/// Why:      A comment edit changes one node and copies its ancestors, exactly like a value edit.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { transformAtPath } from './editApply';
/// ```
use crate::edit_apply::transform_at_path;
/// What:     Import the edit failure enum and its underlying causes.
/// Why:      Comment queries report a missing address, and key queries report an unusable address shape.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { JsoncEditError, JsoncPathNotFoundError, JsoncTypeError } from './error';
/// ```
use crate::error::{JsoncEditError, JsoncPathNotFoundError, JsoncTypeError};
/// What:     Import address resolution and the member lookup helper.
/// Why:      A key comment lives on the parent record's member, not on the addressed value.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { findEntryIndex, resolve } from './navigate';
/// ```
use crate::navigate::{find_entry_index, resolve};
/// What:     Import the address segment type.
/// Why:      Only a key segment can name a member whose key comment is queried.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import type { JsoncPathSegment } from './path';
/// ```
use crate::path::JsoncPathSegment;
/// What:     Import the comment and document types this surface reads and rebuilds.
/// Why:      A replaced comment keeps the node's payload and its other comment slot untouched.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { JsoncComment, JsoncEntry, JsoncKey, JsoncKind, JsoncValue } from './value';
/// ```
use crate::value::{JsoncComment, JsoncEntry, JsoncKey, JsoncKind, JsoncValue};

/// What:     Split one address into its parent address and its final key name.
/// Why:      Key-comment operations address a member of the parent record, so both parts are needed and
///           an empty or index-final address must be rejected before any walk happens.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function splitKeyPath(path: JsoncPathSegment[]): [JsoncPathSegment[], string];
/// ```
///
/// # Errors
/// Returns a shape failure when the address is empty or ends in an array index.
fn split_key_path(path: &[JsoncPathSegment]) -> Result<(&[JsoncPathSegment], &str), JsoncEditError> {
    let (last, parent) = path.split_last().ok_or_else(|| {
        return JsoncEditError::Type {
            error: JsoncTypeError { message: String::from("jsonc key comment: empty path has no key") },
        };
    })?;
    let JsoncPathSegment::Key { key } = last else {
        return Err(JsoncEditError::Type {
            error: JsoncTypeError {
                message: String::from("jsonc key comment: final segment is not a key"),
            },
        });
    };
    return Ok((parent, key.as_str()));
}

/// What:     Read the comment attached to one addressed value.
/// Why:      Querying is half of comment-as-data, and absence is a distinct answer from an empty comment.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function jsoncComment(state: JsoncEditState, path: JsoncPathSegment[]): JsoncComment | undefined;
/// ```
///
/// # Errors
/// Returns the missing address, or a shape failure when a step does not fit its target.
pub fn jsonc_comment<'a>(
    root: &'a JsoncValue,
    path: &[JsoncPathSegment],
) -> Result<Option<&'a JsoncComment>, JsoncEditError> {
    let target = resolve(root, path)?;
    return Ok(target.comment.as_ref());
}

/// What:     Return a new document whose addressed value carries the given comment.
/// Why:      Comment edits are immutable like every other edit, and passing absence clears the comment.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function jsoncSetComment(state, path, comment): JsoncEditState;
/// ```
///
/// # Errors
/// Returns the missing address, or a shape failure when a step does not fit its target.
pub fn jsonc_set_comment(
    root: &JsoncValue,
    path: &[JsoncPathSegment],
    comment: Option<JsoncComment>,
) -> Result<JsoncValue, JsoncEditError> {
    return transform_at_path(root, path, path, &mut |target| {
        return JsoncValue { kind: target.kind.clone(), comment: comment.clone() };
    });
}

/// What:     Read the comment attached to one addressed object key.
/// Why:      A key's comment documents the member name, and the maintained package keeps it separate from
///           the value's comment.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function jsoncKeyComment(state, path): JsoncComment | undefined;
/// ```
///
/// # Errors
/// Returns a shape failure for an empty or index-final address or a non-record parent, and the missing
/// address when the parent or member does not exist.
pub fn jsonc_key_comment<'a>(
    root: &'a JsoncValue,
    path: &[JsoncPathSegment],
) -> Result<Option<&'a JsoncComment>, JsoncEditError> {
    let (parent_path, key) = split_key_path(path)?;
    let parent = resolve(root, parent_path)?;
    let JsoncKind::Record { entries } = &parent.kind else {
        return Err(JsoncEditError::PathNotFound {
            error: JsoncPathNotFoundError { path: Vec::from(path) },
        });
    };
    let index = find_entry_index(entries, key).ok_or_else(|| {
        return JsoncEditError::PathNotFound {
            error: JsoncPathNotFoundError { path: Vec::from(path) },
        };
    })?;
    let entry = entries.get(index).ok_or_else(|| {
        return JsoncEditError::PathNotFound {
            error: JsoncPathNotFoundError { path: Vec::from(path) },
        };
    })?;
    return Ok(entry.key.comment.as_ref());
}

/// What:     Return a new document whose addressed key carries the given comment.
/// Why:      Editing a key comment must not disturb the value it introduces or the value's own comment.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function jsoncSetKeyComment(state, path, comment): JsoncEditState;
/// ```
///
/// # Errors
/// Returns a shape failure for an empty or index-final address, and the missing address when the parent
/// is not a record or the member does not exist.
pub fn jsonc_set_key_comment(
    root: &JsoncValue,
    path: &[JsoncPathSegment],
    comment: Option<JsoncComment>,
) -> Result<JsoncValue, JsoncEditError> {
    let (parent_path, key) = split_key_path(path)?;
    // What:     Validate the parent shape and the member's existence before rebuilding anything.
    // Why:      The rebuild closure cannot report a failure, so both rejections must happen here to match
    //           the maintained package's missing-address behavior.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const parent = findNode(root, parentPath);
    // if (parent?.kind !== 'record') throw new JsoncPathNotFoundError({ path });
    // ```
    let parent = resolve(root, parent_path)?;
    let JsoncKind::Record { entries } = &parent.kind else {
        return Err(JsoncEditError::PathNotFound {
            error: JsoncPathNotFoundError { path: Vec::from(path) },
        });
    };
    let validated = find_entry_index(entries, key).ok_or_else(|| {
        return JsoncEditError::PathNotFound {
            error: JsoncPathNotFoundError { path: Vec::from(path) },
        };
    })?;
    // The validated position is only a precondition for the rebuild below, which looks the member up again.
    debug_assert!(validated < entries.len());
    return transform_at_path(root, parent_path, path, &mut |target| {
        let JsoncKind::Record { entries } = &target.kind else {
            // What:     This arm is unreachable after the validation above.
            // Why:      Keeping it total avoids a panic path while the closure stays infallible.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (parent.kind !== 'record') return parent; // already rejected above
            // ```
            return target.clone();
        };
        let index = match find_entry_index(entries, key) {
            Some(found) => found,
            None => return target.clone(),
        };
        let mut rebuilt: Vec<JsoncEntry> = Vec::with_capacity(entries.len());
        for (position, entry) in entries.iter().enumerate() {
            if position == index {
                rebuilt.push(JsoncEntry {
                    key: JsoncKey { comment: comment.clone(), ..entry.key.clone() },
                    value: entry.value.clone(),
                });
            } else {
                rebuilt.push(entry.clone());
            }
        }
        return JsoncValue {
            kind: JsoncKind::Record { entries: rebuilt },
            comment: target.comment.clone(),
        };
    });
}
