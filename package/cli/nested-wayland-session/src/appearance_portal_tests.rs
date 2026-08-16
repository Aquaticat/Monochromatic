//! Focused tests for nested color-scheme portal isolation.

use super::*;

/// Confirms CLI accepts exact supported scheme names and rejects others.
#[test]
fn color_scheme_parser_accepts_dark_and_light() {
    assert_eq!(ColorSchemePreference::parse("dark").unwrap(), ColorSchemePreference::Dark);
    assert_eq!(ColorSchemePreference::parse("light").unwrap(), ColorSchemePreference::Light);
    assert!(ColorSchemePreference::parse("system").is_err());
}

/// Confirms real private bus serves Slint's `ReadOne` method and cleans up.
#[test]
fn private_portal_serves_light_scheme_without_host_bus() -> anyhow::Result<()> {
    let portal = AppearancePortal::start(ColorSchemePreference::Light)?;
    let directory = portal.bus.directory.clone();
    let connection = zbus::blocking::connection::Builder::address(portal.bus_address())?.build()?;
    let proxy = zbus::blocking::Proxy::new(
        &connection,
        PORTAL_BUS_NAME,
        PORTAL_OBJECT_PATH,
        "org.freedesktop.portal.Settings",
    )?;
    let value: OwnedValue = proxy.call("ReadOne", &(APPEARANCE_NAMESPACE, COLOR_SCHEME_KEY))?;
    assert_eq!(value.downcast_ref::<u32>()?, 2);
    drop(proxy);
    drop(connection);
    drop(portal);
    assert!(!directory.exists());
    Ok(())
}

/// Confirms standard `ReadAll` serves dark value for non-Slint portal clients.
#[test]
fn private_portal_serves_dark_scheme_through_read_all() -> anyhow::Result<()> {
    let portal = AppearancePortal::start(ColorSchemePreference::Dark)?;
    let connection = zbus::blocking::connection::Builder::address(portal.bus_address())?.build()?;
    let proxy = zbus::blocking::Proxy::new(
        &connection,
        PORTAL_BUS_NAME,
        PORTAL_OBJECT_PATH,
        "org.freedesktop.portal.Settings",
    )?;
    let values: HashMap<String, HashMap<String, OwnedValue>> =
        proxy.call("ReadAll", &Vec::<String>::new())?;
    let appearance = values
        .get(APPEARANCE_NAMESPACE)
        .context("ReadAll omitted appearance namespace")?;
    let value = appearance
        .get(COLOR_SCHEME_KEY)
        .context("ReadAll omitted color-scheme")?;
    assert_eq!(value.downcast_ref::<u32>()?, 1);
    Ok(())
}

/// Confirms unsupported settings return D-Bus errors instead of invented defaults.
#[test]
fn private_portal_rejects_unknown_setting() -> anyhow::Result<()> {
    let portal = AppearancePortal::start(ColorSchemePreference::Dark)?;
    let connection = zbus::blocking::connection::Builder::address(portal.bus_address())?.build()?;
    let proxy = zbus::blocking::Proxy::new(
        &connection,
        PORTAL_BUS_NAME,
        PORTAL_OBJECT_PATH,
        "org.freedesktop.portal.Settings",
    )?;
    let result = proxy.call::<_, _, OwnedValue>("ReadOne", &("org.example", "missing"));
    assert!(result.is_err());
    Ok(())
}
