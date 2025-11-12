$file = 'd:\DREED\FMIS-BUDGET-SEPTEMBER\SERVER\controllers\proposalController.js'
$content = Get-Content -Path $file -Raw

# Replace the entire problematic async Promise.all section with synchronous code
# This is a simpler approach: replace the opening line with synchronous version

# Pattern 1: Replace broken Array.from(...).map( with synchronous version
$old1 = 'Array.from(draftMap.values()).map(
        Array.from(draftMap.values()).map(async (draft)'

$new1 = 'Array.from(draftMap.values()).map((draft)'

$content = $content.Replace($old1, $new1)

# Also remove the closing ")" that was added incorrectly
$old2 = 'return [...nonDraftProposals, ...consolidatedDrafts];
    };
    
    finalProposals = await consolidateDrafts(finalProposals);'

$new2 = 'return [...nonDraftProposals, ...consolidatedDrafts];
    };
    
    finalProposals = consolidateDrafts(finalProposals);  // No longer async'

$content = $content.Replace($old2, $new2)

Set-Content -Path $file -Value $content -Encoding UTF8

Write-Host "Done"
