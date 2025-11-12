$file = 'd:\DREED\FMIS-BUDGET-SEPTEMBER\SERVER\controllers\proposalController.js'
$content = Get-Content -Path $file -Raw

# Comment out the problematic Proposal.create lines
# This disables the auto-creation of consolidated-draft proposals in the database
$oldPattern1 = 'proposalDoc = await Proposal.create({'
$newPattern1 = '// DISABLED: proposalDoc = await Proposal.create({'

$content = $content -replace [regex]::Escape($oldPattern1), $newPattern1

# Also comment out the console.log that references the created proposal
$oldPattern2 = 'console.log(`Auto-created Proposal document:'
$newPattern2 = '// console.log(`Auto-created Proposal document:'

$content = $content -replace [regex]::Escape($oldPattern2), $newPattern2

# Write the file back
Set-Content -Path $file -Value $content -Encoding UTF8

Write-Host "✅ Fixed! Disabled Proposal.create calls in consolidateDrafts functions"

# Verify
$newContent = Get-Content -Path $file -Raw
$count = ($newContent | Select-String -Pattern 'DISABLED: proposalDoc' -AllMatches).Matches.Count
Write-Host "Disabled instances: $count"
