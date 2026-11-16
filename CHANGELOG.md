# Changelog

## 5.1.0 - 2026-11-16

### Security and data protection

- Hardened in-app navigation to a strict allowlist (the app entry document only), with redirects and webview attachment blocked, so injected local pages can no longer reach the IPC bridge.
- Encrypted clipboard images at rest with DPAPI, backward compatible with existing plaintext images.
- Tightened the production CSP by removing `unsafe-inline` scripts and localhost development origins; dev-only origins are now injected by the Vite dev-server plugin.
- Restricted `show-file-in-folder` to paths recorded in clipboard history or inside the image cache, and resolved image paths with realpath checks to resist symlink escapes.
- Capped history import batches by aggregate byte budget and regenerate imported record IDs on import.
- Added circuit breaking for user-supplied regex ignore rules (subject cap, per-match timing, automatic disabling) and stale temp-file cleanup on quit.

### Reliability

- Automatically rebuild the main window after a renderer crash (with a crash-loop circuit breaker), alert on an unresponsive UI, flush pending saves on fatal errors, and surface startup failures.
- Added an uninstall-time prompt to optionally remove clipboard data; data is kept by default.

### Accessibility and UI

- Unified dialog and menu ARIA semantics with focus trapping and restoration, and added listbox semantics plus labels for clipboard rows.
- Added plural-aware i18n messages and safer fallbacks for unknown record types.
- Split image thumbnail and detail caches so large previews no longer evict list thumbnails.

### Engineering

- Split the 2,560-line Electron main process into domain services with a typed IPC contract (single source of truth for 34 invoke channels and 8 events) and injectable ports; added contract tests.
- Added CI gates for lint, coverage reporting, dependency audits, Actions SHA pinning, and lockfile/overrides consistency.
- Upgraded to React 19.3, zustand 5.1, date-fns 4.4, and lucide-react 1.73.
- Added component behavior tests for BulkActionBar, SearchBar, UpdateBanner, and QuickAddDialog (156 tests total).

## 5.0.0 - 2026-09-06

### Quick Paste Workspace

- Added two focused work modes: compact Quick Paste for global shortcut workflows and a wider Library workspace for managing clipboard knowledge.
- Added a persistent workspace rail for History, Favorites, Collections, Stats, and Settings, with a dedicated mode switch in the title bar.
- Added a contextual content inspector with full preview, copy, pin, favorite, open-link, metadata, source application, workspace, and tag actions.
- Made library clicks select and inspect records without triggering a paste; keyboard Enter and Alt+number shortcuts now paste only in Quick Paste mode.

### Window behavior and quality

- Made mode-based window sizing display-aware, including taskbar work areas, multi-monitor coordinates, and constrained small displays.
- Resize the window before it is shown to avoid visible jumps when opening a workspace.
- Improved keyboard accessibility for the title-bar home control and added workspace-mode store coverage.

## 4.0.0 - 2026-09-06

### Visual system

- Reworked the default visual language around the graphite theme, Windows-native typography, flatter content surfaces, restrained borders, and clearer information hierarchy.
- Reduced glass and blur usage to the app shell, dialogs, and menus so dense clipboard history remains readable.
- Simplified card actions around a single copy action with a compact more-actions menu for pinning, favoriting, stacking, and deletion.

### Motion and feedback

- Replaced full-card copied overlays with a local success rail and copy-icon confirmation that preserves the content being reviewed.
- Added a one-shot current-item transition for Clipboard Stack progress without repeatedly animating the entire queue.
- Removed decorative floating, pulse, rotation, and mobile-style ripple effects from normal desktop workflows.
- Kept short enter, dialog, focus, and state transitions and honored reduced-motion preferences.

### Reliability and privacy

- Prevented damaged primary data from overwriting a healthy backup after backup recovery.
- Updated paused monitoring baselines so clipboard content copied during a privacy pause is not recorded when monitoring resumes.
- Included HTML, RTF, and file paths in sensitive-content scanning and retention-budget calculations.
- Added stricter renderer and Node-side type checking to the release checks.

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
