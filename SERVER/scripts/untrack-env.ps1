# Untrack SERVER/.env from git while keeping a local copy
# Run this from the repository root in PowerShell

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Error "git is not installed or not available in PATH."
  exit 1
}

$envPath = "SERVER/.env"
if (-not (Test-Path $envPath)) {
  Write-Error "$envPath not found. Nothing to untrack."
  exit 1
}

Write-Host "Removing $envPath from git index (will keep local file)..."
git rm --cached $envPath
if ($LASTEXITCODE -ne 0) {
  Write-Error "git rm failed. Aborting."
  exit $LASTEXITCODE
}

git commit -m "chore(secrets): remove tracked SERVER/.env and replace with placeholder"
if ($LASTEXITCODE -ne 0) {
  Write-Error "git commit failed. You may need to commit manually."
  exit $LASTEXITCODE
}

Write-Host "Done. Remember to rotate exposed credentials and set them as environment secrets on your server/CI."