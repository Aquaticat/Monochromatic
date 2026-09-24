//! What:     Immutable value edits: replacing a value at an address, inserting a missing leaf, and
//!           deleting a member or element.
//! Why:      Each operation returns a new document and leaves the input untouched, so a caller can keep
//!           the previous state, compare two states, or reuse one state across several edits.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // module editApply: jsoncSet(state, path, value), jsoncDelete(state, path).
//! ```

/// What:     Import the edit failure enum and its underlying causes.
/// Why:      An edit can hit a missing address or a wrong-shaped target, and both are ordinary results.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { JsoncEditError, JsoncPathNotFoundError, JsoncTypeError } from './error';
/// ```
use crate::error::{JsoncEditError, JsoncPathNotFoundError, JsoncTypeError};
/// What:     Import the address resolution helpers.
/// Why:      Edits walk addresses with the same last-duplicate rules reads use.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { findEntryIndex, keyUnits } from './navigate';
/// ```
use crate::navigate::find_entry_index;
/// What:     Import the address segment type.
/// Why:      A segment decides whether the step names a member or an element.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import type { JsoncPathSegment } from './path';
/// ```
use crate::path::JsoncPathSegment;
/// What:     Import the document model types an edit rebuilds.
/// Why:      Rebuilding copies the untouched parts and replaces only the addressed value.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { JsoncEntry, JsoncKey, JsoncKind, JsoncValue } from './value';
/// ```
use crate::value::{JsoncEntry, JsoncKey, JsoncKind, JsoncValue};

/// What:     Build the missing-address failure for one path.
/// Why:      Every absent-address branch reports the same address the caller supplied.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function notFound(path: JsoncPathSegment[]): JsoncEditError;
/// ```
fn not_found(path: &[JsoncPathSegment]) -> JsoncEditError {
    return JsoncEditError::PathNotFound {
        error: JsoncPathNotFoundError { path: Vec::from(path) },
    };
}

/// What:     Build the wrong-shape failure for one message.
/// Why:      Indexing a scalar, or an object with a position, is a caller mistake worth naming.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function typeError(message: string): JsoncEditError;
/// ```
fn type_error(message: String) -> JsoncEditError {
    return JsoncEditError::Type { error: JsoncTypeError { message } };
}

/// What:     Apply one transformation to the value an address names, rebuilding only its ancestors.
/// Why:      Comment edits and value replacement share this walk, and keeping it in one place means the
///           duplicate-key and bounds rules cannot drift between operations.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function transformAtPath(node: JsoncValue, path: JsoncPathSegment[], transform: (node: JsoncValue) => JsoncValue): JsoncValue;
/// ```
///
/// # Errors
/// Returns the missing address, or a shape failure when a step does not fit its target.
pub(crate) fn transform_at_path(
    node: &JsoncValue,
    path: &[JsoncPathSegment],
    full_path: &[JsoncPathSegment],
    transform: &mut impl FnMut(&JsoncValue) -> JsoncValue,
) -> Result<JsoncValue, JsoncEditError> {
    if path.is_empty() {
        return Ok(transform(node));
    }
    // What:     Splitting the slice names this step and the remaining address without copying either.
    // Why:      The rebuild recurses on the remaining address only.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const [segment, ...rest] = path;
    // ```
    let (segment, rest) = path.split_first().expect("non-empty path has a first segment");
    return match (&node.kind, segment) {
        (JsoncKind::Record { entries }, JsoncPathSegment::Key { key }) => {
            let index = find_entry_index(entries, key).ok_or_else(|| return not_found(full_path))?;
            let mut rebuilt: Vec<JsoncEntry> = Vec::with_capacity(entries.len());
            for (position, entry) in entries.iter().enumerate() {
                if position == index {
                    let value = transform_at_path(&entry.value, rest, full_path, transform)?;
                    rebuilt.push(JsoncEntry { key: entry.key.clone(), value });
                } else {
                    rebuilt.push(entry.clone());
                }
            }
            return Ok(JsoncValue { kind: JsoncKind::Record { entries: rebuilt }, comment: node.comment.clone() });
        }
        (JsoncKind::Array { elements }, JsoncPathSegment::Index { index }) => {
            let position = *index;
            if position >= elements.len() {
                return Err(not_found(full_path));
            }
            let mut rebuilt: Vec<JsoncValue> = Vec::with_capacity(elements.len());
            for (offset, element) in elements.iter().enumerate() {
                if offset == position {
                    rebuilt.push(transform_at_path(element, rest, full_path, transform)?);
                } else {
                    rebuilt.push(element.clone());
                }
            }
            return Ok(JsoncValue { kind: JsoncKind::Array { elements: rebuilt }, comment: node.comment.clone() });
        }
        (JsoncKind::Record { .. }, JsoncPathSegment::Index { index }) => Err(type_error(format!(
            "jsonc edit: cannot index an object with position {index}"
        ))),
        (JsoncKind::Array { .. }, JsoncPathSegment::Key { key }) => Err(type_error(format!(
            "jsonc edit: cannot index an array with key {key:?}"
        ))),
        _ => Err(type_error(String::from("jsonc edit: cannot index a scalar value"))),
    };
}

/// What:     Return a new document with one address set to a replacement value.
/// Why:      Setting is the common edit, and it must create a missing leaf under the deepest existing
///           parent while preserving the addressed value's comment.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function jsoncSet(state: JsoncEditState, path: JsoncPathSegment[], value: JsoncValue): JsoncEditState;
/// ```
///
/// # Errors
/// Returns the missing address when an intermediate step does not exist, or a shape failure when a step
/// does not fit its target.
pub fn jsonc_set(
    root: &JsoncValue,
    path: &[JsoncPathSegment],
    value: JsoncValue,
) -> Result<JsoncValue, JsoncEditError> {
    if path.is_empty() {
        // What:     Setting the whole document keeps the root's own comment.
        // Why:      A caller replacing the root did not ask to drop the document comment.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { ...value, comment: root.comment };
        // ```
        return Ok(JsoncValue { kind: value.kind, comment: root.comment.clone() });
    }
    return set_at_path(root, path, path, &value);
}

/// What:     Rebuild one node with the addressed child replaced, inserted where the grammar allows.
/// Why:      Insertion is only legal for a missing final segment, so a missing intermediate step stays an
///           error instead of inventing structure the caller did not describe.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function setAtPath(node: JsoncValue, path: JsoncPathSegment[], index: number, newNode: JsoncValue): JsoncValue;
/// ```
///
/// # Errors
/// Returns the missing address, or a shape failure when a step does not fit its target.
fn set_at_path(
    node: &JsoncValue,
    path: &[JsoncPathSegment],
    full_path: &[JsoncPathSegment],
    new_value: &JsoncValue,
) -> Result<JsoncValue, JsoncEditError> {
    let (segment, rest) = path.split_first().expect("caller guarantees a non-empty path");
    return match (&node.kind, segment) {
        (JsoncKind::Record { entries }, JsoncPathSegment::Key { key }) => {
            let mut rebuilt: Vec<JsoncEntry> = Vec::with_capacity(entries.len() + 1);
            match find_entry_index(entries, key) {
                Some(index) => {
                    for (position, entry) in entries.iter().enumerate() {
                        if position == index {
                            let value = set_at_path(&entry.value, rest, full_path, new_value)?;
                            rebuilt.push(JsoncEntry { key: entry.key.clone(), value });
                        } else {
                            rebuilt.push(entry.clone());
                        }
                    }
                }
                None => {
                    if !rest.is_empty() {
                        return Err(not_found(full_path));
                    }
                    for entry in entries {
                        rebuilt.push(entry.clone());
                    }
                    rebuilt.push(JsoncEntry {
                        key: JsoncKey::from_text(key),
                        value: new_value.clone(),
                    });
                }
            }
            return Ok(JsoncValue {
                kind: JsoncKind::Record { entries: rebuilt },
                comment: node.comment.clone(),
            });
        }
        (JsoncKind::Array { elements }, JsoncPathSegment::Index { index }) => {
            let position = *index;
            let mut rebuilt: Vec<JsoncValue> = Vec::with_capacity(elements.len() + 1);
            if position < elements.len() {
                for (offset, element) in elements.iter().enumerate() {
                    if offset == position {
                        rebuilt.push(set_at_path(element, rest, full_path, new_value)?);
                    } else {
                        rebuilt.push(element.clone());
                    }
                }
            } else if position == elements.len() && rest.is_empty() {
                for element in elements {
                    rebuilt.push(element.clone());
                }
                rebuilt.push(new_value.clone());
            } else {
                return Err(not_found(full_path));
            }
            return Ok(JsoncValue {
                kind: JsoncKind::Array { elements: rebuilt },
                comment: node.comment.clone(),
            });
        }
        (JsoncKind::Record { .. }, JsoncPathSegment::Index { index }) => Err(type_error(format!(
            "jsonc set: cannot index an object with position {index}"
        ))),
        (JsoncKind::Array { .. }, JsoncPathSegment::Key { key }) => Err(type_error(format!(
            "jsonc set: cannot index an array with key {key:?}"
        ))),
        _ => Err(type_error(String::from("jsonc set: cannot index a scalar value"))),
    };
}

/// What:     Return a new document with one addressed member or element removed.
/// Why:      Deletion is the other structural edit, and removing a duplicate key removes every member
///           with that name, matching the maintained TypeScript behavior.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function jsoncDelete(state: JsoncEditState, path: JsoncPathSegment[]): JsoncEditState;
/// ```
///
/// # Errors
/// Returns a shape failure for an empty address or a step that does not fit its target, and the missing
/// address when an intermediate step does not exist.
pub fn jsonc_delete(root: &JsoncValue, path: &[JsoncPathSegment]) -> Result<JsoncValue, JsoncEditError> {
    if path.is_empty() {
        return Err(type_error(String::from("jsonc delete: cannot delete the document root")));
    }
    return delete_at_path(root, path, path);
}

/// What:     Rebuild one node without the addressed child.
/// Why:      The final segment removes a member or element, while an earlier segment only narrows the
///           address, so the two cases need different checks.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function deleteAtPath(node: JsoncValue, path: JsoncPathSegment[], index: number): JsoncValue;
/// ```
///
/// # Errors
/// Returns the missing address, or a shape failure when a step does not fit its target.
fn delete_at_path(
    node: &JsoncValue,
    path: &[JsoncPathSegment],
    full_path: &[JsoncPathSegment],
) -> Result<JsoncValue, JsoncEditError> {
    let (segment, rest) = path.split_first().expect("caller guarantees a non-empty path");
    let is_last = rest.is_empty();
    return match (&node.kind, segment) {
        (JsoncKind::Record { entries }, JsoncPathSegment::Key { key }) => {
            let mut rebuilt: Vec<JsoncEntry> = Vec::with_capacity(entries.len());
            if is_last {
                let wanted = crate::navigate::key_units(key);
                for entry in entries {
                    if entry.key.units != wanted {
                        rebuilt.push(entry.clone());
                    }
                }
            } else {
                let index = find_entry_index(entries, key).ok_or_else(|| return not_found(full_path))?;
                for (position, entry) in entries.iter().enumerate() {
                    if position == index {
                        let value = delete_at_path(&entry.value, rest, full_path)?;
                        rebuilt.push(JsoncEntry { key: entry.key.clone(), value });
                    } else {
                        rebuilt.push(entry.clone());
                    }
                }
            }
            return Ok(JsoncValue {
                kind: JsoncKind::Record { entries: rebuilt },
                comment: node.comment.clone(),
            });
        }
        (JsoncKind::Array { elements }, JsoncPathSegment::Index { index }) => {
            let position = *index;
            if position >= elements.len() {
                return Err(not_found(full_path));
            }
            let mut rebuilt: Vec<JsoncValue> = Vec::with_capacity(elements.len());
            for (offset, element) in elements.iter().enumerate() {
                if is_last && offset == position {
                    continue;
                }
                if offset == position {
                    rebuilt.push(delete_at_path(element, rest, full_path)?);
                } else {
                    rebuilt.push(element.clone());
                }
            }
            return Ok(JsoncValue {
                kind: JsoncKind::Array { elements: rebuilt },
                comment: node.comment.clone(),
            });
        }
        (JsoncKind::Record { .. }, JsoncPathSegment::Index { index }) => Err(type_error(format!(
            "jsonc delete: cannot index an object with position {index}"
        ))),
        (JsoncKind::Array { .. }, JsoncPathSegment::Key { key }) => Err(type_error(format!(
            "jsonc delete: cannot index an array with key {key:?}"
        ))),
        _ => Err(type_error(String::from("jsonc delete: cannot index a scalar value"))),
    };
}
