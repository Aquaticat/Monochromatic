//! What: Controls for the endpoint normalizer's current refusal.
//! Why: Until the selected URL owner and `fixtures/lfs-url-parity.json` exist, a declared endpoint
//! must fail loudly through every caller instead of producing an unverified base or a clean result.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // expect(() => lfsObjectBase('https://lfs.example')).toThrow(/no selected URL normalizer/);
//! ```

/// Import the normalizer and its callers.
use super::lfs_object_base;
use crate::markdown_lfs_config::{parse_lfs_config, read_lfs_object_base};
use crate::test_fs::Fixture;

/// The refusal names the endpoint and the missing owner.
#[test]
fn every_endpoint_is_refused_with_its_text() {
    let error = lfs_object_base("https://lfs:token@lfs.example/?x=1#y").expect_err("no normalizer");
    assert!(
        error
            .message
            .contains("https://lfs:token@lfs.example/?x=1#y")
    );
    assert!(error.message.contains("no selected URL normalizer"));
    assert_eq!(error.to_string(), error.message);
}

/// A configuration without endpoints never reaches the normalizer; one with an endpoint fails the read.
#[test]
fn a_declared_endpoint_fails_the_configuration_read() {
    assert_eq!(
        parse_lfs_config("[core]\nurl = https://x.example\n").expect("no endpoint"),
        Vec::<String>::new()
    );
    assert!(parse_lfs_config("[lfs]\nurl = https://lfs.example\n").is_err());
    let fixture: Fixture = Fixture::new();
    std::fs::write(
        fixture.path.join(".lfsconfig"),
        "[lfs]\n\turl = https://lfs.example\n",
    )
    .expect("configuration");
    let error = read_lfs_object_base(&fixture.path).expect_err("declared endpoint");
    assert!(error.message.contains(".lfsconfig"), "{}", error.message);
    assert!(
        error.message.contains("https://lfs.example"),
        "{}",
        error.message
    );
}
