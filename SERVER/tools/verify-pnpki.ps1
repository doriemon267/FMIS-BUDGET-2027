param(
    [string]$Leaf,
    [string]$Chain
)

$ErrorActionPreference = 'Stop'

Write-Host 'PNPKI Bundle Verifier (PowerShell helper)' -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverRoot = Resolve-Path (Join-Path $scriptDir '..')
Set-Location $serverRoot

$nodeScript = Join-Path $scriptDir 'verifyPnpkiBundle.js'
if (-not (Test-Path $nodeScript)) {
    throw "Cannot find verifier script: $nodeScript"
}

$args = @($nodeScript)
if ($Leaf) {
    $args += '--leaf'
    $args += $Leaf
}
if ($Chain) {
    $args += '--chain'
    $args += $Chain
}

Write-Host "Running: node $($args -join ' ')" -ForegroundColor DarkGray
node @args

$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
    Write-Host "Verification failed (exit code $exitCode)." -ForegroundColor Red
    exit $exitCode
}

Write-Host 'Verification completed successfully.' -ForegroundColor Green
