// What:     Unit tests for `peakcache_service.rs`, pulled in by
//           `#[cfg(test)] #[path = "peakcache_service_tests.rs"] mod tests;` at the bottom of that file.
//           `use super::*` reaches the actor's private items because this module is its child.
// Why:      The write drain decides how many rows share one commit; it is tested here without a database.

// What:     `use super::*;`. Bring the actor module's items (`drain_writes`, `Write`, `Upsert`) into scope.
// Why:      The tests call the drain directly.
use super::*;
// What:     `use truepeak_core::DecisionKind;`. The decision tag.
// Why:      The fixture builds a `Decision`.
use truepeak_core::DecisionKind;

// What:     `fn put(fingerprint: u64) -> Write`. One queued write for the given key.
// Why:      Each test fills a queue with distinct, recognisable keys.
fn put(fingerprint: u64) -> Write {
    let decision = Decision { gain: 0.5, kind: DecisionKind::FullScanExact, measured_peak: 1.2, duration_secs: 200.0 };
    return Write::Put(Upsert { fingerprint, decision })
}

// What:     `fn keys(batch: &[Upsert]) -> Vec<u64>`. The fingerprints of a batch, in order.
// Why:      Assertions compare order and membership by key.
fn keys(batch: &[Upsert]) -> Vec<u64> {
    return batch.iter().map(|upsert| return upsert.fingerprint).collect()
}

// A lone write with nothing queued behind it is a batch of one: the drain never waits for more.
#[test]
fn a_lone_write_is_a_batch_of_one() {
    let (_write_tx, mut write_rx) = mpsc::unbounded_channel::<Write>();
    let batch = drain_writes(put(7), &mut write_rx);
    assert_eq!(keys(&batch), vec![7]);
}

// Writes already queued join the batch in arrival order, after the one just received.
#[test]
fn queued_writes_join_the_batch_in_order() {
    let (write_tx, mut write_rx) = mpsc::unbounded_channel::<Write>();
    for key in 2..=5 {
        assert!(write_tx.send(put(key)).is_ok(), "queue should accept a write");
    }
    let batch = drain_writes(put(1), &mut write_rx);
    assert_eq!(keys(&batch), vec![1, 2, 3, 4, 5]);
    assert!(write_rx.try_recv().is_err(), "the drain should leave the queue empty");
}

// A backlog larger than the limit is split: the first batch stops at the limit and the rest stays queued.
#[test]
fn a_backlog_is_cut_at_the_batch_limit() {
    let (write_tx, mut write_rx) = mpsc::unbounded_channel::<Write>();
    let backlog = u64::try_from(WRITE_BATCH_LIMIT).expect("limit fits u64") + 10;
    for key in 1..=backlog {
        assert!(write_tx.send(put(key)).is_ok(), "queue should accept a write");
    }
    let first = write_rx.try_recv().expect("positive control: the backlog is queued");
    let batch = drain_writes(first, &mut write_rx);
    assert_eq!(batch.len(), WRITE_BATCH_LIMIT);
    assert_eq!(batch.first().map(|upsert| return upsert.fingerprint), Some(1));
    let next = write_rx.try_recv().expect("the rows past the limit should stay queued");
    let rest = drain_writes(next, &mut write_rx);
    assert_eq!(rest.len(), 10);
    assert_eq!(rest.last().map(|upsert| return upsert.fingerprint), Some(backlog));
}
