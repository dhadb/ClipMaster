# Privacy

ClipMaster is a local-first Windows clipboard manager. It does not include a cloud service and does not upload, sync, sell, or analyze your clipboard content.

When Windows provides Electron `safeStorage`, ClipMaster encrypts the persisted history and settings. If the operating system cannot provide that facility, the app reports the degraded storage state and local files may remain unencrypted.

## What ClipMaster Stores

ClipMaster stores the data needed to provide clipboard history and app preferences:

- Clipboard history entries, including local file-list paths when you copy files
- Favorite status
- App settings, including optional blocked-application names and privacy rule choices
- Image cache files
- Local usage statistics shown inside the app

Text metadata exports intentionally exclude images and local file-list records.

By default, this data is stored locally under:

```text
%AppData%/ClipMaster/
```

## What ClipMaster Does Not Do

ClipMaster does not:

- Upload clipboard content to a server
- Sync clipboard history across devices
- Send analytics about clipboard content
- Use third-party tracking scripts inside the app
- Sell or share clipboard data

## Sensitive Content

ClipMaster includes default safeguards that skip suspected credentials, tokens, private keys, payment-card numbers, and Chinese identity numbers. You can independently toggle credential, payment-card, and identity-number detection in Settings. These rules are best-effort protections and should not replace your own security practices.

You can also add Windows process names to the application privacy policy. While a listed application is active, its text, images, and file lists are not added to history. If you need to copy highly sensitive temporary content, pause clipboard monitoring or clear recent history after use.

## Clearing Data

You can clear clipboard history from inside the app. You can also remove stored data manually from:

```text
%AppData%/ClipMaster/
```

## Questions

If you notice unexpected data storage or privacy behavior, please open an issue:

https://github.com/dhadb/ClipMaster/issues
