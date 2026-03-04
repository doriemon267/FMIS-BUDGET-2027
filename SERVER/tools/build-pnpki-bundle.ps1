param(
    [string[]]$Inputs,

    [string]$OutputPath,

    [switch]$VerifyAfterBuild
)

$ErrorActionPreference = 'Stop'

if (-not $Inputs -or $Inputs.Count -eq 0) {
    Write-Host 'Usage:' -ForegroundColor Yellow
    Write-Host '  powershell -ExecutionPolicy Bypass -File ./tools/build-pnpki-bundle.ps1 -Inputs "C:\certs\Root.cer","C:\certs\Intermediate.cer" -VerifyAfterBuild'
    Write-Host '  npm run pnpki:build-bundle:ps -- -Inputs "C:\certs\Root.cer","C:\certs\Intermediate.cer" -VerifyAfterBuild'
    exit 1
}

function Split-PemBlocks {
    param([string]$PemText)

    if (-not $PemText) { return @() }
    $regex = '-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----'
    $matches = [System.Text.RegularExpressions.Regex]::Matches($PemText, $regex)
    $blocks = @()
    foreach ($m in $matches) {
        $blocks += $m.Value
    }
    return $blocks
}

function Convert-DerToPemBlock {
    param([byte[]]$RawBytes)

    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 -ArgumentList (, $RawBytes)
    $base64 = [Convert]::ToBase64String($cert.RawData)
    $wrapped = ($base64 -split '(.{1,64})' | Where-Object { $_ -and $_ -ne '' }) -join "`n"
    $pem = "-----BEGIN CERTIFICATE-----`n$wrapped`n-----END CERTIFICATE-----"
    return @($pem)
}

function Get-CertificatePemBlocksFromFile {
    param([string]$FilePath)

    if (-not (Test-Path $FilePath)) {
        throw "Input file not found: $FilePath"
    }

    $rawBytes = [System.IO.File]::ReadAllBytes($FilePath)
    $text = [System.Text.Encoding]::UTF8.GetString($rawBytes)
    $pemBlocks = Split-PemBlocks -PemText $text
    if ($pemBlocks.Count -gt 0) {
        return $pemBlocks
    }

    return Convert-DerToPemBlock -RawBytes $rawBytes
}

function Get-EnvValue {
    param([string]$EnvFilePath, [string]$Key)

    if (-not (Test-Path $EnvFilePath)) { return $null }
    $line = Get-Content $EnvFilePath | Where-Object { $_ -match "^\s*$Key\s*=" } | Select-Object -First 1
    if (-not $line) { return $null }
    return ($line -split '=', 2)[1].Trim()
}

Write-Host 'PNPKI Bundle Builder (PowerShell helper)' -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverRoot = Resolve-Path (Join-Path $scriptDir '..')
Set-Location $serverRoot

$envFile = Join-Path $serverRoot '.env'
if (-not $OutputPath) {
    $fromEnv = Get-EnvValue -EnvFilePath $envFile -Key 'PNPKI_TRUST_BUNDLE_PATH'
    if ($fromEnv) {
        $OutputPath = $fromEnv
    }
}

if (-not $OutputPath) {
    $OutputPath = Join-Path $serverRoot 'certs\pnpki-trust-bundle.pem'
}

$resolvedOutput = [System.IO.Path]::GetFullPath((Join-Path $serverRoot $OutputPath))
$outputDir = Split-Path -Parent $resolvedOutput
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$allBlocks = @()
foreach ($input in $Inputs) {
    $resolvedInput = [System.IO.Path]::GetFullPath((Join-Path $PWD.Path $input))
    Write-Host "Reading certificate: $resolvedInput" -ForegroundColor DarkGray
    $blocks = Get-CertificatePemBlocksFromFile -FilePath $resolvedInput
    $allBlocks += $blocks
}

if ($allBlocks.Count -eq 0) {
    throw 'No certificates were extracted from input files.'
}

# Deduplicate by certificate fingerprint
$seen = New-Object 'System.Collections.Generic.HashSet[string]'
$uniqueBlocks = @()
foreach ($pem in $allBlocks) {
    $base64 = ($pem -replace '-----BEGIN CERTIFICATE-----', '' -replace '-----END CERTIFICATE-----', '' -replace '\s', '')
    $bytes = [Convert]::FromBase64String($base64)
    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 -ArgumentList (, $bytes)
    $fp = $cert.Thumbprint
    if (-not $seen.Contains($fp)) {
        $seen.Add($fp) | Out-Null
        $uniqueBlocks += $pem
    }
}

$bundleContent = ($uniqueBlocks -join "`n") + "`n"
[System.IO.File]::WriteAllText($resolvedOutput, $bundleContent)

Write-Host "Bundle written: $resolvedOutput" -ForegroundColor Green
Write-Host "Certificates in bundle: $($uniqueBlocks.Count)" -ForegroundColor Green

if ($VerifyAfterBuild) {
    $verifyScript = Join-Path $scriptDir 'verify-pnpki.ps1'
    if (Test-Path $verifyScript) {
        Write-Host 'Running verification...' -ForegroundColor Cyan
        & $verifyScript
    }
}
