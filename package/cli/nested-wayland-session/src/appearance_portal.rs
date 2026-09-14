//! Private XDG Settings portal for deterministic nested dark and light scenes.

/// Imports setting maps returned by standard portal `ReadAll`.
use std::collections::HashMap;

/// Imports buffered address read from `dbus-daemon` stdout.
use std::io::{BufRead, BufReader};

/// Imports owned scratch paths for private bus socket and cleanup.
use std::path::PathBuf;

/// Imports private-bus process and pipe construction.
use std::process::{Child, ChildStdout, Command, Stdio};

/// Imports unique fixture sequence and address-reader channel.
use std::sync::{
    atomic::{AtomicU64, Ordering},
    mpsc,
};

/// Imports bounded startup duration for private daemon address.
use std::time::Duration;

/// Imports shared error context and result channel.
use anyhow::{Context, Result};

/// Imports zbus blocking service builder and owned variant value.
use zbus::{blocking::Connection, zvariant::OwnedValue};

/// Stores portal well-known bus name.
const PORTAL_BUS_NAME: &str = "org.freedesktop.portal.Desktop";

/// Stores portal object path.
const PORTAL_OBJECT_PATH: &str = "/org/freedesktop/portal/desktop";

/// Stores appearance namespace read by desktop toolkits.
const APPEARANCE_NAMESPACE: &str = "org.freedesktop.appearance";

/// Stores color-scheme setting key.
const COLOR_SCHEME_KEY: &str = "color-scheme";

/// Bounds time spent waiting for private bus startup address.
const PRIVATE_BUS_ADDRESS_TIMEOUT: Duration = Duration::from_secs(2);

/// Produces collision-free paths when tests start more than one private bus.
static PRIVATE_BUS_SEQUENCE: AtomicU64 = AtomicU64::new(0);

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

/// Minimal Settings interface serving only deterministic appearance color scheme.
#[derive(Clone, Copy, Debug)]
struct PortalSettings {
    /// Value returned for appearance color-scheme reads.
    preference: ColorSchemePreference,
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
                OwnedValue::from(self.preference.portal_value()),
            )]),
        )]);
    }
}

/// Shares setting lookup between standard and compatibility methods.
impl PortalSettings {
    /// Returns configured scheme or rejects unsupported setting reads.
    fn read_setting(&self, namespace: &str, key: &str) -> zbus::fdo::Result<OwnedValue> {
        if namespace == APPEARANCE_NAMESPACE && key == COLOR_SCHEME_KEY {
            return Ok(OwnedValue::from(self.preference.portal_value()));
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

/// Reads one printed private-bus address from daemon stdout.
fn read_bus_address(stdout: ChildStdout) -> std::io::Result<String> {
    let mut address = String::new();
    BufReader::new(stdout).read_line(&mut address)?;
    return Ok(address);
}

/// Owns private message-bus daemon and scratch directory.
#[derive(Debug)]
struct PrivateBus {
    /// Running `dbus-daemon --session --nofork` process.
    daemon: Child,
    /// Scratch directory containing bus socket.
    directory: PathBuf,
    /// Address inherited by hosted client.
    address: String,
}

/// Starts isolated message bus used only by hosted client.
impl PrivateBus {
    /// Starts isolated session bus and reads its printed address.
    fn start() -> Result<Self> {
        let sequence = PRIVATE_BUS_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let directory = std::env::temp_dir().join(format!(
            "monochromatic-nested-wayland-session-{}-{sequence}",
            std::process::id(),
        ));
        std::fs::create_dir(&directory)
            .with_context(|| format!("creating private D-Bus directory: {}", directory.display()))?;
        let socket_path = directory.join("bus");
        let daemon = Command::new("dbus-daemon")
            .arg("--session")
            .arg("--nofork")
            .arg("--nopidfile")
            .arg("--nosyslog")
            .arg("--print-address=1")
            .arg(format!("--address=unix:path={}", socket_path.display()))
            .stdout(Stdio::piped())
            .spawn()
            .inspect_err(|_error| {
                if let Err(cleanup_error) = std::fs::remove_dir_all(&directory) {
                    tracing::warn!(
                        %cleanup_error,
                        path = %directory.display(),
                        "failed to clean private D-Bus directory after spawn error",
                    );
                }
            })
            .context("starting private dbus-daemon for nested color scheme")?;
        let mut bus = Self { daemon, directory, address: String::new() };
        let stdout = bus
            .daemon
            .stdout
            .take()
            .context("private dbus-daemon did not expose address output")?;
        let (sender, receiver) = mpsc::sync_channel(1);
        let reader = std::thread::Builder::new()
            .name("nested-bus-address".to_owned())
            .spawn(move || {
                if sender.send(read_bus_address(stdout)).is_err() {
                    tracing::warn!("private D-Bus address receiver ended before reader");
                }
            })
            .context("starting private D-Bus address reader")?;
        let received = receiver.recv_timeout(PRIVATE_BUS_ADDRESS_TIMEOUT);
        if let Err(error) = &received {
            bus.stop();
            if reader.join().is_err() {
                tracing::warn!("private D-Bus address reader panicked during cleanup");
            }
            anyhow::bail!("private dbus-daemon did not provide its address in time: {error}")
        }
        let address_result = received.context("receiving private dbus-daemon address")?;
        if reader.join().is_err() {
            anyhow::bail!("private D-Bus address reader panicked")
        }
        let address = address_result.context("reading private dbus-daemon address")?;
        bus.address = address.trim().to_owned();
        if bus.address.is_empty() {
            anyhow::bail!("private dbus-daemon returned an empty address")
        }
        return Ok(bus);
    }

    /// Stops and reaps daemon without warning when it already exited.
    fn stop(&mut self) {
        let status = self.daemon.try_wait();
        if matches!(status, Ok(None)) {
            if let Err(error) = self.daemon.kill() {
                tracing::warn!(%error, "failed to stop private dbus-daemon");
            }
        } else if let Err(error) = status {
            tracing::warn!(%error, "failed to inspect private dbus-daemon status");
        }
        if let Err(error) = self.daemon.wait() {
            tracing::warn!(%error, "failed to reap private dbus-daemon");
        }
    }
}

/// Cleans up daemon and scratch socket even when portal setup fails.
impl Drop for PrivateBus {
    /// Stops private daemon and removes socket directory.
    fn drop(&mut self) {
        self.stop();
        if let Err(error) = std::fs::remove_dir_all(&self.directory) {
            tracing::warn!(%error, path = %self.directory.display(), "failed to remove private D-Bus directory");
        }
    }
}

/// Holds isolated bus and Settings service for hosted-client lifetime.
pub struct AppearancePortal {
    /// Live zbus service connection,
    /// dropped before its bus.
    _connection: Connection,
    /// Private bus lifetime owner.
    bus: PrivateBus,
}

/// Starts portal service and exposes child-only bus address.
impl AppearancePortal {
    /// Starts private session bus and deterministic Settings service.
    pub fn start(preference: ColorSchemePreference) -> Result<Self> {
        let bus = PrivateBus::start()?;
        let connection = zbus::blocking::connection::Builder::address(bus.address.as_str())?
            .name(PORTAL_BUS_NAME)?
            .serve_at(PORTAL_OBJECT_PATH, PortalSettings { preference })?
            .build()
            .context("starting private XDG Settings portal")?;
        tracing::info!(?preference, "started isolated XDG appearance portal");
        return Ok(Self { bus, _connection: connection });
    }

    /// Returns private session bus address for hosted-child environment.
    #[must_use]
    pub fn bus_address(&self) -> &str {
        return self.bus.address.as_str();
    }
}

/// Verifies parser and real private portal service.
#[cfg(test)]
#[path = "appearance_portal_tests.rs"]
mod tests;
