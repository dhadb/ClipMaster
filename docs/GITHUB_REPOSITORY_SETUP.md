# GitHub Repository Setup

Use this checklist after pushing the repository updates. These settings improve discoverability and first-glance trust for new visitors.

## Description

```text
Local-first Windows clipboard manager with search, favorites, privacy filters, and image history.
```

## Website

```text
https://github.com/dhadb/ClipMaster/releases/latest
```

## Topics

Add these GitHub topics:

```text
clipboard-manager
windows
windows-app
electron
react
typescript
productivity
privacy
local-first
clipboard-history
```

## GitHub CLI

If GitHub CLI is authenticated, you can apply the description and topics with:

```bash
gh repo edit dhadb/ClipMaster \
  --description "Local-first Windows clipboard manager with search, favorites, privacy filters, and image history." \
  --homepage "https://github.com/dhadb/ClipMaster/releases/latest" \
  --add-topic clipboard-manager \
  --add-topic windows \
  --add-topic windows-app \
  --add-topic electron \
  --add-topic react \
  --add-topic typescript \
  --add-topic productivity \
  --add-topic privacy \
  --add-topic local-first \
  --add-topic clipboard-history
```
