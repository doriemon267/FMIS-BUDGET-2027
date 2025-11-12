$file = 'd:\DREED\FMIS-BUDGET-SEPTEMBER\SERVER\controllers\proposalController.js'
$content = Get-Content -Path $file -Raw

# We need to find and replace the entire broken async structure
# The pattern is: proposals.forEach inside a consolidateDrafts function

# For now, let's just comment out the entire section that creates Proposal documents
# Find the "if (!proposalDoc)" block and comment it out

$lines = $content -split "`n"
$newLines = @()
$inBadBlock = $false
$blockDepth = 0

for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    
    # Detect start of the bad if block  
    if ($line -match 'if \(!proposalDoc\) \{') {
        $inBadBlock = $true
        $blockDepth = 0
        $newLines += '            /*'
    }
    
    if ($inBadBlock) {
        # Track braces
        $blockDepth += ($line | Select-String -AllMatches '{').Matches.Count
        $blockDepth -= ($line | Select-String -AllMatches '}').Matches.Count
        
        # Comment out the line
        $newLines += '            ' + $line
        
        # If we've closed all braces, we're done with this block
        if ($blockDepth -eq 0 -and $line -match '}') {
            $newLines += '            */'
            $newLines += '            proposalDoc = {}; // Virtual object only, not from database'
            $inBadBlock = $false
        }
    } else {
        $newLines += $line
    }
}

# Write back
$newContent = $newLines -join "`n"
Set-Content -Path $file -Value $newContent -Encoding UTF8

Write-Host "Commented out the problematic if (!proposalDoc) blocks"
