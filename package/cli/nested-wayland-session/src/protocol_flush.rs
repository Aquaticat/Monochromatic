//! End-of-dispatch protocol delivery is independent of GPU frame production.

/// The handle owns access to queued Wayland events without exposing compositor state.
use smithay::reexports::wayland_server::DisplayHandle;

/// Existing dispatch-cycle policy, extracted so a wire-level regression can exercise it.
/// The regression intentionally fails until this policy flushes pending client replies.
pub fn finish_dispatch(_display: &mut DisplayHandle) {}
