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

Write-Host "Node: $(node --version)"
Write-Host "npm:  $(npm --version)"

for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
  Write-Host "Installing dependencies (attempt $attempt of $MaxAttempts)..."
  $installOutput = @(& npm @installArguments 2>&1)
  $installExitCode = $LASTEXITCODE
  $installOutput | ForEach-Object { Write-Host $_ }

  if ($installExitCode -eq 0) {
    exit 0
  }

  if ($attempt -eq $MaxAttempts) {
    Write-Host "::error::npm ci failed after $MaxAttempts attempts (exit code $installExitCode). Last output:"
    $installOutput | Select-Object -Last 60 | ForEach-Object {
      $line = ([string]$_).Replace('%', '%25').Replace("`r", '%0D').Replace("`n", '%0A')
      Write-Host "::error::$line"
    }
    exit $installExitCode
  }

  Write-Warning "npm ci failed with exit code $installExitCode. Clearing the cache before retrying."
  npm cache clean --force
  Start-Sleep -Seconds (15 * $attempt)
}
