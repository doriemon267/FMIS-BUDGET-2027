/**
 * FISCAL YEAR SETTINGS ENHANCEMENT - USAGE EXAMPLES
 * 
 * This file demonstrates how to use the new enhanced fiscal year settings features:
 * 1. Multiple Budget Periods (versioning)
 * 2. Region-based Application
 * 3. Separated Compensation Settings
 * 4. Manual Period Activation
 */

// ============================================================================
// EXAMPLE 1: Create Settings with Multiple Periods (NIA-Wide)
// ============================================================================

const example1_CreateWithMultiplePeriods = {
  endpoint: "POST /settings/enhanced/create",
  description: "Create FY 2026 Initial Budget with Phase 1 and Phase 2",
  
  requestBody: {
    fiscalYear: "2026",
    budgetType: "Initial",
    applicableRegions: ["All"],  // NIA-Wide
    budgetPeriods: [
      {
        periodName: "Phase 1",
        startDate: "2026-01-15",
        dueDate: "2026-02-28"
      },
      {
        periodName: "Phase 2",
        startDate: "2026-03-01",
        dueDate: "2026-04-30"
      }
    ],
    compensationData: {
      PERA: 2000,
      uniformAllowance: 5000,
      productivityIncentive: 500,
      medicalAllowance: 200,
      meal: 200,
      gsisPremium: 15000,
      philhealthPremium: 0.05,
      pagibigPremium: 100,
      employeeCompensation: 1000,
      weekdayMultiplier: 1.5,
      weekendMultiplier: 2.0
    },
    isActive: true
  },

  expectedResponse: {
    message: "Settings created successfully with regions and periods",
    settings: {
      _id: "60d5ec49c1234567890abc12",
      fiscalYear: "2026",
      budgetType: "Initial",
      applicableRegions: ["All"],
      budgetPeriods: [
        {
          periodName: "Phase 1",
          startDate: "2026-01-15T00:00:00.000Z",
          dueDate: "2026-02-28T00:00:00.000Z",
          isActive: true  // First period is active by default
        },
        {
          periodName: "Phase 2",
          startDate: "2026-03-01T00:00:00.000Z",
          dueDate: "2026-04-30T00:00:00.000Z",
          isActive: false
        }
      ],
      compensationSettingsId: "60d5ec49c1234567890abc15",
      isActive: true
    }
  }
};

// ============================================================================
// EXAMPLE 2: Create Region-Specific Settings
// ============================================================================

const example2_CreateRegionSpecific = {
  endpoint: "POST /settings/enhanced/create",
  description: "Create NEP Budget for specific regions only",
  
  requestBody: {
    fiscalYear: "2026",
    budgetType: "NEP",
    applicableRegions: ["Region_1", "Region_2", "Region_3"],  // Specific regions
    budgetPeriods: [
      {
        periodName: "Region Priority Phase",
        startDate: "2026-02-01",
        dueDate: "2026-03-31"
      }
    ],
    compensationData: {
      PERA: 2500,
      uniformAllowance: 6000,
      productivityIncentive: 750
    },
    isActive: false  // Not active yet
  }
};

// ============================================================================
// EXAMPLE 3: Extend Budget Period (Add New Phase)
// ============================================================================

const example3_ExtendPeriod = {
  endpoint: "POST /settings/:id/extend-period",
  description: "After Phase 1 closes, add Extension Phase",
  settingsId: "60d5ec49c1234567890abc12",
  
  requestBody: {
    periodName: "Extension Phase",
    startDate: "2026-05-01",
    dueDate: "2026-06-30"
  },

  validationRules: [
    "startDate must be AFTER last period's dueDate (2026-04-30)",
    "startDate must be BEFORE dueDate",
    "No overlapping periods allowed"
  ],

  expectedResponse: {
    message: "Budget period extended successfully",
    settings: {
      _id: "60d5ec49c1234567890abc12",
      budgetPeriods: [
        {
          periodName: "Phase 1",
          startDate: "2026-01-15T00:00:00.000Z",
          dueDate: "2026-02-28T00:00:00.000Z",
          isActive: true
        },
        {
          periodName: "Phase 2",
          startDate: "2026-03-01T00:00:00.000Z",
          dueDate: "2026-04-30T00:00:00.000Z",
          isActive: false
        },
        {
          periodName: "Extension Phase",
          startDate: "2026-05-01T00:00:00.000Z",
          dueDate: "2026-06-30T00:00:00.000Z",
          isActive: false  // New periods start as inactive
        }
      ]
    }
  }
};

// ============================================================================
// EXAMPLE 4: Activate Budget Period (Manual Activation)
// ============================================================================

const example4_ActivatePeriod = {
  endpoint: "PATCH /settings/:id/activate-period",
  description: "When ready, manually switch from Phase 1 to Phase 2",
  settingsId: "60d5ec49c1234567890abc12",
  
  requestBody: {
    periodIndex: 1  // 0-based index: Phase 1 = 0, Phase 2 = 1, etc.
  },

  notes: [
    "Only one period can be active at a time",
    "Switching doesn't affect compensation settings",
    "This is MANUAL activation - use when you're ready",
    "Backward compatibility: updates startDate/dueDate fields"
  ],

  expectedResponse: {
    message: "Budget period \"Phase 2\" activated successfully",
    settings: {
      _id: "60d5ec49c1234567890abc12",
      budgetPeriods: [
        {
          periodName: "Phase 1",
          startDate: "2026-01-15T00:00:00.000Z",
          dueDate: "2026-02-28T00:00:00.000Z",
          isActive: false  // Now inactive
        },
        {
          periodName: "Phase 2",
          startDate: "2026-03-01T00:00:00.000Z",
          dueDate: "2026-04-30T00:00:00.000Z",
          isActive: true  // Now active
        }
      ]
    }
  }
};

// ============================================================================
// EXAMPLE 5: Get Settings by Region
// ============================================================================

const example5_GetSettingsByRegion = {
  endpoint: "GET /settings/by-region/:region",
  description: "Retrieve all settings applicable to Region_1",
  
  examples: [
    "GET /settings/by-region/Region_1",
    "GET /settings/by-region/Region_2",
    "GET /settings/by-region/Central_Office"
  ],

  note: "Returns all settings where applicableRegions includes 'All' or the specified region",

  expectedResponse: {
    message: "Settings for region \"Region_1\" retrieved successfully",
    region: "Region_1",
    settings: [
      {
        _id: "60d5ec49c1234567890abc12",
        fiscalYear: "2026",
        budgetType: "Initial",
        applicableRegions: ["All"],  // Includes Region_1
        budgetPeriods: [/* ... */]
      },
      {
        _id: "60d5ec49c1234567890abc20",
        fiscalYear: "2026",
        budgetType: "NEP",
        applicableRegions: ["Region_1", "Region_2"],  // Also includes Region_1
        budgetPeriods: [/* ... */]
      }
    ]
  }
};

// ============================================================================
// EXAMPLE 6: Get Active Settings with All Periods
// ============================================================================

const example6_GetActiveWithPeriods = {
  endpoint: "GET /settings/active/with-periods",
  description: "Get currently active settings with all budget periods",
  
  examples: [
    "GET /settings/active/with-periods",
    "GET /settings/active/with-periods?region=Region_1"
  ],

  expectedResponse: {
    message: "Active settings retrieved successfully",
    settings: {
      _id: "60d5ec49c1234567890abc12",
      fiscalYear: "2026",
      budgetType: "Initial",
      applicableRegions: ["All"],
      budgetPeriods: [
        {
          periodName: "Phase 1",
          startDate: "2026-01-15T00:00:00.000Z",
          dueDate: "2026-02-28T00:00:00.000Z",
          isActive: true
        },
        {
          periodName: "Phase 2",
          startDate: "2026-03-01T00:00:00.000Z",
          dueDate: "2026-04-30T00:00:00.000Z",
          isActive: false
        }
      ],
      compensationSettingsId: {
        _id: "60d5ec49c1234567890abc15",
        fiscalYear: "2026",
        budgetType: "Initial",
        PERA: 2000,
        uniformAllowance: 5000
        // ... other compensation data
      }
    },
    activePeriod: {
      periodName: "Phase 1",
      startDate: "2026-01-15T00:00:00.000Z",
      dueDate: "2026-02-28T00:00:00.000Z",
      isActive: true
    }
  }
};

// ============================================================================
// EXAMPLE 7: Update Compensation Settings (Separate)
// ============================================================================

const example7_UpdateCompensation = {
  endpoint: "PUT /settings/:id/compensation",
  description: "Update compensation rates without affecting budget periods",
  settingsId: "60d5ec49c1234567890abc12",
  
  requestBody: {
    PERA: 2500,
    uniformAllowance: 6000,
    productivityIncentive: 750,
    medicalAllowance: 250,
    meal: 250,
    gsisPremium: 16000,
    weekdayMultiplier: 1.75,
    weekendMultiplier: 2.25
  },

  benefits: [
    "Update rates without affecting active period dates",
    "Compensation changes don't disrupt budget cycles",
    "Audit trail for rate changes",
    "Independent from period management"
  ],

  expectedResponse: {
    message: "Compensation settings updated successfully",
    settings: {
      _id: "60d5ec49c1234567890abc12",
      compensationSettingsId: {
        _id: "60d5ec49c1234567890abc15",
        fiscalYear: "2026",
        budgetType: "Initial",
        PERA: 2500,
        uniformAllowance: 6000,
        productivityIncentive: 750,
        medicalAllowance: 250,
        meal: 250,
        gsisPremium: 16000,
        weekdayMultiplier: 1.75,
        weekendMultiplier: 2.25
      }
    }
  }
};

// ============================================================================
// WORKFLOW EXAMPLE: Complete Fiscal Year Setup
// ============================================================================

const workflowExample = {
  title: "Complete Fiscal Year 2026 Setup Workflow",
  
  step1: {
    description: "January 10, 2026 - Create Initial Budget with 2 phases",
    action: example1_CreateWithMultiplePeriods,
    result: "Settings ID: 60d5ec49c1234567890abc12"
  },

  step2: {
    description: "January 15, 2026 - Phase 1 opens automatically (first period is active)",
    action: "No API call needed - already configured",
    result: "Users can submit Phase 1 budgets"
  },

  step3: {
    description: "February 28, 2026 - Phase 1 closes, activate Phase 2",
    action: example4_ActivatePeriod,
    requestBody: { periodIndex: 1 },
    result: "Phase 2 period dates now active"
  },

  step4: {
    description: "April 25, 2026 - Phase 2 closing soon, extend deadline",
    action: example3_ExtendPeriod,
    requestBody: {
      periodName: "Final Extension",
      startDate: "2026-05-01",
      dueDate: "2026-06-15"
    },
    result: "Extension period added, users have more time"
  },

  step5: {
    description: "May 1, 2026 - Activate Final Extension",
    action: example4_ActivatePeriod,
    requestBody: { periodIndex: 2 },
    result: "Final Extension period active"
  },

  step6: {
    description: "Anytime - Update Compensation Rates",
    action: example7_UpdateCompensation,
    note: "Can be done independently of period management"
  },

  step7: {
    description: "Get current status",
    action: example6_GetActiveWithPeriods,
    result: "See all periods and compensation data"
  }
};

// ============================================================================
// ERROR EXAMPLES
// ============================================================================

const errorExamples = {
  invalidDates: {
    problem: "startDate is after dueDate",
    response: {
      message: "startDate must be before dueDate"
    }
  },

  overlappingPeriods: {
    problem: "New period starts before last period ends",
    response: {
      message: "New period start date must be after the last period's due date (2026-04-30T00:00:00.000Z)"
    }
  },

  invalidIndex: {
    problem: "periodIndex is out of range",
    response: {
      message: "Invalid periodIndex. Valid range is 0-2"
    }
  },

  duplicateSettings: {
    problem: "Trying to create settings for same fiscal year + budget type",
    response: {
      field: "fiscalYear",
      message: "Settings for this fiscal year and budget type already exist."
    }
  },

  missingRequiredFields: {
    problem: "Budget period missing periodName",
    response: {
      message: "Each budget period must have periodName, startDate, and dueDate"
    }
  }
};

// ============================================================================
// COMPARISON: OLD vs NEW
// ============================================================================

const comparison = {
  feature: "Multiple Budget Periods Support",
  
  old_approach: {
    description: "Single start/due dates, manual adjustment required",
    code: `
      // Create with single dates
      POST /settings
      {
        fiscalYear: "2026",
        budgetType: "Initial",
        startDate: "2026-01-15",
        dueDate: "2026-02-28"
      }
      
      // To extend, UPDATE the dates (overwrites old dates!)
      PUT /settings/:id
      {
        dueDate: "2026-03-31"
      }
    `,
    problems: [
      "Can't track multiple phases",
      "Old dates are lost when extended",
      "No versioning or history",
      "Manual date management"
    ]
  },

  new_approach: {
    description: "Multiple periods with full versioning",
    code: `
      // Create with multiple periods upfront
      POST /settings/enhanced/create
      {
        fiscalYear: "2026",
        budgetType: "Initial",
        budgetPeriods: [
          { periodName: "Phase 1", startDate: "2026-01-15", dueDate: "2026-02-28" },
          { periodName: "Phase 2", startDate: "2026-03-01", dueDate: "2026-04-30" }
        ]
      }
      
      // To extend, ADD new period
      POST /settings/:id/extend-period
      {
        periodName: "Extension",
        startDate: "2026-05-01",
        dueDate: "2026-06-30"
      }
    `,
    benefits: [
      "Full period history maintained",
      "All dates preserved",
      "Clear versioning with period names",
      "Manual switching between phases",
      "Audit trail"
    ]
  }
};

console.log("=== FISCAL YEAR SETTINGS ENHANCEMENT EXAMPLES ===\n");
console.log("This file contains examples of all new endpoints and features.");
console.log("Use these as reference for API calls and frontend implementation.\n");

module.exports = {
  example1_CreateWithMultiplePeriods,
  example2_CreateRegionSpecific,
  example3_ExtendPeriod,
  example4_ActivatePeriod,
  example5_GetSettingsByRegion,
  example6_GetActiveWithPeriods,
  example7_UpdateCompensation,
  workflowExample,
  errorExamples,
  comparison
};