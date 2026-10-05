//! Headless language intelligence: definitions, references, hover, inlay hints, and diagnostics
//! for the displayed file, through Helix's language-server client, with no project-file writes.

/// Displayed-text and server-process identities carried by every result.
pub mod identity;

/// Character offsets and server positions are converted in exactly one place.
pub mod position;

/// Server-returned locations are validated before anything is read or opened.
pub mod target;

/// Position requests and their one-shot replies.
pub mod reply;

/// Latest-value server and document states.
pub mod status;

/// Results for another file, revision, or server process are dropped when they are read.
pub mod fence;

/// Pushed and pulled diagnostics with version checks and the unversioned freshness hold.
pub mod diagnostics;

/// Inlay request ranges and label shaping.
pub mod hints;

/// Replies to requests that servers send to the client; every edit is refused.
pub mod incoming;
