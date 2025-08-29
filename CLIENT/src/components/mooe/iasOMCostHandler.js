// Also save IAs O&M Cost data
const iasOMCostPayload = {
  nis: parseFloat(iasOMCost.nis || 0),
  cis: parseFloat(iasOMCost.cis || 0),
  nisSubsidy: parseFloat(iasOMCost.nisSubsidy || 0),
  cisSubsidy: parseFloat(iasOMCost.cisSubsidy || 0),
  fiscalYear: data?.fiscalYear,
  budgetType: data?.budgetType,
  region: currentUser.Region,
  processBy: `${currentUser.FirstName} ${currentUser.LastName}`
};

// console.log('Saving IAs O&M Cost data:', iasOMCostPayload);

// Save IAs O&M Cost data
try {
  await api.post('/ias-om-cost', iasOMCostPayload);
  setHasUnsavedChanges(false);
  setLastSaved(new Date());
  
  if (isAutoSave) {
    toast.success("Auto-saved successfully!", { autoClose: 2000 });
  } else {
    toast.success("Data saved successfully!");
  }
  
  // Refresh the data after saving
  await Promise.all([
    queryClient.invalidateQueries(["mooeData"]),
    queryClient.invalidateQueries(["iasOMCostData"]),
    queryClient.invalidateQueries(["consolidatedSummary"])
  ]);
} catch (err) {
  console.error("Error saving IAs O&M Cost data:", err);
  toast.error(`Failed to save IAs O&M Cost data: ${err.message}`);
}
