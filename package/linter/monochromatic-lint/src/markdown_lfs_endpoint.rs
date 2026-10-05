//! What: The one place an LFS endpoint becomes a credential-free object base URL.
//! Why: The rule recognizes existing object URLs by an exact string prefix of this base and builds
//! new ones by literal concatenation, so a changed serialization changes both findings and fixes.
//! Every caller goes through `lfs_object_base`; nothing else parses or rewrites an endpoint.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // const url = new URL(endpoint); url.username = url.password = url.search = url.hash = '';
//! // return url.href.endsWith('/') ? url.href.slice(0, -1) : url.href;
//! ```

/// What: A refused endpoint normalization, with the affected value's explanation.
/// Why: The incumbent throws on a malformed endpoint; the native rule must not treat that as "no LFS here".
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class LfsEndpointError extends Error {}
/// ```
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LfsEndpointError {
    /// Why this endpoint has no object base.
    pub message: String,
}

/// Render the refusal through the ordinary error interface.
impl std::fmt::Display for LfsEndpointError {
    /// Borrow the formatter only while writing the stored explanation.
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        return formatter.write_str(self.message.as_str());
    }
}

/// Mark the refusal as a standard error for application error handling.
impl std::error::Error for LfsEndpointError {}

/// What: Turn an `lfs.url` or `remote.<name>.lfsurl` value into the base that object URLs start with.
/// Why: The consumed contract is the incumbent `lfsObjectBase`: parse without a base URL, clear
/// username, password, query and fragment, serialize, then remove exactly one final slash.
/// The parser that owns those URL semantics is selected in
/// `doc/planning/native-lfs-url-normalization-evaluation.md` (section `Selected owner`) and measured by
/// `fixtures/lfs-url-parity.json`. Neither existed when this function was written, so it refuses
/// every endpoint: a repository with a declared LFS endpoint then gets a processing failure from
/// this rule instead of an unverified rewrite or a clean result.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function lfsObjectBase(endpoint: string): string; // throws on a malformed endpoint
/// ```
pub fn lfs_object_base(endpoint: &str) -> Result<String, LfsEndpointError> {
    return Err(LfsEndpointError {
        message: format!(
            "LFS endpoint {endpoint:?} cannot be normalized: this build has no selected URL normalizer. markdown/lfs-image-url cannot check files in this repository until one is implemented; configure the rule off for these files to lint the remaining rules."
        ),
    });
}

/// Contract controls stay outside release artifacts.
#[cfg(test)]
#[path = "markdown_lfs_endpoint_tests.rs"]
mod tests;
