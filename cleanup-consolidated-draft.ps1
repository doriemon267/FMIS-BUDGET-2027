# Clean up consolidated-draft function code - remove commented blocks and unused variables
$filePath = "d:\DREED\FMIS-BUDGET-SEPTEMBER\SERVER\controllers\proposalController.js"
$content = Get-Content $filePath -Raw

# Pattern 1: Remove the entire commented block with if (!proposalDoc) and Proposal.create()
# This removes lines with the huge commented-out code block
$pattern1 = "(?s)          // Find existing or create new Proposal document\r?\n          // FIXED: No database lookup - consolidated-draft proposals are virtual only\r?\n          let proposalDoc = \{\};\r?\n          \r?\n            /\*[\s\S]*?proposalDoc = \{\}; // Virtual object only, not from database\r?\n          \r?\n          return \{"
$replacement1 = @"
          // Virtual aggregation only - no database persistence
          return {
"@

if ($content -match $pattern1) {
    $content = $content -replace $pattern1, $replacement1
    Write-Host "✅ Removed commented Proposal.create() blocks"
} else {
    Write-Host "⚠️ Pattern 1 not found - code may already be cleaned"
}

# Pattern 2: Remove the _id and proposalId fields since proposalDoc is empty
$pattern2 = "            _id: proposalDoc._id, // Use Proposal ID from database\r?\n            proposalId: proposalDoc._id,"
if ($content -match $pattern2) {
    $content = $content -replace $pattern2, ""
    Write-Host "✅ Removed empty _id/proposalId references"
}

Set-Content $filePath $content -Encoding UTF8
Write-Host "✅ Code cleanup complete"
