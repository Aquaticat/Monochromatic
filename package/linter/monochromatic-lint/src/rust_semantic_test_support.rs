//! What: Disposable Cargo-backed semantic fixtures for the explicit-type rule.
//! Why: Real resolution, source overlays and database attachment must be exercised together.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // Own one temporary project; replace its in-memory source between semantic assertions.
//! ```

/// Import real rule findings and the actual semantic checker.
use crate::diagnostic::{Diagnostic, Severity};
/// Import the full rule, not a copied detector.
use crate::rust_explicit_types::check_explicit_types;
/// Import the registered-tree source wrapper.
use crate::rust_source::RustSource;
/// Import exclusively owned temporary-directory cleanup.
use crate::test_fs::Fixture;
/// Import database attachment and tracked text changes from the same backend release.
use ra_ap_hir::{ChangeWithProcMacros, Semantics, attach_db};
/// Import the database trait and its named scoped accessor.
use ra_ap_hir_ty::{db::HirDatabase, with_attached_db};
/// Import the database's owning concrete type.
use ra_ap_ide_db::RootDatabase;
/// Import the Cargo loader with explicitly disabled fixture build/procedural-macro execution.
use ra_ap_load_cargo::{LoadCargoConfig, ProcMacroServerChoice, load_workspace_at};
/// Import the optional process owner's concrete type returned by the loader.
use ra_ap_proc_macro_api::ProcMacroClient;
/// Import explicit standard-library discovery settings.
use ra_ap_project_model::{CargoConfig, RustLibSource};
/// Import the exact registered syntax root interface.
use ra_ap_syntax::{AstNode, ast};
/// Import native file identities and validated absolute UTF-8 paths.
use ra_ap_vfs::{AbsPathBuf, FileExcluded, FileId, Vfs, VfsPath};
/// Import the backend's generated setter trait for typed test inputs.
use salsa::Setter;
/// Import owned native paths and compiler-query output.
use std::path::PathBuf;
use std::process::{Command, Output};

/// What: Typed per-database request, rather than a captured callback or process-global test state.
/// Why: Named query functions can access the selected file and severity through the backend's existing storage.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Request = { file: FileId; severity: Severity };
/// ```
#[salsa::input(singleton)]
struct Request {
    /// File whose in-memory source is replaced for each conformance case.
    file: FileId,
    /// Effective rule severity under test.
    severity: Severity,
}

/// Read loader progress as captured test diagnostics, not as production lint output.
fn progress(message: String) {
    eprintln!("semantic fixture: {message}");
}

/// Resolve source through the currently attached database and invoke the production checker.
fn inspect(database: &dyn HirDatabase) -> Vec<Diagnostic> {
    let request: Request = Request::get(database);
    let semantics: Semantics<'_, dyn HirDatabase> = Semantics::new_dyn(database);
    let root: ast::SourceFile = semantics.parse_guess_edition(request.file(database));
    let source: RustSource =
        RustSource::from_syntax(String::from("input.rs"), root.syntax().clone());
    return check_explicit_types(&semantics, &source, request.severity(database));
}

/// Enter the named inspection function through rust-analyzer's supported database accessor.
fn attached_inspection() -> Vec<Diagnostic> {
    return with_attached_db::<Vec<Diagnostic>>(inspect);
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
    assert!(metadata.is_file(), "rust-src core entry must be a regular file");
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
    /// Drop the database before deleting the exclusively owned source directory.
    database: RootDatabase,
    /// Stable file identity, retained across source-overlay revisions.
    file: FileId,
    /// Typed request handle updated before entering the database scope.
    request: Request,
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
        let path: VfsPath = VfsPath::new_real_path(String::from(
            source_path.to_str().expect("UTF-8 fixture path"),
        ));
        let (file, excluded): (FileId, FileExcluded) =
            files.file_id(&path).expect("fixture file loaded");
        assert_eq!(excluded, FileExcluded::No);
        let request: Request = Request::new(&database, file, Severity::Error);
        return SemanticFixture {
            database,
            file,
            request,
            _directory: directory,
        };
    }

    /// Replace exact source bytes before querying; returned findings cannot borrow the database.
    pub(crate) fn check(&mut self, source: &str, severity: Severity) -> Vec<Diagnostic> {
        let mut change: ChangeWithProcMacros = ChangeWithProcMacros::default();
        change.change_file(self.file, Some(String::from(source)));
        self.database.apply_change(change);
        self.request.set_severity(&mut self.database).to(severity);
        return attach_db::<Vec<Diagnostic>>(&self.database, attached_inspection);
    }
}
