//! Display-independent startup grammar for one project root and an optional initial source file.

/// Preserve clap's typed help/usage errors inside the application's standard error envelope.
use anyhow::{Context, Result};
/// Reuse the repository's CLI parser and native-path value parser instead of manual argument dispatch.
use clap::{Arg, Command, builder::PathBufValueParser};
/// Native argv and paths retain non-UTF-8 names rather than passing through display strings.
use std::{ffi::OsString, path::PathBuf};

/// Parsed startup inputs; filesystem validation happens after help and version handling.
#[derive(Debug)]
pub struct Options {
    /// Sole project directory, explicit rather than inferred from the initial file's parent.
    pub project: PathBuf,
    /// Optional source path resolved relative to the project root, not the caller's cwd.
    pub file: Option<PathBuf>,
}

/// Construct help and option grammar without initializing a display or reading project contents.
fn command() -> Command {
    // What: Command and Arg builders declare grammar; they do not start the application.
    // Why: --help and --version must work without a compositor, project directory, or font initialization.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const command = new Command('monochromatic-ide');
    // ```
    let mut command = Command::new("monochromatic-ide");
    command = command.about("Read-only source navigation in one local project");
    command = command.version(env!("CARGO_PKG_VERSION"));
    let mut project = Arg::new("project");
    project = project.value_name("PROJECT").required(true);
    project = project.value_parser(PathBufValueParser::new());
    project = project.help("Local directory used as the sole file-tree and search root");
    command = command.arg(project);
    let mut file = Arg::new("file");
    file = file.long("file").value_name("FILE");
    file = file.value_parser(PathBufValueParser::new());
    file = file.help(
        "Initially display a UTF-8 source file within PROJECT; relative paths start at PROJECT",
    );
    command = command.arg(file);
    return command;
}

/// Parse argv excluding the executable name; no filesystem or toolkit operations occur here.
pub fn parse_args(args: &[OsString]) -> Result<Options> {
    // What: Vec owns a variable-length argv list; unlike String, OsString retains native non-UTF-8 bytes.
    // Why: The command name occupies argv[0] while project filenames remain exact native paths.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const argv = [nativeString('monochromatic-ide'), ...args];
    // ```
    let mut argv = Vec::with_capacity(args.len() + 1);
    argv.push(OsString::from("monochromatic-ide"));
    for arg in args {
        // Clone gives clap owned argv without consuming the caller's original arguments.
        argv.push(arg.clone());
    }
    // What: ? propagates typed parse/help errors so the executable can use clap's exit code and output stream.
    // Why: Help is neither a startup failure nor permission to open a window.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const matches = command().tryParse(argv);
    // ```
    let matches = command().try_get_matches_from(argv)?;
    let project = matches
        .get_one::<PathBuf>("project")
        .context("Validated project argument is missing")?;
    // cloned copies a present owned path; omission remains None rather than a fabricated filename.
    let file = matches.get_one::<PathBuf>("file").cloned();
    // What: Ok returns the owned configuration after parser validation.
    // Why: No references into temporary clap matches escape this function.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return { project: matches.project, file: matches.file };
    // ```
    return Ok(Options {
        project: project.clone(),
        file,
    });
}
