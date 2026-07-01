//! Integration test for the cache-aware resolve, against a throwaway in-memory database.

use super::*;
use crate::decision::DecisionKind;
use crate::policy::Policy;
use crate::source::AudioSpec;
use std::cell::Cell;

// A minimal in-memory source; short buffers full-scan, so no seeking is exercised here.
struct Fake {
    samples: Vec<f32>,
    cursor: usize,
}

impl TruePeakSource for Fake {
    fn spec(&self) -> AudioSpec {
        AudioSpec { rate: 8, channels: 1, duration_secs: self.samples.len() as f64 / 8.0 }
    }

    fn next_chunk(&mut self) -> Result<Vec<f32>, TruePeakError> {
        if self.cursor >= self.samples.len() {
            return Ok(Vec::new());
        }
        let end = (self.cursor + 4).min(self.samples.len());
        let block = self.samples[self.cursor..end].to_vec();
        self.cursor = end;
        Ok(block)
    }

    fn seek_to_frame(&mut self, frame: u64) -> Result<(), TruePeakError> {
        self.cursor = frame as usize;
        Ok(())
    }
}

fn test_policy() -> Policy {
    Policy {
        short_scan_max_secs: 100.0,
        coverage_fraction: 0.2,
        probe_window_secs: 0.3,
        probe_margin_db: 0.8,
        ceiling_dbtp: -1.0,
        max_too_loud_db: 0.5,
        max_too_quiet_db: -2.0,
    }
}

// The first resolve opens the source and stores; the second is a cache hit and never opens.
#[tokio::test]
async fn resolves_on_miss_then_serves_from_cache() {
    let cache = DecisionCache::open(":memory:").await.unwrap();
    let policy = test_policy();
    let opens = Cell::new(0u32);

    let first = cached_or_resolve(&cache, &policy, 7, 100, || {
        opens.set(opens.get() + 1);
        Ok(Box::new(Fake { samples: vec![0.0, 0.9, 0.9, 0.0], cursor: 0 }) as Box<dyn TruePeakSource>)
    })
    .await
    .unwrap();
    assert_eq!(first.kind, DecisionKind::ShortFullScan);
    assert_eq!(opens.get(), 1); // opened on the miss

    let second = cached_or_resolve(&cache, &policy, 7, 100, || {
        opens.set(opens.get() + 1);
        Ok(Box::new(Fake { samples: vec![0.0, 0.9, 0.9, 0.0], cursor: 0 }) as Box<dyn TruePeakSource>)
    })
    .await
    .unwrap();
    assert_eq!(second, first); // same decision, read back from the cache
    assert_eq!(opens.get(), 1); // the hit never opened the source
}
