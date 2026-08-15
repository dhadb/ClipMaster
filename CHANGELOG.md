# Changelog

## 2.0.2 - 2026-08-15

### Performance

- Deferred loading of settings, statistics, clipboard detail, and quick-add panels to reduce the initial renderer bundle.
- Split framework, icon, pinyin-search, and date dependencies into cacheable renderer chunks.

### Release engineering

- Upgraded GitHub Actions runtime dependencies to their Node 24-compatible major versions.

## 2.0.1 - 2026-08-15

### Release engineering

- Added reusable Windows Authenticode signing and signature-verification tooling for a future signed release.
- Published this release unsigned while certificate provisioning is deferred.

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
