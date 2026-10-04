//! What: Disposable Cargo-backed semantic fixtures for the explicit-type rule.
//! Why: Real resolution, source overlays and database attachment must be exercised together.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // Own one temporary project; replace its in-memory source between semantic assertions.
//! ```

/// Import real rule findings and the actual semantic checker.
use crate::diagnostic::{Diagnostic, Severity};
/// Use the production session for membership, source-overlay and query-scope handling.
use crate::rust_semantic_session::RustSemanticSession;
/// Import exclusively owned temporary-directory cleanup.
use crate::test_fs::Fixture;
/// Import the database and loader owners supplied to the production session.
use ra_ap_ide_db::RootDatabase;
use ra_ap_load_cargo::{LoadCargoConfig, ProcMacroServerChoice, load_workspace_at};
use ra_ap_proc_macro_api::ProcMacroClient;
/// Import explicit standard-library paths instead of permitting automatic installation.
use ra_ap_project_model::{CargoConfig, RustLibSource};
use ra_ap_vfs::{AbsPathBuf, Vfs};
/// Import owned native paths and compiler-query output.
use std::path::PathBuf;
use std::process::{Command, Output};

/// Read loader progress as captured test diagnostics, not as production lint output.
fn progress(message: String) {
    eprintln!("semantic fixture: {message}");
}

/// Discover only an already installed standard-library source tree, never auto-install on the host.
fn cargo_configuration() -> CargoConfig {
    let output: Output = Command::new("rustc")
        .args(["--print", "sysroot"])
        .output()
        .expect("query fixture compiler sysroot");
    assert!(output.status.success(), "compiler sysroot query failed");
    let text: String = String::from_utf8(output.stdout).expect("compiler sysroot is UTF-8");
    let sysroot: AbsPathBuf = AbsPathBuf::try_from(text.trim()).expect("absolute compiler sysroot");
    let library: AbsPathBuf = sysroot.join("lib/rustlib/src/rust/library");
    let core: AbsPathBuf = library.join("core/src/lib.rs");
    // AbsPath deliberately disables filesystem methods; use the standard filesystem boundary explicitly.
    let metadata: std::fs::Metadata = std::fs::metadata(&core)
        .expect("semantic fixtures require the matching rust-src component; use the prepared container task");
    assert!(
        metadata.is_file(),
        "rust-src core entry must be a regular file"
    );
    return CargoConfig {
        sysroot: Some(RustLibSource::Path(sysroot)),
        sysroot_src: Some(library),
        metadata_extra_args: vec![String::from("--offline")],
        ..CargoConfig::default()
    };
}

/// What: Own a temporary project and one reusable semantic database.
/// Why: Alternating valid and invalid source in the same file tests cache invalidation as well as rule behavior.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class SemanticFixture { check(source: string, severity: Severity): Diagnostic[]; }
/// ```
pub(crate) struct SemanticFixture {
    /// Production workspace session, dropped before the physical fixture.
    pub(crate) session: RustSemanticSession,
    /// Real file whose bytes are replaced in memory, never on disk.
    pub(crate) source_path: PathBuf,
    /// Keep the physical fixture alive until the database is no longer needed.
    _directory: Fixture,
}

/// Create and query the disposable semantic consumer.
impl SemanticFixture {
    /// Load an owned dependency-free fixture with explicit standard-library source and no project-code execution.
    pub(crate) fn new() -> SemanticFixture {
        let directory: Fixture = Fixture::new();
        let source_directory: PathBuf = directory.path.join("src");
        std::fs::create_dir(&source_directory).expect("create fixture source directory");
        std::fs::write(directory.path.join("Cargo.toml"), "[package]\nname = \"semantic-fixture\"\nversion = \"0.0.0\"\nedition = \"2024\"\n[workspace]\nmembers = [\".\"]\n").expect("write fixture manifest");
        let source_path: PathBuf = source_directory.join("main.rs");
        std::fs::write(&source_path, "fn main() {}\n").expect("write initial fixture source");
        let cargo: CargoConfig = cargo_configuration();
        let loading: LoadCargoConfig = LoadCargoConfig {
            load_out_dirs_from_check: false,
            with_proc_macro_server: ProcMacroServerChoice::None,
            prefill_caches: false,
            num_worker_threads: 1,
            proc_macro_processes: 1,
        };
        let (database, files, macro_server): (RootDatabase, Vfs, Option<ProcMacroClient>) =
            load_workspace_at(&directory.path, &cargo, &loading, &progress).expect("load fixture");
        assert!(macro_server.is_none());
        let session: RustSemanticSession = RustSemanticSession::from_workspace(database, files, macro_server);
        return SemanticFixture {
            session,
            source_path,
            _directory: directory,
        };
    }

    /// Replace exact source bytes before querying; returned findings cannot borrow the database.
    pub(crate) fn check(&mut self, source: &str, severity: Severity) -> Vec<Diagnostic> {
        return self.session.check_file(&self.source_path, source, "input.rs", severity).expect("check fixture snapshot");
    }
}
