//! Cross-platform cache-root and content-key tests.

use super::{
    cache_location, resolve_cache_root, source_digest, CacheEnvironment, CacheRootError,
    HostPlatform,
};
use std::ffi::OsString;
use std::path::PathBuf;

/// Explicit absolute override wins under Unix and Windows target semantics.
#[test]
fn absolute_override_wins() {
    let unix_environment = CacheEnvironment {
        override_root: Some(OsString::from("/private/cache")),
        ..CacheEnvironment::default()
    };
    for platform in [HostPlatform::XdgUnix, HostPlatform::Macos] {
        assert_eq!(
            resolve_cache_root(&unix_environment, platform).expect("absolute override"),
            PathBuf::from("/private/cache"),
        );
    }

    let windows_environment = CacheEnvironment {
        override_root: Some(OsString::from("C:\\private\\cache")),
        ..CacheEnvironment::default()
    };
    assert_eq!(
        resolve_cache_root(&windows_environment, HostPlatform::Windows)
            .expect("Windows override"),
        PathBuf::from("C:\\private\\cache"),
    );
}

/// Relative explicit override is configuration error rather than cwd-relative cache.
#[test]
fn relative_override_is_rejected() {
    let environment = CacheEnvironment {
        override_root: Some(OsString::from("relative/cache")),
        ..CacheEnvironment::default()
    };
    assert_eq!(
        resolve_cache_root(&environment, HostPlatform::XdgUnix),
        Err(CacheRootError::InvalidOverride),
    );
}

/// XDG absolute value wins and relative value falls back to absolute HOME cache.
#[test]
fn xdg_resolution_follows_base_directory_spec() {
    let absolute = CacheEnvironment {
        xdg_cache_home: Some(OsString::from("/xdg/cache")),
        home: Some(OsString::from("/home/user")),
        ..CacheEnvironment::default()
    };
    assert_eq!(
        resolve_cache_root(&absolute, HostPlatform::XdgUnix).expect("XDG root"),
        PathBuf::from("/xdg/cache"),
    );

    let relative = CacheEnvironment {
        xdg_cache_home: Some(OsString::from("relative")),
        home: Some(OsString::from("/home/user")),
        ..CacheEnvironment::default()
    };
    assert_eq!(
        resolve_cache_root(&relative, HostPlatform::XdgUnix).expect("HOME fallback"),
        PathBuf::from("/home/user/.cache"),
    );
}

/// macOS and Windows use selected native environment roots.
#[test]
fn native_platform_roots_are_derived() {
    let environment = CacheEnvironment {
        home: Some(OsString::from("/Users/alice")),
        local_app_data: Some(OsString::from("C:\\Users\\alice\\AppData\\Local")),
        ..CacheEnvironment::default()
    };
    assert_eq!(
        resolve_cache_root(&environment, HostPlatform::Macos).expect("macOS root"),
        PathBuf::from("/Users/alice/Library/Caches"),
    );
    assert_eq!(
        resolve_cache_root(&environment, HostPlatform::Windows).expect("Windows root"),
        PathBuf::from("C:\\Users\\alice\\AppData\\Local"),
    );
}

/// Missing native root reports unavailable without exposing environment values.
#[test]
fn missing_native_root_is_unavailable() {
    assert_eq!(
        resolve_cache_root(&CacheEnvironment::default(), HostPlatform::XdgUnix),
        Err(CacheRootError::Unavailable),
    );
}

/// Exact source bytes select stable lowercase content-addressed artifact path.
#[test]
fn source_bytes_select_content_addressed_path() {
    let first = source_digest(b"alpha\n").expect("digest");
    let repeated = source_digest(b"alpha\n").expect("digest");
    let changed = source_digest(b"alpha").expect("digest");
    assert_eq!(first, repeated);
    assert_ne!(first, changed);

    let location = cache_location(&PathBuf::from("/cache"), first);
    let rendered = location.artifact_path.to_string_lossy();
    assert!(rendered.starts_with("/cache/forbidden-strings/v"));
    assert!(rendered.ends_with("/rules.bin"));
    let digest_component = location
        .artifact_path
        .parent()
        .and_then(|path| return path.file_name())
        .and_then(|name| return name.to_str())
        .expect("digest component");
    assert_eq!(digest_component.len(), 64);
    assert!(digest_component.chars().all(|character| return character.is_ascii_hexdigit()));
    assert_eq!(digest_component, digest_component.to_ascii_lowercase());
}
