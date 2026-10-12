//! Which fake desktop notification services a session serves on its private bus.

/// The `--notifications` choices.
///
/// What:
///      `pub enum NotificationMode { None, Freedesktop, Kde }`.
///  `None` is the default and serves nothing,
///  so a client's call gets `ServiceUnknown`.
/// Why:
///       Plasma serves the freedesktop service and its job view server from one process,
///  so the second mode adds the job view server on top of the first.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum NotificationMode {
    /// No notification or job service.
    #[default]
    None,
    /// A recording `org.freedesktop.Notifications`.
    Freedesktop,
    /// The freedesktop service plus the Plasma job view server `org.kde.kuiserver`.
    Kde,
}

/// Parsing the option value and asking what a mode serves.
impl NotificationMode {
    /// Parses the `--notifications` value:
    ///  `none`,
    ///  `freedesktop`,
    ///  or `kde`.
    pub fn parse(value: &str) -> anyhow::Result<Self> {
        return match value {
            "none" => Ok(Self::None),
            "freedesktop" => Ok(Self::Freedesktop),
            "kde" => Ok(Self::Kde),
            other => anyhow::bail!("--notifications must be none, freedesktop, or kde, got: {other}"),
        };
    }

    /// Tells whether the mode serves `org.freedesktop.Notifications`.
    #[must_use]
    pub fn serves_notifications(self) -> bool {
        return self != Self::None;
    }

    /// Tells whether the mode serves the Plasma job view server.
    #[must_use]
    pub fn serves_jobs(self) -> bool {
        return self == Self::Kde;
    }
}

/// Unit tests for the option value.
#[cfg(test)]
mod tests {
    /// Brings the mode into scope.
    use super::NotificationMode;

    /// The three spellings parse and anything else is refused with the choices named.
    #[test]
    fn parses_exactly_the_three_spellings() {
        assert_eq!(NotificationMode::parse("none").unwrap(), NotificationMode::None);
        assert_eq!(NotificationMode::parse("freedesktop").unwrap(), NotificationMode::Freedesktop);
        assert_eq!(NotificationMode::parse("kde").unwrap(), NotificationMode::Kde);
        for bad in ["", "KDE", "plasma", "freedesktop,kde", "none "] {
            let message = NotificationMode::parse(bad).unwrap_err().to_string();
            assert!(message.contains("none, freedesktop, or kde"), "{bad:?}: {message}");
        }
    }

    /// Each mode serves what the README says.
    #[test]
    fn modes_serve_the_documented_services() {
        assert!(!NotificationMode::None.serves_notifications());
        assert!(NotificationMode::Freedesktop.serves_notifications());
        assert!(!NotificationMode::Freedesktop.serves_jobs());
        assert!(NotificationMode::Kde.serves_notifications() && NotificationMode::Kde.serves_jobs());
        assert_eq!(NotificationMode::default(), NotificationMode::None);
    }
}
