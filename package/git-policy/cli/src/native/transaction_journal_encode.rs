//! What: The exact encoding of every schema-version-2 journal record: compact JSON in the
//!       incumbent's field order, one record per line.
//! Why: `writeJournalRecord` writes `JSON.stringify(record)` and a newline; the native wrapper
//!      writes the same bytes for the same values so either wrapper can recover the other's
//!      transactions.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! `${JSON.stringify(record)}\n`
//! ```

/// The ordered writer and array encoding.
use super::json_record::{ObjectWriter, string_array};
/// The record types and their wire names.
use super::transaction_journal::{
    AddedPath, Base, Conclusion, FileIdentity, IndexLockRecord, JOURNAL_SCHEMA_VERSION,
    LandingOperation, LandingRecord, LockIdentity, PreparedRecord, PreparingRecord, RefFormat,
    SymbolicHead, TransactionMode,
};

/// What: Encode a base as its tagged object.
/// Why:  Shared by `preparing.json` and `landing-<n>.json`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// JSON.stringify(base)
/// ```
fn encode_base(base: &Base) -> String {
    let mut writer: ObjectWriter = ObjectWriter::new();
    match base {
        Base::Unborn => {
            writer.string("kind", "unborn");
        }
        Base::Commit(oid) => {
            writer.string("kind", "commit").string("oid", oid.as_str());
        }
    }
    return writer.finish();
}

/// What: Encode a file identity.
/// Why:  Shared by landing artifacts and locks.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// JSON.stringify({ device, inode })
/// ```
fn encode_identity(identity: &FileIdentity) -> String {
    let mut writer: ObjectWriter = ObjectWriter::new();
    writer
        .string("device", identity.device.as_str())
        .string("inode", identity.inode.as_str());
    return writer.finish();
}

/// What: Encode a lock identity.
/// Why:  Shared by `index-lock-<n>.json` and `landing-<n>.json`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// JSON.stringify({ device, inode, fsId })
/// ```
fn encode_lock(lock: &LockIdentity) -> String {
    let mut writer: ObjectWriter = ObjectWriter::new();
    writer
        .string("device", lock.file.device.as_str())
        .string("inode", lock.file.inode.as_str())
        .string("fsId", lock.fs_id.as_str());
    return writer.finish();
}

/// What: Encode a list of added-path records.
/// Why:  Shared by `prepared.json` and `landing-<n>.json`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// JSON.stringify(records)
/// ```
fn encode_added_paths(records: &[AddedPath]) -> String {
    let mut text: String = String::from("[");
    for (index, record) in records.iter().enumerate() {
        if index > 0 {
            text.push(',');
        }
        let mut writer: ObjectWriter = ObjectWriter::new();
        writer
            .string("path", record.path.as_str())
            .string("gitMode", record.git_mode.as_str())
            .string("originalOid", record.original_oid.as_str())
            .string("intendedOid", record.intended_oid.as_str());
        text.push_str(writer.finish().as_str());
    }
    text.push(']');
    return text;
}

/// What: The common head of every record: schema version and state discriminator.
/// Why:  Every record starts with the same two fields.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// { schemaVersion: 2, state }
/// ```
fn record_head(state: &str) -> ObjectWriter {
    let mut writer: ObjectWriter = ObjectWriter::new();
    writer
        .integer("schemaVersion", JOURNAL_SCHEMA_VERSION)
        .string("state", state);
    return writer;
}

/// What: The wire spelling of a mode.
/// Why:  Shared by encoding and its tests.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// mode
/// ```
pub fn mode_name(mode: TransactionMode) -> &'static str {
    match mode {
        TransactionMode::ExplicitPath => return "explicit-path",
        TransactionMode::Index => return "index",
    }
}

/// What: The wire spelling of a conclusion kind.
/// Why:  Shared by encoding and its tests.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// conclusion
/// ```
pub fn conclusion_name(conclusion: Conclusion) -> &'static str {
    match conclusion {
        Conclusion::None => return "none",
        Conclusion::Amend => return "amend",
        Conclusion::Merge => return "merge",
        Conclusion::CherryPick => return "cherry-pick",
        Conclusion::Revert => return "revert",
    }
}

/// What: The wire spelling of a ref format.
/// Why:  Shared by encoding and its tests.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// refFormat
/// ```
pub fn ref_format_name(format: RefFormat) -> &'static str {
    match format {
        RefFormat::Files => return "files",
        RefFormat::Reftable => return "reftable",
    }
}

/// What: Encode `preparing.json` with its trailing newline.
/// Why:  `writeJournalRecord` writes `JSON.stringify(record)` and a newline.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// `${JSON.stringify(preparing)}\n`
/// ```
pub fn encode_preparing(record: &PreparingRecord) -> String {
    let mut writer: ObjectWriter = record_head("preparing");
    writer
        .string("transactionId", record.transaction_id.as_str())
        .string("mode", mode_name(record.mode))
        .raw("base", encode_base(&record.base).as_str());
    let head: String = match &record.symbolic_head {
        SymbolicHead::Branch(name) => {
            let mut nested: ObjectWriter = ObjectWriter::new();
            nested.string("kind", "branch").string("ref", name.as_str());
            nested.finish()
        }
        SymbolicHead::Detached => String::from("{\"kind\":\"detached\"}"),
    };
    writer
        .raw("symbolicHead", head.as_str())
        .string("targetRef", record.target_ref.as_str())
        .string("conclusion", conclusion_name(record.conclusion))
        .string("repositoryRoot", record.repository_root.as_str())
        .string("gitDir", record.git_dir.as_str())
        .string("commonDir", record.common_dir.as_str())
        .string("realIndexPath", record.real_index_path.as_str())
        .string("objectDirectory", record.object_directory.as_str())
        .string("refFormat", ref_format_name(record.ref_format))
        .string("emptyTreeOid", record.empty_tree_oid.as_str())
        .string("shadowPath", record.shadow_path.as_str())
        .raw(
            "selectedPathspecs",
            string_array(record.selected_pathspecs.as_slice()).as_str(),
        )
        .string("invokedAt", record.invoked_at.as_str());
    return format!("{}\n", writer.finish());
}

/// What: Encode `prepared.json` with its trailing newline.
/// Why:  See `encode_preparing`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// `${JSON.stringify(prepared)}\n`
/// ```
pub fn encode_prepared(record: &PreparedRecord) -> String {
    let mut writer: ObjectWriter = record_head("prepared");
    writer
        .string("shadowPath", record.shadow_path.as_str())
        .string("preparedOid", record.prepared_oid.as_str())
        .boolean("signed", record.signed)
        .string("intendedTreeOid", record.intended_tree_oid.as_str())
        .raw(
            "committedPaths",
            string_array(record.committed_paths.as_slice()).as_str(),
        )
        .raw(
            "addedPaths",
            encode_added_paths(record.added_paths.as_slice()).as_str(),
        )
        .raw(
            "selectedWorktreePaths",
            encode_added_paths(record.selected_worktree_paths.as_slice()).as_str(),
        );
    return format!("{}\n", writer.finish());
}

/// What: Encode `index-lock-<n>.json` with its trailing newline.
/// Why:  See `encode_preparing`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// `${JSON.stringify(indexLock)}\n`
/// ```
pub fn encode_index_lock(record: &IndexLockRecord) -> String {
    let mut writer: ObjectWriter = record_head("index-locked");
    writer
        .integer("attempt", record.attempt)
        .raw("lock", encode_lock(&record.lock).as_str());
    return format!("{}\n", writer.finish());
}

/// What: Encode `landing-<n>.json` with its trailing newline; optional fields are omitted when
///       absent, as `JSON.stringify` omits `undefined`.
/// Why:  See `encode_preparing`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// `${JSON.stringify(landing)}\n`
/// ```
pub fn encode_landing(record: &LandingRecord) -> String {
    let mut writer: ObjectWriter = record_head("landing");
    writer.integer("attempt", record.attempt).string(
        "operation",
        match record.operation {
            LandingOperation::Commit => "commit",
            LandingOperation::NormalizeOnly => "normalize-only",
        },
    );
    writer.raw("expectedOld", encode_base(&record.expected_old).as_str());
    if let Some(oid) = &record.new_oid {
        writer.string("newOid", oid.as_str());
    }
    writer
        .string("landedTreeOid", record.landed_tree_oid.as_str())
        .raw(
            "preLandingIndex",
            encode_identity(&record.pre_landing_index).as_str(),
        )
        .raw("postIndex", encode_identity(&record.post_index).as_str())
        .raw("lock", encode_lock(&record.lock).as_str());
    if let Some(pack) = &record.pack_name {
        writer.string("packName", pack.as_str());
    }
    writer
        .raw(
            "addedPaths",
            encode_added_paths(record.added_paths.as_slice()).as_str(),
        )
        .raw(
            "selectedWorktreePaths",
            encode_added_paths(record.selected_worktree_paths.as_slice()).as_str(),
        );
    return format!("{}\n", writer.finish());
}

/// What: Encode `ref-updated.json` with its trailing newline.
/// Why:  See `encode_preparing`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// `${JSON.stringify({ schemaVersion: 2, state: 'ref-updated', landedOid })}\n`
/// ```
pub fn encode_ref_updated(landed_oid: &str) -> String {
    let mut writer: ObjectWriter = record_head("ref-updated");
    writer.string("landedOid", landed_oid);
    return format!("{}\n", writer.finish());
}

/// Encoding controls stay out of the release executable.
#[cfg(test)]
#[path = "transaction_journal_encode_tests.rs"]
pub(crate) mod tests;
