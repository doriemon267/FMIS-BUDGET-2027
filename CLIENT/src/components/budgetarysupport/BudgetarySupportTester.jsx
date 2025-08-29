import React, { useEffect } from 'react';
import { calculateBudgetarySupport } from '../../utils/budgetaryCalculationHelper';

const BudgetarySupportTester = () => {
  useEffect(() => {
    
    // Test with sample data structure
    const sampleMOOEData = [
      {
        sublineItem: "Travel Expenses",
        children: [
          { description: "Travel - Local", subsidy: 50000 },
          { description: "Travel - Foreign", subsidy: 25000 }
        ]
      },
      {
        sublineItem: "Irrigators' Associations (IAs) Operation & Maintenance Cost",
        children: [
          { description: "IAs O&M - NIS", subsidy: 100000 },
          { description: "IAs O&M - CIS", subsidy: 75000 }
        ]
      },
      {
        sublineItem: "Office Supplies",
        children: [
          { description: "Paper Supplies", subsidy: 30000 },
          { description: "Computer Supplies", subsidy: 20000 }
        ]
      }
    ];

    const sampleCapitalOutlayData = [
      { description: "Equipment", subsidy: 200000 },
      { description: "Infrastructure", subsidy: 300000 }
    ];

    const result = calculateBudgetarySupport(sampleMOOEData, sampleCapitalOutlayData);

  }, []);

  return null;
};

export default BudgetarySupportTester;