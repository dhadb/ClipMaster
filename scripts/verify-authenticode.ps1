[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [ValidateNotNullOrEmpty()]
    [string]$Path = 'release'
)

$resolvedPath = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
$files = @(Get-ChildItem -LiteralPath $resolvedPath -Filter '*.exe' -File)

if ($files.Count -eq 0) {
    throw "No .exe files found under $resolvedPath"
}

$failed = $false
foreach ($file in $files) {
    $signature = Get-AuthenticodeSignature -LiteralPath $file.FullName
    $status = $signature.Status
    $subject = if ($signature.SignerCertificate) { $signature.SignerCertificate.Subject } else { '<none>' }
    Write-Host "$($file.Name): $status; signer=$subject"

    if ($status -ne [System.Management.Automation.SignatureStatus]::Valid) {
        $failed = $true
        Write-Error "$($file.Name) does not have a valid Authenticode signature: $($signature.StatusMessage)"
    }
}

if ($failed) {
    throw 'One or more release executables failed Authenticode verification.'
}
