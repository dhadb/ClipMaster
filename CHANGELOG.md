# Changelog

## 3.1.0 - 2026-08-18

### Features

- Added a spring-based interaction pass: cards gently lift and settle, controls have tactile press feedback, list content lands with a soft bounce, and Clipboard Stack changes animate as a coherent surface.
- Added the Clipboard Stack: queue multiple history entries from individual cards or multi-select, then copy the next entry in order as you work through a form, reply, or repeatable task.
- Made the stack intentionally transient: it stays out of saved clipboard history and encrypted storage, and automatically removes entries that no longer exist.

### Security

- Applied the trusted-renderer check to IPC reads that return clipboard history, settings, data-encryption status, image data, and image-cache operations.

### Quality

- Added store tests for queue ordering, duplicate prevention, stale queue cleanup, and copying the next queued item.

## 2.1.2 - 2026-08-15

### Fixed

- Removed renderer manual chunking that created a React initialization cycle and left the application window transparent with an empty root element.

## 2.1.1 - 2026-08-15

### Fixed

- Show and focus the main window after the first renderer-ready startup instead of leaving a newly launched app hidden in the tray.

## 2.1.0 - 2026-08-15

### Features

- Added Windows file-list clipboard history, `has:files` search, per-file Explorer reveal actions, and local-file exclusion from text metadata backups.
- Raised the default history capacity to 1000 entries and the configurable/import limit to 5000 entries; added a reusable search index and bounded query-result cache.
- Added application privacy policies that prevent text, image, and file captures from configured Windows applications.
- Added independent credential, payment-card, and Chinese identity-number privacy controls.
- Added smart collections for saved search, type, time, and sort combinations with dynamic result counts.

### Updates

- Added in-app release notes after update checks, sourced from validated official GitHub Release metadata.
- Added bounded plain-text release notes rendering with Chinese and English fallback messages.

### Reliability

- Added a GitHub Release API parser that validates repository URLs, tag/version consistency, publication timestamps, and release-note size limits.
- Preserved the existing public Release page as an automatic fallback when the GitHub API is unavailable, rate-limited, or returns an invalid payload.
- Added tests for trusted release payloads, rejected repository/version mismatches, newline normalization, and release-note length limits.

### Release engineering

- Updated application metadata, CI version gates, documentation, and download examples for `v2.1.0`.
- Kept Windows Authenticode signing opt-in so this release can ship unsigned while certificate provisioning remains deferred.

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
