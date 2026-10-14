//! A private D-Bus session bus and a recording `org.freedesktop.Notifications` service, for tests only.
//!
//! `PrivateBus::start` runs its own `dbus-daemon` on a socket in a scratch folder, so no test ever reaches the user's
//! session bus or notification service.
//! `Recorder` answers `Notify` and keeps every call, so a test can assert the exact arguments.

use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use zbus::blocking::{Connection, MessageIterator};
use zbus::zvariant::OwnedValue;

/// One recorded `Notify` call, reduced to what the tests assert.
#[derive(Clone, Debug, PartialEq)]
pub(crate) struct Call {
    pub app_name: String,
    pub replaces_id: u32,
    pub app_icon: String,
    pub summary: String,
    pub body: String,
    pub actions: Vec<String>,
    pub hint_names: Vec<String>,
    pub urgency: Option<u8>,
    pub desktop_entry: Option<String>,
    pub expire_timeout: i32,
}

/// The calls a recorder has seen, shared with the test.
pub(crate) type Calls = Arc<Mutex<Vec<Call>>>;

/// What the `Notify` call carries on the wire, in the order the specification gives.
type NotifyBody = (String, u32, String, String, String, Vec<String>, HashMap<String, OwnedValue>, i32);

/// Reduces a decoded `Notify` body to the fields the tests assert.
fn record(body: NotifyBody) -> Call {
    let (app_name, replaces_id, app_icon, summary, text, actions, hints, expire_timeout) = body;
    let mut hint_names: Vec<String> = hints.keys().cloned().collect();
    hint_names.sort();
    let urgency = hints.get("urgency").and_then(|value| return u8::try_from(value).ok());
    let desktop_entry = hints.get("desktop-entry").and_then(|value| return String::try_from(value.clone()).ok());
    return Call { app_name, replaces_id, app_icon, summary, body: text, actions, hint_names, urgency, desktop_entry, expire_timeout };
}

/// Answers `Notify` calls on `connection` until the bus goes away, recording each and replying with the call count
/// after `delay`, which simulates a wedged service when it is long.
fn answer_notify_calls(connection: &Connection, calls: &Calls, delay: Duration) {
    for received in MessageIterator::from(connection) {
        let Ok(message) = received else {
            return;
        };
        let header = message.header();
        if header.member().map(ToString::to_string).as_deref() != Some("Notify") {
            continue;
        }
        let Ok(body) = message.body().deserialize::<NotifyBody>() else {
            continue;
        };
        std::thread::sleep(delay);
        let id = {
            let mut recorded = calls.lock().expect("the recorded calls lock is not poisoned");
            recorded.push(record(body));
            u32::try_from(recorded.len()).expect("a test makes few calls")
        };
        if connection.reply(&header, &(id,)).is_err() {
            return;
        }
    }
}

/// A `dbus-daemon` on a private socket, killed and cleaned up on drop.
pub(crate) struct PrivateBus {
    child: Child,
    folder: PathBuf,
    pub address: String,
}

impl PrivateBus {
    /// Starts the daemon and reads its address.
    ///
    /// # Panics
    /// When `dbus-daemon` is not installed or does not print an address; the tests need it and say so.
    pub(crate) fn start(label: &str) -> PrivateBus {
        let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).expect("clock after 1970").as_nanos();
        let folder = std::env::temp_dir().join(format!("mp_bus_{label}_{}_{nanos}", std::process::id()));
        std::fs::create_dir_all(&folder).expect("the scratch folder is made");
        let config = folder.join("bus.conf");
        let text = format!(
            "<!DOCTYPE busconfig PUBLIC \"-//freedesktop//DTD D-Bus Bus Configuration 1.0//EN\" \
             \"http://www.freedesktop.org/standards/dbus/1.0/busconfig.dtd\">\n\
             <busconfig><type>session</type><listen>unix:dir={}</listen><auth>EXTERNAL</auth>\
             <policy context=\"default\"><allow send_destination=\"*\" eavesdrop=\"true\"/>\
             <allow eavesdrop=\"true\"/><allow own=\"*\"/></policy></busconfig>\n",
            folder.display()
        );
        std::fs::write(&config, text).expect("the bus config is written");
        let mut child = Command::new("dbus-daemon")
            .arg("--nofork")
            .arg("--print-address=1")
            .arg(format!("--config-file={}", config.display()))
            .stdout(Stdio::piped())
            .spawn()
            .expect("dbus-daemon must be installed to run the notification bus tests");
        let stdout = child.stdout.take().expect("the daemon's stdout is piped");
        let mut printed = String::new();
        BufReader::new(stdout).read_line(&mut printed).expect("the daemon prints its address");
        let address = printed.trim().to_string();
        assert!(address.starts_with("unix:"), "the private bus address is {address:?}");
        return PrivateBus { child, folder, address };
    }

    /// Connects a client to this bus with a bounded reply wait.
    pub(crate) fn connect(&self, timeout: Duration) -> zbus::Result<Connection> {
        return zbus::blocking::connection::Builder::address(self.address.as_str())?.method_timeout(timeout).build();
    }

    /// Starts a recording notification service on this bus and returns its connection and calls.
    pub(crate) fn serve_notifications(&self, delay: Duration) -> (Connection, Calls) {
        let calls: Calls = Arc::new(Mutex::new(Vec::new()));
        let connection = zbus::blocking::connection::Builder::address(self.address.as_str())
            .and_then(|builder| return builder.name("org.freedesktop.Notifications"))
            .and_then(|builder| return builder.build())
            .expect("the recording notification service starts");
        let serving = connection.clone();
        let recorded = Arc::clone(&calls);
        std::thread::spawn(move || answer_notify_calls(&serving, &recorded, delay));
        return (connection, calls);
    }
}

impl Drop for PrivateBus {
    fn drop(&mut self) {
        if let Err(error) = self.child.kill() {
            tracing::debug!(error = %error, "the private bus daemon was already gone");
        }
        if let Err(error) = self.child.wait() {
            tracing::debug!(error = %error, "the private bus daemon could not be waited for");
        }
        if let Err(error) = std::fs::remove_dir_all(&self.folder) {
            tracing::debug!(error = %error, "the private bus folder could not be removed");
        }
    }
}
