//! Private XDG Settings portal for deterministic nested dark and light scenes.

/// Imports setting maps returned by standard portal `ReadAll`.
use std::collections::HashMap;

/// What:
///      A grouped `use` of thread-safe primitives.
///  `Arc<T>` is a shared owner of one heap
///           value,
///  freed when its last owner goes away (siblings:
///  single-owner `Box<T>`,
///           single-thread `Rc<T>`).
///  `AtomicU32` is an integer cell several threads may read and write without a lock
///           (sibling: `Mutex<u32>`,
///  which locks).
///           `Ordering` selects how strictly those accesses are sequenced.
/// Why:
///       The D-Bus service thread reads the served value while the compositor thread
///           switches it,
///  so both need the same cell.
///  The shared bus is owned through an `Arc` too,
///  because the portal and the compositor both hold it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // Arc<AtomicU32> ~ a Uint32Array over a SharedArrayBuffer, used through Atomics.
/// ```
use std::sync::{
    atomic::{AtomicU32, Ordering},
    Arc,
};

/// The private bus this portal is served on, shared with the compositor.
use crate::private_bus::PrivateBus;

/// Imports shared error context and result channel.
use anyhow::{Context, Result};

/// What:
///      Import the blocking D-Bus connection and two variant types.
///  `OwnedValue` owns a
///           dynamically typed D-Bus value for method replies;
///  `Value` is the same wrapper
///           for a value serialized immediately,
///  here the signal body.
/// Why:
///       Portal settings travel as D-Bus variants,
///  so a typed integer must be wrapped.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Variant = { signature: string; value: unknown };
/// ```
use zbus::{
    blocking::Connection,
    zvariant::{OwnedValue, Value},
};

/// Stores portal well-known bus name.
const PORTAL_BUS_NAME: &str = "org.freedesktop.portal.Desktop";

/// Stores portal object path.
const PORTAL_OBJECT_PATH: &str = "/org/freedesktop/portal/desktop";

/// Stores Settings interface name used by method calls and the change signal.
const SETTINGS_INTERFACE: &str = "org.freedesktop.portal.Settings";

/// Stores signal name announcing one changed setting to subscribed toolkits.
const SETTING_CHANGED_SIGNAL: &str = "SettingChanged";

/// Stores appearance namespace read by desktop toolkits.
const APPEARANCE_NAMESPACE: &str = "org.freedesktop.appearance";

/// Stores color-scheme setting key.
const COLOR_SCHEME_KEY: &str = "color-scheme";

/// Requested isolated color scheme.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ColorSchemePreference {
    /// Dark portal value `1`.
    Dark,
    /// Light portal value `2`.
    Light,
}

/// Parses and encodes supported deterministic appearance values.
impl ColorSchemePreference {
    /// Parses CLI value accepted by `--color-scheme`.
    pub fn parse(value: &str) -> Result<Self> {
        if value == "dark" {
            return Ok(Self::Dark);
        }
        if value == "light" {
            return Ok(Self::Light);
        }
        anyhow::bail!("--color-scheme must be dark or light, got: {value}")
    }

    /// Returns XDG portal's stable unsigned color-scheme value.
    #[must_use]
    fn portal_value(self) -> u32 {
        match self {
            Self::Dark => return 1,
            Self::Light => return 2,
        }
    }
}

/// Result of asking the running private portal to serve a color scheme.
///
/// What:
///      `pub enum SwitchOutcome { Changed, Unchanged }`.
///  A closed set of two data-less
///           variants.
///  `#[derive(...)]` asks the compiler to generate copying,
///  debug printing,
///           and equality comparison for it.
/// Why:
///       The portal contract emits `SettingChanged` only when a setting changes,
///  so callers
///           need to know whether hosted clients were notified or nothing happened.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type SwitchOutcome = "changed" | "unchanged";
/// ```
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SwitchOutcome {
    /// The served value changed and one `SettingChanged` signal was emitted.
    Changed,
    /// The requested value was already served;
    ///  no signal was emitted.
    Unchanged,
}

/// Minimal Settings interface serving only deterministic appearance color scheme.
#[derive(Clone, Debug)]
struct PortalSettings {
    /// Portal value returned for appearance color-scheme reads;
    ///  runtime switches replace it.
    served_value: Arc<AtomicU32>,
}

/// Implements XDG Settings methods consumed by Slint and other toolkits.
#[zbus::interface(name = "org.freedesktop.portal.Settings")]
impl PortalSettings {
    /// Serves Slint's `ReadOne` compatibility method.
    #[zbus(name = "ReadOne")]
    fn read_one(&self, namespace: &str, key: &str) -> zbus::fdo::Result<OwnedValue> {
        return self.read_setting(namespace, key);
    }

    /// Serves standard XDG portal `Read` method.
    #[zbus(name = "Read")]
    fn read(&self, namespace: &str, key: &str) -> zbus::fdo::Result<OwnedValue> {
        return self.read_setting(namespace, key);
    }

    /// Serves standard XDG portal `ReadAll` method for appearance consumers.
    #[zbus(name = "ReadAll")]
    fn read_all(&self, namespaces: Vec<String>) -> HashMap<String, HashMap<String, OwnedValue>> {
        if !namespaces_match_appearance(&namespaces) {
            return HashMap::new();
        }
        return HashMap::from([(
            APPEARANCE_NAMESPACE.to_owned(),
            HashMap::from([(
                COLOR_SCHEME_KEY.to_owned(),
                OwnedValue::from(self.served_value.load(Ordering::SeqCst)),
            )]),
        )]);
    }
}

/// Shares setting lookup between standard and compatibility methods.
impl PortalSettings {
    /// Returns configured scheme or rejects unsupported setting reads.
    fn read_setting(&self, namespace: &str, key: &str) -> zbus::fdo::Result<OwnedValue> {
        if namespace == APPEARANCE_NAMESPACE && key == COLOR_SCHEME_KEY {
            return Ok(OwnedValue::from(self.served_value.load(Ordering::SeqCst)));
        }
        return Err(zbus::fdo::Error::NotSupported(format!(
            "nested appearance portal does not provide {namespace}/{key}",
        )));
    }
}

/// Returns whether portal namespace filters request appearance values.
fn namespaces_match_appearance(namespaces: &[String]) -> bool {
    if namespaces.is_empty() {
        return true;
    }
    return namespaces.iter().any(|namespace| {
        if namespace.is_empty() || namespace == "*" || namespace == APPEARANCE_NAMESPACE {
            return true;
        }
        if let Some(prefix) = namespace.strip_suffix('*') {
            return APPEARANCE_NAMESPACE.starts_with(prefix);
        }
        return false;
    });
}

/// Holds the Settings service on the private bus for the session lifetime.
pub struct AppearancePortal {
    /// Live zbus service connection owning the portal name,
    /// dropped before its bus.
    connection: Connection,
    /// Portal value shared with the Settings interface served on `connection`.
    served_value: Arc<AtomicU32>,
    /// Private bus shared with the launcher listener; kept alive while the portal is served.
    bus: Arc<PrivateBus>,
}

/// Starts portal service and exposes child-only bus address.
impl AppearancePortal {
    /// Serves deterministic Settings on an already started private bus.
    ///
    /// What:
    ///      `pub fn start(preference, bus: Arc<PrivateBus>) -> Result<Self>`.
    ///  The caller starts the bus once,
    ///  so the portal never starts a second daemon.
    /// Why:
    ///       `--color-scheme` and `--launcher-log` share one private bus.
    pub fn start(preference: ColorSchemePreference, bus: Arc<PrivateBus>) -> Result<Self> {
        // What:     `Arc::new(AtomicU32::new(...))` allocates one shared integer cell holding the
        //           initial portal value. `Arc::clone(&served_value)` creates a second owner of
        //           that same cell, not a copy of the number; `&` lends the first owner.
        // Why:      The service answers reads from the cell this handle later switches.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const servedValue = new Uint32Array(new SharedArrayBuffer(4));
        // const settings = { servedValue }; // same buffer, second reference
        // ```
        let served_value = Arc::new(AtomicU32::new(preference.portal_value()));
        let settings = PortalSettings { served_value: Arc::clone(&served_value) };
        let connection = zbus::blocking::connection::Builder::address(bus.address())?
            .name(PORTAL_BUS_NAME)?
            .serve_at(PORTAL_OBJECT_PATH, settings)?
            .build()
            .context("starting private XDG Settings portal")?;
        tracing::info!(?preference, "started isolated XDG appearance portal");
        return Ok(Self { connection, served_value, bus });
    }

    /// Serves `preference` from now on and notifies subscribed clients on the private bus.
    ///
    /// What:
    ///      `pub fn set_color_scheme(&self, preference: ColorSchemePreference) ->
    ///           Result<SwitchOutcome>`.
    ///  `&self` lends this handle read-only;
    ///  the shared cell
    ///           is still writable because atomics change through a shared reference.
    /// Why:
    ///       Toolkits such as Slint read the value once,
    ///  then follow `SettingChanged`.
    ///           The signal leaves on the connection that owns the portal name,
    ///  because
    ///           subscribers filter by that sender.
    ///  No other bus is ever opened here.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// setColorScheme(preference: ColorSchemePreference): SwitchOutcome {
    ///   const value = portalValue(preference);
    ///   const previous = Atomics.exchange(this.servedValue, 0, value);
    ///   if (previous === value) return "unchanged";
    ///   this.connection.emitSignal("SettingChanged", [namespace, key, variant(value)]);
    ///   return "changed";
    /// }
    /// ```
    pub fn set_color_scheme(&self, preference: ColorSchemePreference) -> Result<SwitchOutcome> {
        let value = preference.portal_value();
        // What:     `swap` stores the new value and returns the one it replaced, as one step.
        //           `Ordering::SeqCst` is the strictest sequencing: every thread sees one order.
        // Why:      Reads answered after this line already serve the value the signal announces.
        let previous = self.served_value.swap(value, Ordering::SeqCst);
        // The portal emits SettingChanged when a setting changes; repeating a value changes nothing.
        if previous == value {
            tracing::debug!(?preference, "isolated appearance already served; no signal emitted");
            return Ok(SwitchOutcome::Unchanged);
        }
        // What:     `emit_signal(destination, path, interface, member, body)`. `None::<&str>` is
        //           the absent destination, spelled with its type because nothing else names
        //           it; absence makes the signal a broadcast. `&(...)` lends a three-element
        //           tuple as the body. `Value::from(value)` wraps the integer in a variant, so
        //           the wire signature is `ssv`, not `ssu`.
        // Why:      Slint deserializes exactly (string, string, variant) and silently skips
        //           any other body shape.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const emitted = tryEmit(connection, undefined, path, iface, "SettingChanged", body);
        // ```
        let emitted = self.connection.emit_signal(
            None::<&str>,
            PORTAL_OBJECT_PATH,
            SETTINGS_INTERFACE,
            SETTING_CHANGED_SIGNAL,
            &(APPEARANCE_NAMESPACE, COLOR_SCHEME_KEY, Value::from(value)),
        );
        // What:     `if let Err(error) = emitted` runs the block only for the failure variant.
        // Why:      A switch nobody was told about is not a switch: restore the old value so a
        //           retry emits again instead of answering unchanged.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (emitted instanceof Error) { Atomics.store(this.servedValue, 0, previous); throw emitted; }
        // ```
        if let Err(error) = emitted {
            self.served_value.store(previous, Ordering::SeqCst);
            return Err(error).context("emitting SettingChanged on the private appearance bus");
        }
        tracing::info!(?preference, "switched isolated appearance and emitted SettingChanged");
        return Ok(SwitchOutcome::Changed);
    }

    /// Returns private session bus address for hosted-child environment.
    #[must_use]
    pub fn bus_address(&self) -> &str {
        return self.bus.address();
    }
}

/// Verifies parser and real private portal service.
#[cfg(test)]
#[path = "appearance_portal_tests.rs"]
mod tests;
