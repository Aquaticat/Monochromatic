//! Turning a match plus a replacement snippet into a concrete edit.

/// Imports the bindings a match produced.
use crate::matcher::{Bindings, Match, METAVARIABLE_PREFIX};

// What:     `pub fn render(template: &str, found: &Match) -> String`. Substitutes
//           each metavariable in the template with the text it bound to.
// Why:      A rewrite is written in the same language as the pattern, so
//           `META_X.unwrap()` repaired by `META_X.expect("...")` reuses whatever
//           the receiver turned out to be. Without substitution the fix would
//           write the literal text `META_X` into the user's source.
//
// In TS you'd write (pseudocode):
// ```ts
// function render(template: string, found: Match): string
// ```
/// Render a replacement snippet, substituting each bound metavariable.
pub fn render(template: &str, found: &Match) -> String {
    return substitute(template, &found.bindings);
}

// What:     `fn substitute(template: &str, bindings: &Bindings) -> String`.
//           Replaces longest names first.
// Why:      `META_A` is a prefix of `META_AB`. Substituting the shorter one
//           first would rewrite the first six characters of the longer name and
//           leave a `B` stranded, so ordering by descending length is what makes
//           overlapping names safe.
/// Substitute every bound metavariable into a template.
fn substitute(template: &str, bindings: &Bindings) -> String {
    // `.collect()` into a vector so the entries can be sorted; a `BTreeMap`
    // iterates in name order, which is not the order needed here.
    let mut names: Vec<&String> = bindings.keys().collect();

    // `.sort_by_key(..)` with a negated length would need signed arithmetic, so
    // this sorts ascending and reverses, which says the same thing plainly.
    names.sort_by_key(|name| return name.len());
    names.reverse();

    let mut out = template.to_string();
    for name in names {
        if let Some(bound) = bindings.get(name) {
            out = out.replace(name, &bound.text().to_string());
        }
    }

    return out;
}

// What:     `pub fn unbound_metavariables(template: &str, bindings: &Bindings)
//           -> Vec<String>`. Names the holes a template uses that the pattern
//           never filled.
// Why:      A rewrite naming a metavariable the pattern does not bind would
//           write `META_Y` literally into the user's source. Catching it lets
//           the caller reject the rule rather than corrupt a file.
/// Return metavariable names a template uses but the pattern never bound.
pub fn unbound_metavariables(template: &str, bindings: &Bindings) -> Vec<String> {
    let mut missing = Vec::new();

    // Splitting on non-identifier characters is enough to find candidate names:
    // a metavariable is an ordinary identifier by construction.
    for word in template.split(|character: char| {
        return !character.is_alphanumeric() && character != '_';
    }) {
        if !word.starts_with(METAVARIABLE_PREFIX) || word == METAVARIABLE_PREFIX {
            continue;
        }

        if !bindings.contains_key(word) && !missing.contains(&word.to_string()) {
            missing.push(word.to_string());
        }
    }

    return missing;
}
