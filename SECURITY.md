# Security Policy

## Supported Versions

Security fixes are provided for the latest public release.

| Version | Supported |
| --- | --- |
| 2.x | Yes |
| 1.x | Security fixes only |

## Reporting a Vulnerability

If you find a security issue, please do not publish exploit details before maintainers have had time to respond.

Report it through one of these channels:

- Open a GitHub issue with a clear description if the issue is not sensitive.
- If the issue includes sensitive exploit details, contact the repository owner privately through GitHub profile contact information.

Please include:

- Affected version
- Windows version
- Steps to reproduce
- Expected behavior
- Actual behavior
- Any relevant logs or screenshots

## Installer Verification

Official release assets are published on GitHub Releases:

https://github.com/dhadb/ClipMaster/releases

Each release should include `checksums.sha256`. After downloading the installer, verify it in PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 ".\ClipMaster-Setup-2.1.2.exe"
```

The in-app updater also verifies the SHA256 value against the checksum asset for the same release before allowing installation. Authenticode signing is prepared for a future release; see [docs/CODE_SIGNING.md](docs/CODE_SIGNING.md) for certificate and GitHub Actions setup.

Compare the output with `checksums.sha256`. If the hash does not match, do not run the installer.

## Known Limitations

- Current Windows installers are unsigned, so Windows SmartScreen can show a warning.
- Clipboard managers process sensitive user data by nature. ClipMaster skips common sensitive patterns by default, but no pattern-based detection can be perfect.
- Only download installers from this repository's GitHub Releases.
