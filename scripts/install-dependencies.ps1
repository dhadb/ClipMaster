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

# GitHub Actions invokes PowerShell with ErrorActionPreference=Stop. Native npm
# failures must reach the retry loop as exit codes instead of terminating here.
$ErrorActionPreference = 'Continue'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}

Write-Host "Node: $(node --version)"
Write-Host "npm:  $(npm --version)"

for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
  Write-Host "Installing dependencies (attempt $attempt of $MaxAttempts)..."
  npm @installArguments
  $installExitCode = $LASTEXITCODE

  if ($installExitCode -eq 0) {
    exit 0
  }

  if ($attempt -eq $MaxAttempts) {
    Write-Error "npm ci failed after $MaxAttempts attempts (exit code $installExitCode)."
    exit $installExitCode
  }

  Write-Warning "npm ci failed with exit code $installExitCode. Clearing the cache before retrying."
  npm cache clean --force
  Start-Sleep -Seconds (15 * $attempt)
}
