//! What: The owned native Markdown/MDX parse and byte-safe source interface.
//! Why: Rules share one arena, retain original source offsets, and never execute MDX code.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // Parse once and expose node ids, decoded data, source slices and diagnostic positions.
//! ```

use crate::diagnostic::Span;
use crate::markdown_positions::MarkdownPositions;
/// Import the approved parser and arena types.
use satteri_arena::{Arena, ArenaNode, Mdast};
use satteri_ast::mdast::{MdastNodeType, decode_string_ref_data};
use satteri_pulldown_cmark::{Options, parse};
/// Import panic containment and the common diagnostic span.
use std::panic::catch_unwind;

/// What: A parser or native-tree failure with an original-source byte position.
/// Why: The engine reports one processing failure instead of attempting fixes on an invalid parse.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class MarkdownError extends Error { readonly offset: number }
/// ```
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MarkdownError {
    /// Explanation supplied to the per-file processing finding.
    pub message: String,
    /// Original-source byte location, including any leading BOM.
    pub offset: usize,
}

/// Render parser failures through ordinary application error handling.
impl std::fmt::Display for MarkdownError {
    /// Emit only the stored explanation; the caller owns filename and position rendering.
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        return formatter.write_str(self.message.as_str());
    }
}

/// Mark parser failures as standard errors.
impl std::error::Error for MarkdownError {}

/// What: Exact source plus an arena and validated traversal indexes.
/// Why: Arena ids and byte offsets avoid the TypeScript wrapper's extra Unicode-offset conversion.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class MarkdownSource { source: string; arena: Arena; visibleNodes: number[] }
/// ```
pub struct MarkdownSource {
    /// Filename or virtual name until processor mapping assigns its host.
    pub filename: String,
    /// Exact original source, including a leading BOM if present.
    pub source: String,
    /// Whether MDX syntax was enabled for this input.
    pub mdx: bool,
    /// Parsed tree; string and type-data reads stay behind this module's methods.
    arena: Arena<Mdast>,
    /// Source bytes stripped by the parser before producing offsets.
    bom: usize,
    /// Original-source line and UTF-16 position index.
    positions: MarkdownPositions,
    /// Reachable nodes in source-tree order, including MDX subtrees.
    all_nodes: Vec<u32>,
    /// Rule-visible nodes with MDX nodes and their subtrees excluded.
    visible_nodes: Vec<u32>,
    /// Parents derived from reachable child edges, rather than trusting separate parser metadata.
    parents: Vec<u32>,
}

/// Validated traversal facts built together in one structural walk.
struct Traversal {
    /// Every reachable node in preorder.
    all: Vec<u32>,
    /// Prose-rule-visible nodes.
    visible: Vec<u32>,
    /// Reachable parent per node; u32::MAX is the root's absence sentinel.
    parents: Vec<u32>,
}

/// What: The existing prose walker excludes MDX code and its descendants.
/// Why: JSX, ESM and expression bodies are not Markdown prose-rule inputs.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function isMdx(kind: MdastNodeType): boolean;
/// ```
fn is_mdx(kind: MdastNodeType) -> bool {
    return matches!(
        kind,
        MdastNodeType::MdxJsxFlowElement
            | MdastNodeType::MdxJsxTextElement
            | MdastNodeType::MdxFlowExpression
            | MdastNodeType::MdxTextExpression
            | MdastNodeType::MdxjsEsm
    );
}

/// What: Validate reachable tree nodes and produce iterative traversal lists.
/// Why: Invalid native ranges or repeated child references must not become unchecked slices or an endless walk.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function traversal(arena: Arena, source: string, bom: number): [number[], number[]];
/// ```
fn traversal(arena: &Arena<Mdast>, source: &str, bom: usize) -> Result<Traversal, MarkdownError> {
    if arena.is_empty() {
        return Err(MarkdownError {
            message: String::from("Markdown parser returned no root node."),
            offset: bom,
        });
    }
    let mut visited = vec![false; arena.len()];
    let mut parents = vec![u32::MAX; arena.len()];
    let mut pending = vec![(0_u32, false, u32::MAX)];
    let mut all = Vec::new();
    let mut visible = Vec::new();
    while let Some((id, hidden_parent, parent)) = pending.pop() {
        let index = id as usize;
        if index >= arena.len() || visited[index] {
            return Err(MarkdownError {
                message: String::from(
                    "Markdown parser returned an invalid or repeated child reference.",
                ),
                offset: bom,
            });
        }
        visited[index] = true;
        parents[index] = parent;
        let node = arena.get_node(id);
        let Some(kind) = MdastNodeType::from_u8(node.node_type) else {
            return Err(MarkdownError {
                message: String::from("Markdown parser returned an unknown node kind."),
                offset: bom,
            });
        };
        if id == 0 && kind != MdastNodeType::Root {
            return Err(MarkdownError {
                message: String::from("Markdown parser returned a non-root entry node."),
                offset: bom,
            });
        }
        let start = node.start_offset as usize + bom;
        let end = node.end_offset as usize + bom;
        if start > end
            || end > source.len()
            || !source.is_char_boundary(start)
            || !source.is_char_boundary(end)
        {
            return Err(MarkdownError {
                message: String::from(
                    "Markdown parser returned a source range outside UTF-8 boundaries.",
                ),
                offset: start.min(source.len()),
            });
        }
        let hidden = hidden_parent || is_mdx(kind);
        all.push(id);
        if !hidden {
            visible.push(id);
        }
        let children_start = node.children_start as usize;
        let Some(children_end) = children_start.checked_add(node.children_count as usize) else {
            return Err(MarkdownError {
                message: String::from("Markdown parser returned an overflowing child range."),
                offset: start,
            });
        };
        let Some(children) = arena.children.get(children_start..children_end) else {
            return Err(MarkdownError {
                message: String::from("Markdown parser returned an out-of-range child list."),
                offset: start,
            });
        };
        for child in children.iter().rev() {
            pending.push((*child, hidden, id));
        }
    }
    return Ok(Traversal {
        all,
        visible,
        parents,
    });
}

/// Direct native-arena guard controls, independent of what malformed text the parser happens to emit.
#[cfg(test)]
#[path = "markdown_traversal_tests.rs"]
mod traversal_tests;

/// What: Parse with the exact accepted feature set and expose immutable views.
/// Why: Defaults in the dependency enable unwanted math and omit TOML frontmatter.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // Explicit GFM, footnote, YAML and TOML options; MDX is conditional on file language.
/// ```
impl MarkdownSource {
    /// Parse source without evaluating MDX and retain parser failures as typed outcomes.
    pub fn new(
        filename: String,
        source: String,
        mdx: bool,
    ) -> Result<MarkdownSource, MarkdownError> {
        let bom = if source.starts_with('\u{feff}') { 3 } else { 0 };
        let mut options = Options::ENABLE_GFM
            | Options::ENABLE_TABLES
            | Options::ENABLE_STRIKETHROUGH
            | Options::ENABLE_TASKLISTS
            | Options::ENABLE_FOOTNOTES
            | Options::ENABLE_YAML_STYLE_METADATA_BLOCKS
            | Options::ENABLE_PLUSES_DELIMITED_METADATA_BLOCKS;
        if mdx {
            options.insert(Options::ENABLE_MDX);
        }
        let result = catch_unwind(|| return parse(source.as_str(), options));
        let (arena, errors) = match result {
            Ok(parsed) => parsed,
            Err(payload) => {
                let detail = if let Some(message) = payload.downcast_ref::<String>() {
                    message.clone()
                } else if let Some(message) = payload.downcast_ref::<&str>() {
                    String::from(*message)
                } else {
                    format!("non-text panic payload {:?}", payload.as_ref().type_id())
                };
                return Err(MarkdownError {
                    message: format!("Markdown parser panicked: {detail}"),
                    offset: bom,
                });
            }
        };
        if let Some((offset, message)) = errors.first() {
            return Err(MarkdownError {
                message: format!("MDX parsing failed: {message}"),
                offset: offset.saturating_add(bom).min(source.len()),
            });
        }
        let traversal = traversal(&arena, source.as_str(), bom)?;
        let positions = MarkdownPositions::new(source.as_str());
        return Ok(MarkdownSource {
            filename,
            source,
            mdx,
            arena,
            bom,
            positions,
            all_nodes: traversal.all,
            visible_nodes: traversal.visible,
            parents: traversal.parents,
        });
    }

    /// Borrow the validated rule-visible traversal.
    pub fn visible_nodes(&self) -> &[u32] {
        return self.visible_nodes.as_slice();
    }

    /// Borrow every reachable node for processor discovery, including nodes below JSX.
    pub fn all_nodes(&self) -> &[u32] {
        return self.all_nodes.as_slice();
    }

    /// Read one parser-owned node by a validated id.
    pub fn node(&self, id: u32) -> &ArenaNode {
        return self.arena.get_node(id);
    }

    /// Decode a kind already checked during construction.
    pub fn kind(&self, id: u32) -> MdastNodeType {
        return MdastNodeType::from_u8(self.node(id).node_type)
            .expect("construction validates node kinds");
    }

    /// Borrow direct children without flattening structural relationships.
    pub fn children(&self, id: u32) -> &[u32] {
        return self.arena.get_children(id);
    }

    /// Borrow type-specific data for the node's matching typed decoder.
    pub fn data(&self, id: u32) -> &[u8] {
        return self.arena.get_type_data(id);
    }

    /// Read decoded parser text by its validated arena reference.
    pub fn text(&self, reference: satteri_arena::StringRef) -> &str {
        return self.arena.get_str(reference);
    }

    /// Return the original-source half-open byte range.
    pub fn offsets(&self, id: u32) -> (usize, usize) {
        let node = self.node(id);
        return (
            node.start_offset as usize + self.bom,
            node.end_offset as usize + self.bom,
        );
    }

    /// Borrow exact authored spelling rather than the parser's normalized text.
    pub fn slice(&self, id: u32) -> &str {
        let (start, end) = self.offsets(id);
        return &self.source[start..end];
    }

    /// Resolve original-source byte positions with Markdown's UTF-16 columns.
    pub fn span(&self, offset: usize, length: usize) -> Span {
        return self.positions.span(offset, length);
    }

    /// Return a full-node diagnostic range with original-source addressing.
    pub fn node_span(&self, id: u32) -> Span {
        let (start, end) = self.offsets(id);
        return self.span(start, end - start);
    }

    /// Read the reachable parent, with root absence represented explicitly.
    pub fn parent(&self, id: u32) -> Option<u32> {
        let parent = self.parents[id as usize];
        if parent == u32::MAX {
            return None;
        }
        return Some(parent);
    }

    /// Test ancestry without depending on parser-internal parent bookkeeping.
    pub fn has_ancestor(&self, id: u32, kind: MdastNodeType) -> bool {
        let mut current = self.parent(id);
        while let Some(parent) = current {
            if self.kind(parent) == kind {
                return true;
            }
            current = self.parent(parent);
        }
        return false;
    }

    /// Collect only text and inline-code values, matching the incumbent's collectText helper.
    pub fn text_content(&self, id: u32) -> String {
        let mut output = String::new();
        let mut pending = vec![id];
        while let Some(current) = pending.pop() {
            let kind = self.kind(current);
            if kind == MdastNodeType::Text || kind == MdastNodeType::InlineCode {
                let reference = decode_string_ref_data(self.data(current));
                output.push_str(self.text(reference));
            }
            for child in self.children(current).iter().rev() {
                pending.push(*child);
            }
        }
        return output;
    }

    /// Collect text descendants in source order for localized text edits.
    pub fn text_nodes(&self, id: u32) -> Vec<u32> {
        let mut output = Vec::new();
        let mut pending = vec![id];
        while let Some(current) = pending.pop() {
            if self.kind(current) == MdastNodeType::Text {
                output.push(current);
            }
            for child in self.children(current).iter().rev() {
                pending.push(*child);
            }
        }
        return output;
    }
}

/// Keep native-parser controls outside release artifacts.
#[cfg(test)]
#[path = "markdown_source_tests.rs"]
mod tests;
