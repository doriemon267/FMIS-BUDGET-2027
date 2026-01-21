import React, { useEffect } from 'react';
import { calculateBudgetarySupport } from '../../utils/budgetaryCalculationHelper';

const TierDebugger = ({ mooeData, capitalOutlayData, activeRegion, fiscalYear, budgetType }) => {
  useEffect(() => {
    
    if (mooeData?.entries) {
      
      // Show structure of first few entries
      mooeData.entries.slice(0, 3).forEach((entry, index) => {
      });
      
      // Test the calculation
      const result = calculateBudgetarySupport(mooeData.entries, capitalOutlayData || []);
      
      // Check for IAs O&M Cost entries
      const iasEntries = mooeData.entries.filter(entry => 
        entry.sublineItem === "Irrigators' Associations (IAs) Operation & Maintenance Cost"
      );
      
      // Check for regular MOOE entries
      const regularEntries = mooeData.entries.filter(entry => 
        entry.sublineItem !== "Irrigators' Associations (IAs) Operation & Maintenance Cost"
      );
      
    } else {
    }
    
  }, [mooeData, capitalOutlayData, activeRegion, fiscalYear, budgetType]);

  return null; // This is just a debugging component
};

export default TierDebugger;