# Privacy

ClipMaster is a local-first Windows clipboard manager. It does not include a cloud service and does not upload, sync, sell, or analyze your clipboard content.

## What ClipMaster Stores

ClipMaster stores the data needed to provide clipboard history and app preferences:

- Clipboard history entries
- Favorite status
- App settings
- Image cache files
- Local usage statistics shown inside the app

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

ClipMaster includes default safeguards that skip high-risk content such as suspected passwords, tokens, private keys, and card numbers. These rules are best-effort protections and should not replace your own security practices.

If you need to copy highly sensitive temporary content, you can pause clipboard monitoring or clear recent history after use.

## Clearing Data

You can clear clipboard history from inside the app. You can also remove stored data manually from:

```text
%AppData%/ClipMaster/
```

## Questions

If you notice unexpected data storage or privacy behavior, please open an issue:

https://github.com/dhadb/ClipMaster/issues
