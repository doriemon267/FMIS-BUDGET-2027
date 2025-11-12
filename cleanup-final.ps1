# Remove unused proposalFilter variable from consolidateDrafts functions
$filePath = "d:\DREED\FMIS-BUDGET-SEPTEMBER\SERVER\controllers\proposalController.js"
$content = Get-Content $filePath -Raw

# Remove the unused proposalFilter block
$pattern = "          // Build filter to find/create Proposal document\r?\n          const proposalFilter = \{\r?\n            fiscalYear: draft\.fiscalYear,\r?\n            budgetType: draft\.budgetType,\r?\n            processBy: draft\.processBy,\r?\n            region: draft\.region,\r?\n            status: 'Draft'\r?\n          \};\r?\n          \r?\n          if \(draft\.division\) proposalFilter\.division = draft\.division;\r?\n          if \(draft\.department\) proposalFilter\.department = draft\.department;\r?\n          if \(draft\.office\) proposalFilter\.office = draft\.office;\r?\n          \r?\n          "

$content = $content -replace $pattern, "          "
Write-Host "✅ Removed unused proposalFilter code"

Set-Content $filePath $content -Encoding UTF8
Write-Host "✅ Final cleanup complete"
