//! What: entry point; boots a QGuiApplication + QQmlApplicationEngine and loads the QML UI.
//! Why: cxx-qt requires a QGuiApplication before any QObject exists; the engine then loads
//!      the qrc-embedded QML, which instantiates the Rust `AppBridge` QObject. This minimal
//!      shell proves the Rust <-> Qt/QtQuick pipeline and a native Wayland window before the
//!      directory model and drag-and-drop handlers land.

/// What: the cxx-qt bridge module holding the app's root QObject.
/// Why: declared here (not a separate lib) because this is a binary crate; build.rs points
///      at the same file so the C++ shim is generated.
pub mod cxxqt_object;

use cxx_qt_lib::{QGuiApplication, QQmlApplicationEngine, QUrl};

/// What: build the Qt application and QML engine, load the UI, and run the event loop.
/// Why: `QGuiApplication` owns the platform integration (the Wayland QPA plugin on this KWin
///      session); `QQmlApplicationEngine::load` resolves the module URI to the qrc path that
///      build.rs embedded; `exec` blocks until the last window closes.
fn main() {
    let mut app = QGuiApplication::new();
    let mut engine = QQmlApplicationEngine::new();

    if let Some(engine) = engine.as_mut() {
        engine.load(&QUrl::from(
            "qrc:/qt/qml/dev/monochromatic/file_manager/qml/main.qml",
        ));
    }

    if let Some(app) = app.as_mut() {
        app.exec();
    }
}
