//! Grammar,
//!  packing,
//!  and portal form of the accent color.

/// Brings the color type into scope.
use super::*;

/// Both letter cases parse,
///  and the display form is upper case.
#[test]
fn parses_six_hex_digits_in_either_case() {
    assert_eq!(AccentColor::parse("1A2b3C").unwrap().to_string(), "1A2B3C");
    assert_eq!(AccentColor::parse("000000").unwrap().pack(), 0);
    assert_eq!(AccentColor::parse("FFFFFF").unwrap().pack(), 0x00FF_FFFF);
}

/// Anything but exactly six hex digits is refused with the value named.
#[test]
fn refuses_other_spellings() {
    for text in ["", "FFF", "#FF0000", "FF00000", "GG0000", "FF 000", "ff00ff00", "ÿÿÿ", "FF000\n"] {
        let message = AccentColor::parse(text).expect_err(text);
        assert!(message.contains("RRGGBB"), "{text:?}: {message}");
        assert!(message.ends_with(text), "{text:?}: {message}");
    }
}

/// Packing and unpacking round-trip every channel.
#[test]
fn pack_round_trips() {
    let color = AccentColor::parse("3584E4").unwrap();
    assert_eq!(AccentColor::unpack(color.pack()), color);
    assert_ne!(AccentColor::parse("3584E5").unwrap(), color);
}

/// The portal form divides each channel by 255.
#[test]
fn portal_value_maps_channels_into_the_unit_range() {
    assert_eq!(AccentColor::parse("FF0000").unwrap().portal_value(), (1.0, 0.0, 0.0));
    let (red, green, blue) = AccentColor::parse("336699").unwrap().portal_value();
    assert_eq!((red * 255.0).round() as u8, 0x33);
    assert_eq!((green * 255.0).round() as u8, 0x66);
    assert_eq!((blue * 255.0).round() as u8, 0x99);
}
