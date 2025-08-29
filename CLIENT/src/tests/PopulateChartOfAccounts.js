/**
 * Script to populate Chart of Accounts with Capital Outlay data
 */

const populateChartOfAccounts = async () => {
  // console.log("🧪 Populating Chart of Accounts with Capital Outlay Data");
  // console.log("=" .repeat(60));

  const baseURL = "http://localhost:5005";

  // Capital Outlay Chart of Accounts data
  const capitalOutlayAccounts = [
    // Infrastructure Outlay
    {
      accountClass: "Asset",
      lineItem: "Infrastructure Outlay",
      sublineItem: "Infrastructure Outlay",
      accountingTitle: "Road Construction and Improvement",
      uacsCode: "5-01-01-010"
    },
    {
      accountClass: "Asset",
      lineItem: "Infrastructure Outlay", 
      sublineItem: "Infrastructure Outlay",
      accountingTitle: "Flood Control Systems",
      uacsCode: "5-01-01-020"
    },
    {
      accountClass: "Asset",
      lineItem: "Infrastructure Outlay",
      sublineItem: "Infrastructure Outlay", 
      accountingTitle: "Water Supply Systems",
      uacsCode: "5-01-01-030"
    },
    {
      accountClass: "Asset",
      lineItem: "Infrastructure Outlay",
      sublineItem: "Infrastructure Outlay",
      accountingTitle: "Irrigation Systems",
      uacsCode: "5-01-01-040"
    },
    {
      accountClass: "Asset",
      lineItem: "Infrastructure Outlay",
      sublineItem: "Infrastructure Outlay",
      accountingTitle: "Other Infrastructure",
      uacsCode: "5-01-01-990"
    },

    // Building and Other Structures
    {
      accountClass: "Asset",
      lineItem: "Building and Other Structures",
      sublineItem: "Building and Other Structures",
      accountingTitle: "Buildings",
      uacsCode: "5-01-02-010"
    },
    {
      accountClass: "Asset",
      lineItem: "Building and Other Structures",
      sublineItem: "Building and Other Structures",
      accountingTitle: "School Buildings",
      uacsCode: "5-01-02-020"
    },
    {
      accountClass: "Asset",
      lineItem: "Building and Other Structures",
      sublineItem: "Building and Other Structures",
      accountingTitle: "Hospitals and Health Centers",
      uacsCode: "5-01-02-030"
    },
    {
      accountClass: "Asset",
      lineItem: "Building and Other Structures",
      sublineItem: "Building and Other Structures",
      accountingTitle: "Markets",
      uacsCode: "5-01-02-040"
    },
    {
      accountClass: "Asset",
      lineItem: "Building and Other Structures",
      sublineItem: "Building and Other Structures",
      accountingTitle: "Slaughterhouses",
      uacsCode: "5-01-02-050"
    },

    // Machinery and Equipment
    {
      accountClass: "Asset",
      lineItem: "Machinery and Equipment Outlay",
      sublineItem: "Machinery and Equipment Outlay",
      accountingTitle: "Office Equipment",
      uacsCode: "5-01-03-010"
    },
    {
      accountClass: "Asset",
      lineItem: "Machinery and Equipment Outlay",
      sublineItem: "Machinery and Equipment Outlay",
      accountingTitle: "Information and Communications Technology Equipment",
      uacsCode: "5-01-03-020"
    },
    {
      accountClass: "Asset",
      lineItem: "Machinery and Equipment Outlay",
      sublineItem: "Machinery and Equipment Outlay",
      accountingTitle: "Technical and Scientific Equipment",
      uacsCode: "5-01-03-030"
    },
    {
      accountClass: "Asset",
      lineItem: "Machinery and Equipment Outlay",
      sublineItem: "Machinery and Equipment Outlay",
      accountingTitle: "Machinery",
      uacsCode: "5-01-03-040"
    },

    // Transportation Equipment
    {
      accountClass: "Asset",
      lineItem: "Transportation Equipment Outlay",
      sublineItem: "Transportation Equipment Outlay",
      accountingTitle: "Motor Vehicles",
      uacsCode: "5-01-04-010"
    },
    {
      accountClass: "Asset",
      lineItem: "Transportation Equipment Outlay",
      sublineItem: "Transportation Equipment Outlay",
      accountingTitle: "Trains",
      uacsCode: "5-01-04-020"
    },
    {
      accountClass: "Asset",
      lineItem: "Transportation Equipment Outlay",
      sublineItem: "Transportation Equipment Outlay",
      accountingTitle: "Aircraft and Aircrafts Ground Equipment",
      uacsCode: "5-01-04-030"
    },
    {
      accountClass: "Asset",
      lineItem: "Transportation Equipment Outlay",
      sublineItem: "Transportation Equipment Outlay",
      accountingTitle: "Watercrafts",
      uacsCode: "5-01-04-040"
    },

    // Furniture, Fixtures and Books
    {
      accountClass: "Asset",
      lineItem: "Furniture, Fixtures and Books Outlay",
      sublineItem: "Furniture, Fixtures and Books Outlay",
      accountingTitle: "Furniture and Fixtures",
      uacsCode: "5-01-05-010"
    },
    {
      accountClass: "Asset",
      lineItem: "Furniture, Fixtures and Books Outlay",
      sublineItem: "Furniture, Fixtures and Books Outlay",
      accountingTitle: "Books",
      uacsCode: "5-01-05-020"
    },

    // Land
    {
      accountClass: "Asset",
      lineItem: "Land",
      sublineItem: "Land",
      accountingTitle: "Land",
      uacsCode: "5-01-06-010"
    },
    {
      accountClass: "Asset",
      lineItem: "Land",
      sublineItem: "Land",
      accountingTitle: "Land Rights",
      uacsCode: "5-01-06-020"
    },

    // Land Improvements
    {
      accountClass: "Asset",
      lineItem: "Land Improvements",
      sublineItem: "Land Improvements",
      accountingTitle: "Land Improvements",
      uacsCode: "5-01-07-010"
    },
    {
      accountClass: "Asset",
      lineItem: "Land Improvements",
      sublineItem: "Land Improvements",
      accountingTitle: "Site Development",
      uacsCode: "5-01-07-020"
    }
  ];

  try {
    // console.log(`\n📊 Adding ${capitalOutlayAccounts.length} Chart of Accounts entries...`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const account of capitalOutlayAccounts) {
      try {
        const response = await fetch(`${baseURL}/chart-of-accounts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(account)
        });

        if (response.ok) {
          const result = await response.json();
          // console.log(`✅ Added: ${account.accountingTitle} (${account.uacsCode})`);
          successCount++;
        } else {
          const errorText = await response.text();
          if (errorText.includes("already exists")) {
            // console.log(`⚠️ Exists: ${account.accountingTitle} (${account.uacsCode})`);
          } else {
            // console.log(`❌ Error: ${account.accountingTitle} - ${errorText}`);
            errors.push(`${account.accountingTitle}: ${errorText}`);
            errorCount++;
          }
        }
      } catch (error) {
        // console.log(`❌ Error: ${account.accountingTitle} - ${error.message}`);
        errors.push(`${account.accountingTitle}: ${error.message}`);
        errorCount++;
      }
    }

    // console.log("\n" + "=" .repeat(60));
    // console.log("📊 Chart of Accounts Population Summary:");
    // console.log(`✅ Successfully added: ${successCount}`);
    // console.log(`❌ Errors: ${errorCount}`);
    // console.log(`📋 Total processed: ${capitalOutlayAccounts.length}`);

    if (errors.length > 0) {
      // console.log("\n❌ Errors encountered:");
    }

    // Verify final count
    // console.log("\n🔍 Verifying Chart of Accounts...");
    const verifyResponse = await fetch(`${baseURL}/chart-of-accounts`);
    if (verifyResponse.ok) {
      const verifyData = await verifyResponse.json();
      // console.log(`📊 Total Chart of Accounts entries: ${verifyData.chartOfAccounts?.length || 0}`);
      
      // Show capital outlay entries
      const capitalOutlayEntries = verifyData.chartOfAccounts?.filter(entry => 
        entry.lineItem?.toLowerCase().includes('outlay') ||
        entry.lineItem?.toLowerCase().includes('infrastructure') ||
        entry.lineItem?.toLowerCase().includes('building') ||
        entry.lineItem?.toLowerCase().includes('machinery') ||
        entry.lineItem?.toLowerCase().includes('transportation') ||
        entry.lineItem?.toLowerCase().includes('furniture') ||
        entry.lineItem?.toLowerCase().includes('land')
      ) || [];
      
      // console.log(`🏗️ Capital Outlay entries: ${capitalOutlayEntries.length}`);
      
      // Group by subline item
      const groupedBySubline = {};
      capitalOutlayEntries.forEach(entry => {
        if (!groupedBySubline[entry.sublineItem]) {
          groupedBySubline[entry.sublineItem] = [];
        }
        groupedBySubline[entry.sublineItem].push(entry);
      });
      
      // console.log("\n📋 Capital Outlay by Subline Item:");
      Object.keys(groupedBySubline).forEach(sublineItem => {
        // console.log(`   • ${sublineItem}: ${groupedBySubline[sublineItem].length} entries`);
        groupedBySubline[sublineItem].forEach(entry => {
          // console.log(`     - ${entry.accountingTitle} (${entry.uacsCode})`);
        });
      });
    }

    // console.log("\n🎉 Chart of Accounts population completed!");
    // console.log("✅ You can now test the Title Mapping autocomplete");
    // console.log("=" .repeat(60));

  } catch (error) {
    console.error("❌ Population Error:", error.message);
  }
};

// Run the population
populateChartOfAccounts();
