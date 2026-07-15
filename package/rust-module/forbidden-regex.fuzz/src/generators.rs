// What:  a structured generator that turns fuzzer bytes into a plausibly-valid
//        forbidden-regex dialect pattern plus a content line to match it against.
// Why:   feeding raw bytes to `compile` mostly produces parse errors, which only
//        exercises the rejection paths; a structured generator reaches deep into the
//        DFA/counting builders and the matcher, so the roundtrip and differential
//        targets actually test matching, not just parsing.

use arbitrary::{Arbitrary, Result, Unstructured};

// Bounds keep a generated pattern small and its unrolled automaton fast to build.
const MAX_DEPTH: u32 = 4;
const MAX_SEQ: u32 = 3;
const MAX_ALT: u32 = 3;
const MAX_REPEAT: u32 = 4;
const MAX_CONTENT: usize = 96;

// What:  a generated pattern plus whether it uses set algebra (`&` or `~`).
// Why:   the differential target compares against the `regex` crate, which cannot
//        express algebra, so it must skip algebra patterns; the flag records that.
//        Debug is required: the libFuzzer macro prints the input on a crash.
#[derive(Debug)]
pub struct Pattern {
    pub text: String,
    pub uses_algebra: bool,
}

// What:  a generated pattern paired with one content line.
// Why:   the unit every match-exercising target consumes; Debug for crash reporting.
#[derive(Debug)]
pub struct PatternAndContent {
    pub pattern: Pattern,
    pub content: Vec<u8>,
}

// What:  generation state, threaded so algebra use bubbles up to the `Pattern`.
// Why:   any nested `&`/`~` must mark the whole pattern as algebra-using.
struct Builder {
    uses_algebra: bool,
}

// Simple single-token atoms that are always valid `&`/`|` operands.
const SIMPLE: &[&str] = &[
    "a", "b", "c", "Z", "0", "9", "_", "\\t", "\\.", "\\$", "\\|", "\\\\", ".", "\\d", "\\w",
    "\\s", "\\D", "\\W", "\\S", "[a-z]", "[A-Z]", "[0-9]", "[a-zA-Z0-9]", "[^0-9]", "[abc]",
    "[a-f0-9]", "[ \\t]",
];

// Zero-width anchors, valid inside a sequence.
const ANCHORS: &[&str] = &["^", "$", "\\b"];

impl Builder {
    // What:  a single-token atom that is a valid operand anywhere.
    // Why:   `&`/`|` operands and repetition bases must be single atoms.
    fn simple(&mut self, u: &mut Unstructured) -> Result<String> {
        Ok((*u.choose(SIMPLE)?).to_string())
    }

    // What:  an operand: a simple atom or a parenthesized sub-sequence.
    // Why:   a group `(?:...)` is the way to make a sequence into one atom.
    fn operand(&mut self, u: &mut Unstructured, depth: u32) -> Result<String> {
        if depth == 0 || u.ratio(3, 4)? {
            self.simple(u)
        } else {
            Ok(format!("(?:{})", self.seq(u, depth - 1)?))
        }
    }

    // What:  any atom: an operand, an anchor, a repetition, an option, an
    //        alternation, or (deeper) an intersection or complement.
    // Why:   covers every construct the parser and back-end selector branch on.
    fn atom(&mut self, u: &mut Unstructured, depth: u32) -> Result<String> {
        match u.int_in_range(0u32..=7)? {
            0 | 1 => self.operand(u, depth),
            2 => Ok((*u.choose(ANCHORS)?).to_string()),
            3 => self.repeat(u, depth),
            4 => Ok(format!("{}?", self.operand(u, depth)?)),
            5 => self.alt(u, depth),
            6 if depth > 0 => self.inter(u, depth),
            _ if depth > 0 => self.comp(u, depth),
            _ => self.simple(u),
        }
    }

    // What:  a bounded repetition `atom{n}` or `atom{n,m}` over a SIMPLE atom.
    // Why:   the dialect bans `*`/`+`/unbounded, so only counted forms appear; the base
    //        is a single-token atom (not a recursive group) on purpose, so the generator
    //        never builds multiplicatively-nested repeats like `(?:(?:X{4}){4}){4}` whose
    //        unrolled automaton explodes (the engine's residual guard bounds those, but
    //        producing them just throttles the fuzzer with multi-second compiles).
    fn repeat(&mut self, u: &mut Unstructured, _depth: u32) -> Result<String> {
        let base = self.simple(u)?;
        let n = u.int_in_range(0u32..=MAX_REPEAT)?;
        if u.ratio(1, 2)? {
            Ok(format!("{base}{{{n}}}"))
        } else {
            let m = u.int_in_range(n..=MAX_REPEAT)?;
            Ok(format!("{base}{{{n},{m}}}"))
        }
    }

    // What:  an alternation `(?:a|b|...)` of operands.
    // Why:   branches must be single atoms, so each branch is an operand.
    fn alt(&mut self, u: &mut Unstructured, depth: u32) -> Result<String> {
        let count = u.int_in_range(2u32..=MAX_ALT)?;
        let mut branches = Vec::new();
        for _ in 0..count {
            branches.push(self.operand(u, depth)?);
        }
        Ok(format!("(?:{})", branches.join("|")))
    }

    // What:  an intersection `op & op`, where the right side may be a complement.
    // Why:   the canonical algebra shape is `X & ~(Y)`; both operands are atoms.
    fn inter(&mut self, u: &mut Unstructured, depth: u32) -> Result<String> {
        self.uses_algebra = true;
        let left = self.operand(u, depth)?;
        let right = if u.ratio(1, 2)? {
            self.comp(u, depth)?
        } else {
            self.operand(u, depth)?
        };
        Ok(format!("{left}&{right}"))
    }

    // What:  a complement `~(...)` over a sub-sequence.
    // Why:   `~` must always be parenthesized; the engine rejects a bare `~(Y)`,
    //        which exercises that rejection path.
    fn comp(&mut self, u: &mut Unstructured, depth: u32) -> Result<String> {
        self.uses_algebra = true;
        Ok(format!("~({})", self.seq(u, depth.saturating_sub(1))?))
    }

    // What:  a concatenation of one to `MAX_SEQ` atoms.
    // Why:   the linear backbone every pattern is built on.
    fn seq(&mut self, u: &mut Unstructured, depth: u32) -> Result<String> {
        let count = u.int_in_range(1u32..=MAX_SEQ)?;
        let mut out = String::new();
        for _ in 0..count {
            out.push_str(&self.atom(u, depth)?);
        }
        Ok(out)
    }
}

// What:  a content line: bounded arbitrary bytes with newlines removed.
// Why:   the engine matches one line, so embedded newlines would change `^`/`$`
//        semantics and break the differential comparison against `regex`.
fn content(u: &mut Unstructured) -> Result<Vec<u8>> {
    let raw: Vec<u8> = u.arbitrary()?;
    Ok(raw.into_iter().filter(|&b| b != b'\n').take(MAX_CONTENT).collect())
}

impl<'a> Arbitrary<'a> for PatternAndContent {
    fn arbitrary(u: &mut Unstructured<'a>) -> Result<Self> {
        let mut builder = Builder { uses_algebra: false };
        let text = builder.seq(u, MAX_DEPTH)?;
        let pattern = Pattern {
            text,
            uses_algebra: builder.uses_algebra,
        };
        let content = content(u)?;
        Ok(PatternAndContent { pattern, content })
    }
}
