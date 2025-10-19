/**
 * Helper functions to ensure consistent calculations between MOOE Table and Budgetary Support Table
 */

/**
 * Calculate MOOE subsidy totals exactly like in MooeTable.jsx
 * @param {Array} mooeEntries - The entries array from MOOE data
 * @returns {Object} Object containing regular, IAs, and total subsidies
 */
export const calculateMooeSubsidyTotals = (mooeEntries) => {
  if (!Array.isArray(mooeEntries)) {
    console.warn('calculateMooeSubsidyTotals: mooeEntries is not an array');
    return {
      regularSubsidy: 0,
      iasOMSubsidy: 0,
      totalSubsidy: 0
    };
  }

  let regularSubsidy = 0;
  let iasOMSubsidy = 0;

  mooeEntries.forEach((row, rowIndex) => {
    const isIAsOMCost = row.sublineItem === "Irrigators' Associations (IAs) Operation & Maintenance Cost";
    
    if (row.children && Array.isArray(row.children)) {
      row.children.forEach((child) => {
        const childSubsidy = parseFloat(child.subsidy || 0);
        
        if (isIAsOMCost) {
          iasOMSubsidy += childSubsidy;
          // console.log(`MOOE Calc Helper - IAs O&M [${rowIndex}.${childIndex}]: ${child.description || child.uacsCode || 'N/A'} = ₱${childSubsidy.toLocaleString()}`);
        } else {
          regularSubsidy += childSubsidy;
          // console.log(`MOOE Calc Helper - Regular [${rowIndex}.${childIndex}]: ${child.description || child.uacsCode || 'N/A'} = ₱${childSubsidy.toLocaleString()}`);
        }
      });
    } else {
      console.warn(`MOOE Calc Helper - Row ${rowIndex} (${row.sublineItem}) has no children array`);
    }
  });

  const totalSubsidy = regularSubsidy + iasOMSubsidy;

  // console.log('MOOE Calc Helper - Summary:', {
  //   regularSubsidy: `₱${regularSubsidy.toLocaleString()}`,
  //   iasOMSubsidy: `₱${iasOMSubsidy.toLocaleString()}`,
  //   totalSubsidy: `₱${totalSubsidy.toLocaleString()}`
  // });

  return {
    regularSubsidy,
    iasOMSubsidy,
    totalSubsidy
  };
};

/**
 * Calculate Capital Outlay subsidy total
 * @param {Array} capitalOutlayData - The capital outlay data array
 * @returns {number} Total capital outlay subsidy
 */
export const calculateCapitalOutlaySubsidyTotal = (capitalOutlayData) => {
  if (!Array.isArray(capitalOutlayData)) {
    console.warn('calculateCapitalOutlaySubsidyTotal: capitalOutlayData is not an array');
    return 0;
  }

  const total = capitalOutlayData.reduce((sum, item) => {
    const subsidy = parseFloat(item.subsidy || 0);
    // console.log(`Capital Outlay [${index}]: ${item.description || item.uacsCode || 'N/A'} = ₱${subsidy.toLocaleString()}`);
    return sum + subsidy;
  }, 0);

  // console.log(`Capital Outlay Total: ₱${total.toLocaleString()}`);
  return total;
};

/**
 * Calculate total budgetary support (MOOE + Capital Outlay subsidies)
 * @param {Array} mooeEntries - The entries array from MOOE data
 * @param {Array} capitalOutlayData - The capital outlay data array
 * @returns {Object} Detailed breakdown of all calculations
 */
export const calculateBudgetarySupport = (mooeEntries, capitalOutlayData) => {
  // console.log('=== BUDGETARY SUPPORT CALCULATION START ===');
  
  const mooeCalculation = calculateMooeSubsidyTotals(mooeEntries);
  const capitalOutlayTotal = calculateCapitalOutlaySubsidyTotal(capitalOutlayData);
  
  const totalBudgetarySupport = mooeCalculation.totalSubsidy + capitalOutlayTotal;
  
  const result = {
    mooe: {
      regular: mooeCalculation.regularSubsidy,
      iasOM: mooeCalculation.iasOMSubsidy,
      total: mooeCalculation.totalSubsidy
    },
    capitalOutlay: {
      total: capitalOutlayTotal
    },
    grandTotal: totalBudgetarySupport
  };

  // console.log('=== BUDGETARY SUPPORT CALCULATION SUMMARY ===');
  // console.log('MOOE Regular Subsidy:', `₱${result.mooe.regular.toLocaleString()}`);
  // console.log('MOOE IAs O&M Subsidy:', `₱${result.mooe.iasOM.toLocaleString()}`);
  // console.log('MOOE Total Subsidy:', `₱${result.mooe.total.toLocaleString()}`);
  // console.log('Capital Outlay Subsidy:', `₱${result.capitalOutlay.total.toLocaleString()}`);
  // console.log('GRAND TOTAL BUDGETARY SUPPORT:', `₱${result.grandTotal.toLocaleString()}`);
  // console.log('=== BUDGETARY SUPPORT CALCULATION END ===');

  return result;
};

/**
 * Verify that MOOE calculations match between different components
 * @param {Array} mooeEntries - The entries array from MOOE data
 * @param {Object} expectedTotals - Expected totals from MOOE table
 * @returns {boolean} True if calculations match
 */
export const verifyMooeCalculationConsistency = (mooeEntries, expectedTotals) => {
  const calculated = calculateMooeSubsidyTotals(mooeEntries);
  
  const regularMatch = Math.abs(calculated.regularSubsidy - expectedTotals.regular) < 0.01;
  const iasMatch = Math.abs(calculated.iasOMSubsidy - expectedTotals.iasOM) < 0.01;
  const totalMatch = Math.abs(calculated.totalSubsidy - expectedTotals.total) < 0.01;
  
  // console.log('=== MOOE CALCULATION VERIFICATION ===');
  // console.log('Regular Subsidy Match:', regularMatch, 
  //   `(Calculated: ₱${calculated.regularSubsidy.toLocaleString()}, Expected: ₱${expectedTotals.regular.toLocaleString()})`);
  // console.log('IAs O&M Subsidy Match:', iasMatch, 
  //   `(Calculated: ₱${calculated.iasOMSubsidy.toLocaleString()}, Expected: ₱${expectedTotals.iasOM.toLocaleString()})`);
  // console.log('Total Subsidy Match:', totalMatch, 
  //   `(Calculated: ₱${calculated.totalSubsidy.toLocaleString()}, Expected: ₱${expectedTotals.total.toLocaleString()})`);
  
  const allMatch = regularMatch && iasMatch && totalMatch;
  // console.log('Overall Match:', allMatch ? '✅ PASS' : '❌ FAIL');
  
  return allMatch;
};