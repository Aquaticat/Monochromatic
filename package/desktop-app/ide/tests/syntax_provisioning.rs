//! The bundled manifest decides which recognized languages are supported, plain text, or broken.

/// What: `use helix_core::{...}` brings several names from the Helix core library into this file.
///       `Rope` is the application's text container; `Loader` is Helix's language registry;
///       `LanguageData` compiles one language's highlighting rules; `Configuration` is the
///       decoded registry file.
/// Why:  The last test checks every registry language that uses a bundled grammar, which the
///       application engine only does lazily, one opened file at a time.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Rope, Loader, LanguageData, type Configuration } from 'helix-core';
/// ```
use helix_core::{
    Rope,
    syntax::{LanguageData, Loader, config::Configuration},
};
/// The application-owned engine and its manifest reader are the subjects under test.
use ide_app::syntax::{SyntaxEngine, provisioned_grammars};
/// Sets hold grammar ids; paths name sample files and manifest fixtures.
use std::{collections::HashSet, fs, path::Path};

/// What: `fn write_manifest(content: &str) -> tempfile::TempDir` takes borrowed text (`&str`:
///       the caller keeps ownership; sibling `String` would take it) and returns a handle that
///       owns a fresh temporary directory, deleted when the handle goes out of scope.
/// Why:  Manifest edge cases need real files that never touch the bundled runtime.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function writeManifest(content: string): TempDir {
///   const directory = mkdtempSync(join(tmpdir(), 'manifest-'));
///   writeFileSync(join(directory, 'manifest.json'), content);
///   return directory;
/// }
/// ```
fn write_manifest(content: &str) -> tempfile::TempDir {
    // What: `tempfile::tempdir()` returns `Result<TempDir, io::Error>`; `.expect("...")`
    //       extracts the directory handle or panics with that message.
    // Why:  A fixture that cannot be created is a broken test environment, not a test result.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const directory = mkdtempSync(join(tmpdir(), 'manifest-')); // throws on failure
    // ```
    let directory = tempfile::tempdir().expect("isolated manifest directory");
    fs::write(directory.path().join("manifest.json"), content).expect("write manifest fixture");
    return directory;
}

/// What: `#[test]` marks the function below as a test the harness runs; the function takes
///       nothing and passes unless it panics.
/// Why:  Python is in the registry but not in the measured inventory, so no grammar is bundled;
///       the file must stay readable plain text without a rebuild-assets diagnostic.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// test('recognized language without a bundled grammar is plain text', () => { /* ... */ });
/// ```
#[test]
fn recognized_language_without_a_bundled_grammar_is_plain_text() {
    let engine = SyntaxEngine::new().expect("bundled language manifest");
    // What: `Rope::from_str(...)` builds the text container; `Path::new(...)` views a string
    //       as a filesystem path without copying it.
    // Why:  The engine receives exactly these two inputs for every opened file.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const text = new Rope("print('cat')\n"); const file = '/project/main.py';
    // ```
    let text = Rope::from_str("print('cat')\n");
    let file = Path::new("/project/main.py");
    // What: `&text` lends the rope without giving it away. `highlight` returns
    //       `Result<Option<...>>`: `.expect(...)` unwraps the `Result`, and `.is_none()` asks
    //       whether the `Option` inside is the absent variant.
    // Why:  Absent means plain text; an error here would be the misleading diagnostic.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // assert.equal(engine.highlight(file, text), undefined); // must not throw
    // ```
    assert!(
        engine
            .highlight(file, &text)
            .expect("an unprovisioned language is plain text, not a parser failure")
            .is_none()
    );
    assert!(engine.language_id(file, &text).is_none());
}

/// A grammar the manifest lists but the runtime cannot load is a broken installation.
#[test]
fn listed_grammar_that_cannot_load_is_a_visible_failure() {
    // What: `HashSet::from([...])` builds a set from a fixed array; `.to_string()` copies the
    //       literal into an owned `String`, the element type the engine stores.
    // Why:  Listing `python` without shipping its library reproduces a damaged installation.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const listed = new Set(['python']);
    // ```
    let listed = HashSet::from(["python".to_string()]);
    let engine = SyntaxEngine::with_provisioned(listed).expect("language configuration");
    let text = Rope::from_str("print('cat')\n");
    let file = Path::new("/project/main.py");
    assert_eq!(engine.language_id(file, &text).as_deref(), Some("python"));
    // What: `.expect_err(...)` is the mirror of `.expect(...)`: it extracts the error value and
    //       panics when the call succeeded instead. `{error:#}` formats the error with causes.
    // Why:  The diagnostic must name the language and the rebuild remedy.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let message = ''; try { engine.highlight(file, text); } catch (error) { message = String(error); }
    // ```
    let error = engine
        .highlight(file, &text)
        .expect_err("a listed grammar without its library must not read as plain text");
    let message = format!("{error:#}");
    assert!(message.contains("as python"), "{message}");
    assert!(message.contains("could not be loaded"), "{message}");
}

/// The manifest, not the presence of a library file, decides what is bundled.
#[test]
fn unlisted_grammar_is_plain_text_even_when_its_library_exists() {
    let engine = SyntaxEngine::with_provisioned(HashSet::new()).expect("language configuration");
    let text = Rope::from_str("fn main() {}\n");
    let file = Path::new("/project/src/main.rs");
    assert!(engine.highlight(file, &text).expect("plain text").is_none());
    assert!(engine.language_id(file, &text).is_none());
}

/// Manifest entries are library file names; grammar ids drop the suffix and keep other keys ignored.
#[test]
fn manifest_lists_grammar_ids_without_the_library_suffix() {
    let directory = write_manifest(
        "{\"helixRevision\": \"pinned\", \"grammars\": [\"rust.so\", \"qmljs.so\"]}",
    );
    // `&directory.path().join(...)` lends the freshly built path to the reader.
    let names = provisioned_grammars(&directory.path().join("manifest.json")).expect("manifest");
    let expected = HashSet::from(["rust".to_string(), "qmljs".to_string()]);
    assert_eq!(names, expected);
}

/// A missing manifest names the file and the task that prepares it.
#[test]
fn missing_manifest_names_the_file_and_the_remedy() {
    let directory = tempfile::tempdir().expect("isolated manifest directory");
    let manifest = directory.path().join("manifest.json");
    let error = provisioned_grammars(&manifest).expect_err("missing manifest");
    let message = format!("{error:#}");
    assert!(
        message.contains("Cannot read the bundled language manifest"),
        "{message}"
    );
    assert!(message.contains("manifest.json"), "{message}");
    assert!(message.contains("runtime task"), "{message}");
}

/// A manifest of the wrong shape is rejected instead of being read as an empty selection.
#[test]
fn malformed_manifest_is_rejected() {
    let directory = write_manifest("{\"grammars\": \"rust.so\"}");
    let error = provisioned_grammars(&directory.path().join("manifest.json"))
        .expect_err("wrong manifest shape");
    let message = format!("{error:#}");
    assert!(
        message.contains("Cannot decode the bundled language manifest"),
        "{message}"
    );
}

/// An entry that is not a grammar library is rejected instead of being skipped.
#[test]
fn manifest_entry_that_is_not_a_library_is_rejected() {
    let directory = write_manifest("{\"grammars\": [\"rust.so\", \"notes.txt\"]}");
    let error = provisioned_grammars(&directory.path().join("manifest.json"))
        .expect_err("unexpected manifest entry");
    let message = format!("{error:#}");
    assert!(
        message.contains("entry notes.txt is not a grammar shared object"),
        "{message}"
    );
}

/// Every grammar the bundled manifest lists ships its library and at least one license notice.
#[test]
fn bundled_manifest_matches_shipped_libraries_and_notices() {
    let manifest = helix_loader::runtime_file("manifest.json");
    let names = provisioned_grammars(&manifest).expect("bundled manifest");
    assert!(!names.is_empty(), "the bundled manifest lists no grammar");
    let runtime = manifest
        .parent()
        .expect("manifest lives in the runtime directory");
    for name in &names {
        let library = runtime.join("grammars").join(format!("{name}.so"));
        assert!(
            library.is_file(),
            "missing grammar library {}",
            library.display()
        );
        let notices = runtime.join("licenses").join(name);
        let count = fs::read_dir(&notices)
            .unwrap_or_else(|error| panic!("missing notices {}: {error}", notices.display()))
            .count();
        assert!(
            count > 0,
            "no license notice shipped in {}",
            notices.display()
        );
    }
}

/// Every registry language that uses a bundled grammar loads it and compiles its rules,
/// including languages that only reuse a grammar (`jsonc`, `miseconfig`, `markdown-rustdoc`).
#[test]
fn every_language_on_a_bundled_grammar_compiles_its_highlighting_rules() {
    let names = provisioned_grammars(&helix_loader::runtime_file("manifest.json"))
        .expect("bundled manifest");
    // What: `try_into()` converts the registry's TOML value into Helix's typed configuration,
    //       returning a `Result`; the `: Configuration` annotation names the target type.
    // Why:  This is the same registry construction the application engine performs.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const config: Configuration = parseLanguageConfig(defaultLanguageConfig());
    // ```
    let config: Configuration = helix_loader::config::default_lang_config()
        .try_into()
        .expect("bundled language configuration");
    let loader = Loader::new(config).expect("filename language rules");
    // What: `Vec::new()` creates an empty growable list; `mut` allows pushing into it.
    // Why:  Reporting every failing language at once avoids one rebuild per failure.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const checked: string[] = []; const failures: string[] = [];
    // ```
    let mut checked = Vec::new();
    let mut failures = Vec::new();
    let mut covered = HashSet::new();
    for language in loader.language_configs() {
        // `as_deref().unwrap_or(...)`: the explicit grammar name, or else the language's own id.
        let grammar = language.grammar.as_deref().unwrap_or(&language.language_id);
        if !names.contains(grammar) {
            continue;
        }
        covered.insert(grammar.to_string());
        // What: `match` inspects the returned `Result<Option<...>>` and runs the first arm whose
        //       shape fits: success with rules, success without a library, or an error.
        // Why:  The three outcomes need different messages, and none may be ignored.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // try { rules === undefined ? failures.push('library missing') : checked.push(id); }
        // catch (error) { failures.push(String(error)); }
        // ```
        match LanguageData::compile_syntax_config(language, &loader) {
            Ok(Some(_)) => checked.push(language.language_id.clone()),
            Ok(None) => failures.push(format!("{}: grammar library missing", language.language_id)),
            Err(error) => failures.push(format!("{}: {error:#}", language.language_id)),
        }
    }
    println!(
        "languages on bundled grammars ({}): {checked:?}",
        checked.len()
    );
    assert!(failures.is_empty(), "{failures:#?}");
    assert_eq!(
        covered, names,
        "a bundled grammar is used by no registry language"
    );
}
