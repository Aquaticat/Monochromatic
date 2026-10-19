//! The units of the last picture, kept with the keys they were rendered for.
//!  A new picture reuses every unit whose key is unchanged and renders the others.

/// The key a unit is valid for.
use super::key::UnitKey;
/// What a unit reduced to.
use super::downscale::Reduced;

/// A unit of the last picture:
/// its key and the rows it reduced to,
/// one reduction for each piece.
#[derive(Clone)]
pub struct Slot {
    /// What the unit was rendered for.
    pub key: UnitKey,
    /// The reductions of its pieces.
    pub reduced: Vec<Reduced>,
}

/// What:
///  The units of the last picture,
///  by their place in it.
/// Why:
///  Memory stays one picture's worth:
///  a new picture replaces the units it renders and drops the ones past its last.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class Cache { slots: (Slot | undefined)[] }
/// ```
#[derive(Clone, Default)]
pub struct Cache {
    /// The unit at each place;
    /// nothing where none was rendered.
    slots: Vec<Option<Slot>>,
}

/// Looking up and replacing units.
impl Cache {
    /// An empty cache.
    pub fn new() -> Self {
        return Self::default();
    }

    /// The unit at place `index`,
    /// if one is kept.
    pub fn get(&self, index: usize) -> Option<&Slot> {
        return self.slots.get(index).and_then(Option::as_ref);
    }

    /// Keep `slot` at place `index`.
    pub fn put(&mut self, index: usize, slot: Slot) {
        if self.slots.len() <= index {
            self.slots.resize(index + 1, None);
        }
        self.slots[index] = Some(slot);
    }

    /// Drop every unit.
    pub fn clear(&mut self) {
        self.slots.clear();
    }

    /// Drop every unit from place `len` on.
    pub fn truncate(&mut self, len: usize) {
        self.slots.truncate(len);
    }

    /// How many units are kept.
    pub fn len(&self) -> usize {
        let mut kept = 0;
        for slot in &self.slots {
            if slot.is_some() {
                kept += 1;
            }
        }
        return kept;
    }

    /// Whether no unit is kept.
    pub fn is_empty(&self) -> bool {
        return self.len() == 0;
    }
}
