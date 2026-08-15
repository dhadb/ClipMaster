# Changelog

## 2.0.1 - 2026-08-15

### Release engineering

- Added mandatory Windows Authenticode signing and signature verification to production releases.
- Added secure GitHub Actions PFX handling with temporary runner cleanup.
- Added code-signing setup and certificate rotation documentation.

## 2.0.0 - 2026-08-14

### Security

- Enabled a sandboxed renderer with navigation and window-open restrictions.
- Restricted sensitive IPC operations to the trusted application renderer.
- Added mandatory SHA256 verification for in-app installer downloads.

### Reliability

- Added persisted data schema versioning.
- Fixed backup rotation so the backup always represents the last known-good data file.
- Rejected non-object persisted data before applying it to application state.
- Centralized clipboard item and saved-filter types.
- Preserved HTML and RTF clipboard formats when capturing and copying entries.
- Added `is:pinned`, `is:favorite`, `has:image`, `has:html`, `has:rtf`, and `has:rich` search qualifiers.
- Recorded the source Windows application and added the `app:` search qualifier.

### Release engineering

- Updated the application and lockfile version to `2.0.0`.
- Repaired the legacy Windows installer batch script.
- Added a release checksum parser test.
