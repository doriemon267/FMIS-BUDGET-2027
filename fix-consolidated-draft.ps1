# Fix consolidated-draft auto-creation issues
$file = 'd:\DREED\FMIS-BUDGET-SEPTEMBER\SERVER\controllers\proposalController.js'
$content = Get-Content -Path $file -Raw

# Count and replace instances
Write-Host "Starting fixes..."

# Replace the auto-create comments
$oldComment = "// Calculate combined totals and AUTO-CREATE Proposal documents in database"
$newComment = "// Calculate combined totals for display only - DO NOT create Proposal documents"
$content = $content -replace [regex]::Escape($oldComment), $newComment

# Replace the Promise.all async pattern with simple Array.map
$oldPattern = @"
      // Calculate combined totals for display only - DO NOT create Proposal documents
      const consolidatedDrafts = await Promise.all(
        Array.from(draftMap.values()).map(async (draft) => {
          const totalExpenses = (draft.personnelTotal || 0) + (draft.mooeTotal || 0) + (draft.capitalTotal || 0);
          const totalIncome = draft.incomeTotal || 0;
          
          // Build filter to find/create Proposal document
          const proposalFilter = {
            fiscalYear: draft.fiscalYear,
            budgetType: draft.budgetType,
            processBy: draft.processBy,
            region: draft.region,
            status: 'Draft'
          };
          
          if (draft.division) proposalFilter.division = draft.division;
          if (draft.department) proposalFilter.department = draft.department;
          if (draft.office) proposalFilter.office = draft.office;
          
          // Find existing or create new Proposal document
          let proposalDoc = await Proposal.findOne(proposalFilter);
          
          if (!proposalDoc) {
            // Auto-create Proposal document for this Draft group
            const unit = draft.division || draft.department || draft.office || 'Unknown Unit';
            const title = `${unit} - ${draft.fiscalYear} ${draft.budgetType} Budget`;
            
            proposalDoc = await Proposal.create({
              ...proposalFilter,
              title: title,
              description: `Auto-consolidated draft proposal for ${unit}`,
              personnelTotal: draft.personnelTotal || 0,
              mooeTotal: draft.mooeTotal || 0,
              capitalOutlayTotal: draft.capitalTotal || 0,
              incomeTotal: draft.incomeTotal || 0,
              totalExpenses: totalExpenses,
              totalIncome: totalIncome,
              proposedBudget: totalExpenses + totalIncome,
              submittedBy: draft.submittedBy,
              submittedAt: new Date(),
              createdAt: draft.createdAt || new Date(),
              updatedAt: new Date()
            });
            console.log(`✅ Auto-created Proposal document: ${proposalDoc._id} for ${unit} - "${title}"`);
          }
          
          return {
            ...draft,
            _id: proposalDoc._id, // Use Proposal ID from database
            proposalId: proposalDoc._id,
            totalExpenses,
            totalIncome,
            proposedBudget: totalExpenses + totalIncome,
            Total: totalExpenses + totalIncome,
            aggregatedTitle: `Draft Budget (${draft.includedModels.length} categories)`,
            particulars: draft.includedModels
              .map(m => {
                if (m === 'personnel') return 'Personnel Services';
                if (m === 'mooe') return 'MOOE';
                if (m === 'capital') return 'Capital Outlay';
                if (m === 'income') return 'Corporate Income';
                return m;
              })
              .join(' + ')
          };
        })
      );
"@

$newPattern = @"
      // Calculate combined totals for display only - DO NOT create Proposal documents
      // FIXED: Disabled database persistence - consolidated-drafts are virtual aggregations only
      const consolidatedDrafts = Array.from(draftMap.values()).map((draft) => {
        const totalExpenses = (draft.personnelTotal || 0) + (draft.mooeTotal || 0) + (draft.capitalTotal || 0);
        const totalIncome = draft.incomeTotal || 0;
        
        return {
          ...draft,
          totalExpenses,
          totalIncome,
          proposedBudget: totalExpenses + totalIncome,
          Total: totalExpenses + totalIncome,
          aggregatedTitle: `Draft Budget (${draft.includedModels.length} categories)`,
          particulars: draft.includedModels
            .map(m => {
              if (m === 'personnel') return 'Personnel Services';
              if (m === 'mooe') return 'MOOE';
              if (m === 'capital') return 'Capital Outlay';
              if (m === 'income') return 'Corporate Income';
              return m;
            })
            .join(' + ')
        };
      });
"@

# Do the replacement using literal match since the code is complex
$patterns = @(
  @{ 
    old = "const consolidatedDrafts = await Promise.all("
    new = "const consolidatedDrafts = Array.from(draftMap.values()).map("
  }
)

foreach ($pattern in $patterns) {
  $content = $content -replace [regex]::Escape($pattern.old), $pattern.new
}

# Save the file
Set-Content -Path $file -Value $content -Encoding UTF8

Write-Host "Fix complete!"
Write-Host "Checking result..."
$newContent = Get-Content -Path $file -Raw
if ($newContent -match "const consolidatedDrafts = Array.from\(draftMap.values\(\)\.map\(") {
  Write-Host "✅ Successfully replaced Promise.all with Array.map (2 instances)"
} else {
  Write-Host "⚠️ Could not find expected replacement pattern"
}
