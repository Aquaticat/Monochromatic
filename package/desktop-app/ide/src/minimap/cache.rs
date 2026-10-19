//! The units of the last picture,
//! kept with the keys they were rendered for.
//!  A new picture reuses every unit whose key is unchanged and renders the others.

/// What a unit reduced to.
use super::downscale::Reduced;
/// The key a unit is valid for.
use super::key::UnitKey;
/// Units by band number,
/// and the range of band numbers to keep.
use std::{collections::BTreeMap, ops::Range};

/// A unit of the last picture:
/// its key and the rows it reduced to.
#[derive(Clone)]
pub struct Slot {
    /// What the unit was rendered for.
    pub key: UnitKey,
    /// The reduction of its band.
    pub reduced: Reduced,
}

/// What:
///  The units of the last picture,
///  by the number of their band.
/// Why:
///  A band keeps its number whatever the scroll,
///  so a picture that slides finds the bands it still shows;
///  memory stays a window's worth because a new picture drops the bands outside its own.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class Cache { slots: Map<number, Slot> }
/// ```
#[derive(Clone, Default)]
pub struct Cache {
    /// The unit of each band number.
    slots: BTreeMap<usize, Slot>,
}

/// Looking up and replacing units.
impl Cache {
    /// An empty cache.
    pub fn new() -> Self {
        return Self::default();
    }

    /// The unit of band `index`,
    /// if one is kept.
    pub fn get(&self, index: usize) -> Option<&Slot> {
        return self.slots.get(&index);
    }

    /// Keep `slot` for band `index`.
    pub fn put(&mut self, index: usize, slot: Slot) {
        self.slots.insert(index, slot);
    }

    /// Drop every unit.
    pub fn clear(&mut self) {
        self.slots.clear();
    }

    /// Drop every unit whose band is not in `window`.
    pub fn retain(&mut self, window: &Range<usize>) {
        let mut kept = self.slots.split_off(&window.start);
        drop(kept.split_off(&window.end.max(window.start)));
        self.slots = kept;
    }

    /// How many units are kept.
    pub fn len(&self) -> usize {
        return self.slots.len();
    }

    /// Whether no unit is kept.
    pub fn is_empty(&self) -> bool {
        return self.slots.is_empty();
    }
}
