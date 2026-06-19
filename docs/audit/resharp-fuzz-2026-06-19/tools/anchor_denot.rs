// Independent DENOTATIONAL oracle EXTENDED WITH ANCHORS, over a \n-bearing alphabet.
//
// Closes the 2026-06-19 campaign gap: the primary denotational oracle (main.rs)
// had NO anchor nodes and alphabet "abc", so the strongest independent check
// (217M pairs) never met the anchor family, which is exactly where both live bugs
// were found (by the weaker self-consistency lane). This bin adds the four anchors
// \A \z ^ $ (multiline default, == resharp default) to the same structural-recursion
// membership model and runs the differential against STOCK resharp 0.6.13.
//
// Membership matches(node,s,i,j) carries the full string s plus absolute indices,
// so a zero-width assertion at position i is well-defined and composes through
// concat (split k is an absolute position). Anchors are kept OUT of complement
// bodies in the primary generator so every disagreement is high-confidence;
// the model is validated vs the regex crate under (?m) on the plain-anchor subset
// (no &/~) before any resharp disagreement is trusted. A positive control proves
// the oracle re-finds the two known bugs before any "clean" result is reported.

use regex::Regex as Rx;
use resharp::{Regex, RegexOptions, UnicodeMode};
use std::collections::HashMap;
use std::panic::{catch_unwind, AssertUnwindSafe};

// region: prng
struct Rng(u64);
impl Rng {
    fn next(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.0 = x;
        x
    }
    fn below(&mut self, n: usize) -> usize {
        (self.next() % (n as u64)) as usize
    }
    fn chance(&mut self, num: usize, den: usize) -> bool {
        self.below(den) < num
    }
}
// endregion

// region: AST
#[derive(Clone)]
enum Re {
    Pred(Vec<u8>),
    Concat(Box<Re>, Box<Re>),
    Union(Box<Re>, Box<Re>),
    Inter(Box<Re>, Box<Re>),
    Compl(Box<Re>),
    Star(Box<Re>),
    Opt(Box<Re>),
    BegInput,
    EndInput,
    BegLine,
    EndLine,
}
// endregion

// region: arena
enum NodeK {
    Pred([bool; 256]),
    Concat(usize, usize),
    Union(usize, usize),
    Inter(usize, usize),
    Compl(usize),
    Star(usize),
    Opt(usize),
    BegInput,
    EndInput,
    BegLine,
    EndLine,
}
struct Arena {
    nodes: Vec<NodeK>,
}
impl Arena {
    fn build(re: &Re) -> (Arena, usize) {
        let mut a = Arena { nodes: Vec::new() };
        let root = a.add(re);
        (a, root)
    }
    fn add(&mut self, re: &Re) -> usize {
        let k = match re {
            Re::Pred(set) => {
                let mut m = [false; 256];
                for &b in set {
                    m[b as usize] = true;
                }
                NodeK::Pred(m)
            }
            Re::Concat(x, y) => {
                let (a, b) = (self.add(x), self.add(y));
                NodeK::Concat(a, b)
            }
            Re::Union(x, y) => {
                let (a, b) = (self.add(x), self.add(y));
                NodeK::Union(a, b)
            }
            Re::Inter(x, y) => {
                let (a, b) = (self.add(x), self.add(y));
                NodeK::Inter(a, b)
            }
            Re::Compl(x) => {
                let a = self.add(x);
                NodeK::Compl(a)
            }
            Re::Star(x) => {
                let a = self.add(x);
                NodeK::Star(a)
            }
            Re::Opt(x) => {
                let a = self.add(x);
                NodeK::Opt(a)
            }
            Re::BegInput => NodeK::BegInput,
            Re::EndInput => NodeK::EndInput,
            Re::BegLine => NodeK::BegLine,
            Re::EndLine => NodeK::EndLine,
        };
        self.nodes.push(k);
        self.nodes.len() - 1
    }
}
// endregion

// region: membership
fn matches(
    a: &Arena,
    node: usize,
    s: &[u8],
    i: usize,
    j: usize,
    memo: &mut HashMap<(usize, usize, usize), bool>,
) -> bool {
    if let Some(&v) = memo.get(&(node, i, j)) {
        return v;
    }
    memo.insert((node, i, j), false);
    let res = match &a.nodes[node] {
        NodeK::Pred(set) => j == i + 1 && set[s[i] as usize],
        NodeK::Concat(x, y) => {
            let mut ok = false;
            for k in i..=j {
                if matches(a, *x, s, i, k, memo) && matches(a, *y, s, k, j, memo) {
                    ok = true;
                    break;
                }
            }
            ok
        }
        NodeK::Union(x, y) => matches(a, *x, s, i, j, memo) || matches(a, *y, s, i, j, memo),
        NodeK::Inter(x, y) => matches(a, *x, s, i, j, memo) && matches(a, *y, s, i, j, memo),
        NodeK::Compl(x) => !matches(a, *x, s, i, j, memo),
        NodeK::Star(x) => {
            if i == j {
                true
            } else {
                let mut ok = false;
                for k in (i + 1)..=j {
                    if matches(a, *x, s, i, k, memo) && matches(a, node, s, k, j, memo) {
                        ok = true;
                        break;
                    }
                }
                ok
            }
        }
        NodeK::Opt(x) => i == j || matches(a, *x, s, i, j, memo),
        NodeK::BegInput => i == j && i == 0,
        NodeK::EndInput => i == j && i == s.len(),
        NodeK::BegLine => i == j && (i == 0 || s[i - 1] == b'\n'),
        NodeK::EndLine => i == j && (i == s.len() || s[i] == b'\n'),
    };
    memo.insert((node, i, j), res);
    res
}
// endregion

// region: derived APIs
fn llmatch(a: &Arena, root: usize, s: &[u8]) -> Option<(usize, usize)> {
    let n = s.len();
    let mut memo = HashMap::new();
    for start in 0..=n {
        let mut best: Option<usize> = None;
        let mut end = n;
        loop {
            if matches(a, root, s, start, end, &mut memo) {
                best = Some(end);
                break;
            }
            if end == start {
                break;
            }
            end -= 1;
        }
        if let Some(e) = best {
            return Some((start, e));
        }
    }
    None
}
fn is_match_model(a: &Arena, root: usize, s: &[u8]) -> bool {
    let n = s.len();
    let mut memo = HashMap::new();
    for i in 0..=n {
        for j in i..=n {
            if matches(a, root, s, i, j, &mut memo) {
                return true;
            }
        }
    }
    false
}
fn find_anchored_model(a: &Arena, root: usize, s: &[u8]) -> Option<(usize, usize)> {
    let n = s.len();
    let mut memo = HashMap::new();
    let mut end = n;
    loop {
        if matches(a, root, s, 0, end, &mut memo) {
            return Some((0, end));
        }
        if end == 0 {
            return None;
        }
        end -= 1;
    }
}
// endregion

// region: render
fn class_str(set: &[u8]) -> String {
    let mut s = String::from("[");
    for &b in set {
        if b == b'\n' {
            s.push_str("\\n");
        } else {
            s.push(b as char);
        }
    }
    s.push(']');
    s
}
fn render(re: &Re) -> String {
    match re {
        Re::Pred(set) => class_str(set),
        Re::Concat(x, y) => format!("(?:{}{})", render(x), render(y)),
        Re::Union(x, y) => format!("(?:{}|{})", render(x), render(y)),
        Re::Inter(x, y) => format!("(?:{}&{})", render(x), render(y)),
        Re::Compl(x) => format!("(?:~{})", render(x)),
        Re::Star(x) => format!("(?:{}*)", render(x)),
        Re::Opt(x) => format!("(?:{}?)", render(x)),
        Re::BegInput => "(?:\\A)".to_string(),
        Re::EndInput => "(?:\\z)".to_string(),
        Re::BegLine => "(?:^)".to_string(),
        Re::EndLine => "(?:$)".to_string(),
    }
}
fn render_plain(re: &Re) -> Option<String> {
    Some(match re {
        Re::Pred(set) => class_str(set),
        Re::Concat(x, y) => format!("(?:{}{})", render_plain(x)?, render_plain(y)?),
        Re::Union(x, y) => format!("(?:{}|{})", render_plain(x)?, render_plain(y)?),
        Re::Inter(_, _) => return None,
        Re::Compl(_) => return None,
        Re::Star(x) => format!("(?:{}*)", render_plain(x)?),
        Re::Opt(x) => format!("(?:{}?)", render_plain(x)?),
        Re::BegInput => "\\A".to_string(),
        Re::EndInput => "\\z".to_string(),
        Re::BegLine => "^".to_string(),
        Re::EndLine => "$".to_string(),
    })
}
// endregion

// region: generation
fn anchor(rng: &mut Rng) -> Re {
    match rng.below(4) {
        0 => Re::BegInput,
        1 => Re::EndInput,
        2 => Re::BegLine,
        _ => Re::EndLine,
    }
}
fn full_pred(alpha: &[u8]) -> Re {
    Re::Pred(alpha.to_vec())
}
fn gen(rng: &mut Rng, depth: u32, alpha: &[u8], allow_ext: bool, allow_anchor: bool) -> Re {
    if depth == 0 || rng.chance(1, 3) {
        if allow_anchor && rng.chance(2, 5) {
            return anchor(rng);
        }
        if rng.chance(1, 4) {
            return full_pred(alpha); // any-byte "_", the live-bug left operand
        }
        let k = 1 + rng.below(alpha.len());
        let mut set = Vec::new();
        for &c in alpha.iter() {
            if set.len() < k && rng.chance(1, 2) {
                set.push(c);
            }
        }
        if set.is_empty() {
            set.push(alpha[rng.below(alpha.len())]);
        }
        return Re::Pred(set);
    }
    let pick = if allow_ext { rng.below(10) } else { rng.below(6) };
    match pick {
        0 | 1 => Re::Concat(
            Box::new(gen(rng, depth - 1, alpha, allow_ext, allow_anchor)),
            Box::new(gen(rng, depth - 1, alpha, allow_ext, allow_anchor)),
        ),
        2 | 3 => Re::Union(
            Box::new(gen(rng, depth - 1, alpha, allow_ext, allow_anchor)),
            Box::new(gen(rng, depth - 1, alpha, allow_ext, allow_anchor)),
        ),
        4 => Re::Star(Box::new(gen(rng, depth - 1, alpha, allow_ext, allow_anchor))),
        5 => Re::Opt(Box::new(gen(rng, depth - 1, alpha, allow_ext, allow_anchor))),
        6 | 7 => Re::Inter(
            Box::new(gen(rng, depth - 1, alpha, allow_ext, allow_anchor)),
            Box::new(Re::Opt(Box::new(gen(rng, depth - 1, alpha, allow_ext, allow_anchor)))),
        ),
        _ => Re::Compl(Box::new(gen(rng, depth - 1, alpha, allow_ext, false))),
    }
}
// the live-bug family: any-byte intersected with an optional union containing an anchor
fn gen_danger(rng: &mut Rng, depth: u32, alpha: &[u8]) -> Re {
    let inner = gen(rng, depth, alpha, true, true);
    let u = Re::Union(Box::new(inner), Box::new(anchor(rng)));
    let right = if rng.chance(4, 5) {
        Re::Opt(Box::new(u))
    } else {
        u
    };
    let left = if rng.chance(4, 5) {
        full_pred(alpha)
    } else {
        gen(rng, depth, alpha, true, false)
    };
    if rng.chance(1, 2) {
        Re::Inter(Box::new(left), Box::new(right))
    } else {
        Re::Inter(Box::new(right), Box::new(left))
    }
}
// endregion

// region: resharp wrappers
fn rs_compile(pat: &str) -> Result<Regex, String> {
    match catch_unwind(AssertUnwindSafe(|| {
        Regex::with_options(pat, RegexOptions::default().unicode(UnicodeMode::Ascii))
    })) {
        Ok(Ok(re)) => Ok(re),
        Ok(Err(e)) => Err(format!("CompileErr({e:?})")),
        Err(_) => Err("COMPILE_PANIC".to_string()),
    }
}
fn rs_find_all(re: &Regex, s: &[u8]) -> Result<Vec<(usize, usize)>, String> {
    match catch_unwind(AssertUnwindSafe(|| re.find_all(s))) {
        Ok(Ok(v)) => Ok(v.iter().map(|m| (m.start, m.end)).collect()),
        Ok(Err(e)) => Err(format!("{e:?}")),
        Err(_) => Err("PANIC".to_string()),
    }
}
fn rs_is_match(re: &Regex, s: &[u8]) -> Result<bool, String> {
    match catch_unwind(AssertUnwindSafe(|| re.is_match(s))) {
        Ok(Ok(b)) => Ok(b),
        Ok(Err(e)) => Err(format!("{e:?}")),
        Err(_) => Err("PANIC".to_string()),
    }
}
fn rs_find_anchored(re: &Regex, s: &[u8]) -> Result<Option<(usize, usize)>, String> {
    match catch_unwind(AssertUnwindSafe(|| re.find_anchored(s))) {
        Ok(Ok(o)) => Ok(o.map(|m| (m.start, m.end))),
        Ok(Err(e)) => Err(format!("{e:?}")),
        Err(_) => Err("PANIC".to_string()),
    }
}
// endregion

#[derive(Default)]
struct Diffs {
    fa: Vec<String>,
    im: Vec<String>,
    an: Vec<String>,
    ct: Vec<String>,
    pn: Vec<String>,
}
impl Diffs {
    fn total(&self) -> usize {
        self.fa.len() + self.im.len() + self.an.len() + self.ct.len() + self.pn.len()
    }
}

fn check_pattern(re: &Re, strings: &[Vec<u8>], d: &mut Diffs, cap: usize) -> u64 {
    let pat = render(re);
    let rc = match rs_compile(&pat) {
        Ok(r) => r,
        Err(e) => {
            if e == "COMPILE_PANIC" && d.pn.len() < cap {
                d.pn.push(format!("COMPILE_PANIC /{pat}/"));
            }
            return 0;
        }
    };
    let (arena, root) = Arena::build(re);
    let mut pairs = 0u64;
    // one example per distinct pattern per category (counts == distinct shapes)
    let (mut fa_done, mut im_done, mut an_done, mut ct_done) = (false, false, false, false);
    for s in strings {
        pairs += 1;
        let m_ll = llmatch(&arena, root, s);
        let m_im = is_match_model(&arena, root, s);
        let m_an = find_anchored_model(&arena, root, s);
        let fa = rs_find_all(&rc, s);
        let im = rs_is_match(&rc, s);
        let an = rs_find_anchored(&rc, s);
        if let (Ok(fa), Ok(im)) = (&fa, &im) {
            // find_all vs model, tiered by whether resharp is self-consistent
            if fa.first().copied() != m_ll && !fa_done && d.fa.len() < cap {
                fa_done = true;
                let resharp_consistent = (*im) == !fa.is_empty();
                let tier = if resharp_consistent { "model-suspect (resharp find_all==is_match)" } else { "RESHARP-INCONSISTENT" };
                d.fa.push(format!(
                    "[{tier}] /{pat}/ on {:?}: model_ll={m_ll:?} find_all={fa:?} is_match={im}",
                    show(s)
                ));
            }
            // is_match vs find_all internal contract (resharp-internal, no model)
            if (*im) != !fa.is_empty() && !ct_done && d.ct.len() < cap {
                ct_done = true;
                d.ct.push(format!("/{pat}/ on {:?}: is_match={im} find_all={fa:?}", show(s)));
            }
            // is_match vs model
            if (*im) != m_im && !im_done && d.im.len() < cap {
                im_done = true;
                d.im.push(format!(
                    "/{pat}/ on {:?}: resharp is_match={im} model={m_im} find_all={fa:?}",
                    show(s)
                ));
            }
        }
        // find_anchored vs model, tiered against resharp find_all at offset 0
        if let (Ok(an), Ok(fa)) = (&an, &fa) {
            if (*an) != m_an && !an_done && d.an.len() < cap {
                an_done = true;
                let fa0 = fa.iter().find(|m| m.0 == 0).copied();
                let tier = if *an == fa0 {
                    "model-suspect (find_anchored==find_all@0)"
                } else {
                    "RESHARP-INCONSISTENT (find_anchored!=find_all@0)"
                };
                d.an.push(format!(
                    "[{tier}] /{pat}/ on {:?}: find_anchored={an:?} find_all@0={fa0:?} model={m_an:?}",
                    show(s)
                ));
            }
        }
        if matches!(&fa, Err(e) if e=="PANIC") || matches!(&im, Err(e) if e=="PANIC") {
            if d.pn.len() < cap {
                d.pn.push(format!("PANIC /{pat}/ on {:?}", show(s)));
            }
        }
    }
    pairs
}

fn all_strings(alpha: &[u8], maxlen: usize) -> Vec<Vec<u8>> {
    let mut out = vec![Vec::new()];
    let mut frontier = vec![Vec::new()];
    for _ in 0..maxlen {
        let mut next = Vec::new();
        for f in &frontier {
            for &c in alpha {
                let mut v = f.clone();
                v.push(c);
                next.push(v);
            }
        }
        out.extend(next.iter().cloned());
        frontier = next;
    }
    out
}
fn show(s: &[u8]) -> String {
    String::from_utf8_lossy(s).replace('\n', "\\n")
}
fn report(label: &str, v: &[String]) {
    println!("\n-- {label}: {} --", v.len());
    for line in v.iter().take(40) {
        println!("  {line}");
    }
}

fn known_bug_patterns() -> Vec<(&'static str, Re)> {
    // _&(?:[ab]|$)?  and (\z|$)$  built as Re, to prove the oracle catches them
    let im = Re::Inter(
        Box::new(Re::Pred(vec![b'a', b'b', b'\n'])),
        Box::new(Re::Opt(Box::new(Re::Union(
            Box::new(Re::Pred(vec![b'a', b'b'])),
            Box::new(Re::EndLine),
        )))),
    );
    let an = Re::Concat(
        Box::new(Re::Union(Box::new(Re::EndInput), Box::new(Re::EndLine))),
        Box::new(Re::EndLine),
    );
    vec![("is_match _&(?:[ab]|$)?", im), ("find_anchored (\\z|$)$", an)]
}

fn main() {
    let alpha: Vec<u8> = b"ab\n".to_vec();
    let strings = all_strings(&alpha, 5);
    let n_patterns: usize = std::env::args()
        .nth(1)
        .and_then(|s| s.parse().ok())
        .unwrap_or(60_000);

    // ---- Phase 1: validate anchor model vs regex crate (?m) on plain-anchor subset ----
    let mut rng = Rng(0x9e3779b97f4a7c15);
    let (mut validated, mut tries) = (0usize, 0usize);
    let mut model_bugs: Vec<String> = Vec::new();
    while validated < 5000 && tries < 400_000 {
        tries += 1;
        let re = gen(&mut rng, 4, &alpha, false, true);
        let Some(plain) = render_plain(&re) else { continue };
        let Ok(rx) = Rx::new(&format!("(?m){plain}")) else { continue };
        let (arena, root) = Arena::build(&re);
        for s in &strings {
            let model = is_match_model(&arena, root, s);
            let rx_exists = rx.is_match(&String::from_utf8_lossy(s));
            if model != rx_exists && model_bugs.len() < 20 {
                model_bugs.push(format!("/{plain}/ (?m) on {:?}: model={model} regex={rx_exists}", show(s)));
            }
        }
        validated += 1;
    }
    println!("== Phase 1: anchor-model validation vs regex crate (?m) ==");
    println!("validated patterns: {validated}");
    if !model_bugs.is_empty() {
        println!("MODEL WRONG ({}), aborting:", model_bugs.len());
        for b in &model_bugs {
            println!("  {b}");
        }
        return;
    }
    println!("model agrees with regex crate on every plain-anchor case (trustworthy)\n");

    // ---- Phase 1b: POSITIVE CONTROL: the oracle must re-find the two known bugs ----
    println!("== Phase 1b: positive control (oracle must flag the two known bugs) ==");
    let mut control_ok = true;
    for (name, re) in known_bug_patterns() {
        let mut d = Diffs::default();
        check_pattern(&re, &strings, &mut d, 5);
        let hit = d.total() > 0;
        println!("  {name}: oracle flagged = {hit}  (fa={} im={} an={} ct={})", d.fa.len(), d.im.len(), d.an.len(), d.ct.len());
        if !hit {
            control_ok = false;
        }
    }
    if !control_ok {
        println!("POSITIVE CONTROL FAILED: oracle cannot see known bugs; a clean run would be meaningless. Aborting.");
        return;
    }
    println!("positive control passed: oracle independently detects both known bugs\n");

    // ---- Phase 2: differential vs STOCK resharp 0.6.13, general + danger family ----
    let mut rng = Rng(0xdeadbeefcafef00d);
    let mut d = Diffs::default();
    let mut pairs = 0u64;
    let mut compiled = 0usize;
    for k in 0..n_patterns {
        let re = if k % 2 == 0 {
            gen(&mut rng, 5, &alpha, true, true)
        } else {
            gen_danger(&mut rng, 4, &alpha)
        };
        let p = check_pattern(&re, &strings, &mut d, 40);
        if p > 0 {
            compiled += 1;
            pairs += p;
        }
    }
    println!("== Phase 2: differential vs stock resharp 0.6.13 (anchor superset, alphabet ab\\n) ==");
    println!("patterns compiled: {compiled}/{n_patterns}   pairs checked: {pairs}");
    report("find_all[0] vs model (THE PRIZE: independent anchored find_all check)", &d.fa);
    report("is_match contract (is_match == find_all nonempty)", &d.ct);
    report("is_match vs model", &d.im);
    report("find_anchored vs model", &d.an);
    report("panics/crashes", &d.pn);

    let new_fa = d.fa.len();
    println!(
        "\n== SUMMARY == anchored find_all disagreements: {new_fa} | is_match: {} | find_anchored: {} | contract: {} | panics: {}",
        d.im.len(),
        d.an.len(),
        d.ct.len(),
        d.pn.len()
    );
}
