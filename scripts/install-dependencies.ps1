[CmdletBinding()]
param(
  [ValidateRange(1, 5)]
  [int]$MaxAttempts = 3
)

$installArguments = @(
  "ci",
  "--no-audit",
  "--fund=false",
  "--registry=https://registry.npmjs.org"
)

for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
  Write-Host "Installing dependencies (attempt $attempt of $MaxAttempts)..."
  npm @installArguments
  $installExitCode = $LASTEXITCODE

  if ($installExitCode -eq 0) {
    exit 0
  }

  if ($attempt -eq $MaxAttempts) {
    exit $installExitCode
  }

  Write-Warning "npm ci failed with exit code $installExitCode. Clearing the cache before retrying."
  npm cache clean --force
  Start-Sleep -Seconds (15 * $attempt)
}
