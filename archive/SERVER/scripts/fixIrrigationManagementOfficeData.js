/**
 * Script to fix IRRIGATION MANAGEMENT OFFICE data structure
 * 
 * This script will:
 * 1. Find all IRRIGATION MANAGEMENT OFFICE mappings
 * 2. Update divisions to use Provincial IMOs (e.g., ILOCOS NORTE IMO, ISABELA IMO)
 * 3. Add sections under each Provincial IMO
 */

const { MongoClient, ObjectId } = require('mongodb');

// MongoDB connection string - using the correct production database
const MONGO_URI = process.env.MONGO_URI || 'mongodb://172.16.4.98:27017';
const DB_NAME = 'fmis_budget';

// Provincial IMO structure by region
const PROVINCIAL_IMO_STRUCTURE = {
  'REGION I': [
    { 
      name: 'ILOCOS NORTE IMO', 
      code: 'IN-IMO',
      sections: [
        { name: 'Office of the IMO Manager', code: 'OIMOM' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Engineering, Operation and Maintenance Section', code: 'EOMS' }
      ]
    },
    { 
      name: 'ILOCOS SUR IMO', 
      code: 'IS-IMO',
      sections: [
        { name: 'Office of the Division Manager', code: 'ODM' },
        { name: 'Operation Section', code: 'OS' },
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' }
      ]
    },
    { 
      name: 'LA UNION IMO', 
      code: 'LU-IMO',
      sections: [
        { name: 'Office of the IMO Manager', code: 'OIMOM' },
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operations Section', code: 'OS' }
      ]
    },
    { 
      name: 'PANGASINAN IMO', 
      code: 'PG-IMO',
      sections: [
        { name: 'Office of the IMO Manager', code: 'OIMOM' },
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation & Maintenance Section', code: 'OMS' }
      ]
    }
  ],
  'REGION II': [
    { 
      name: 'ISABELA IMO', 
      code: 'ISA-IMO',
      sections: [
        { name: 'Engineering - Construction', code: 'EC' },
        { name: 'Engineering - Planning and Design', code: 'EPD' },
        { name: 'Engineering - Operations', code: 'EO' },
        { name: 'Engineering - Equipment', code: 'EE' },
        { name: 'Engineering - Institutional Development', code: 'EID' },
        { name: 'Administrative and Finance Section', code: 'AFS' }
      ]
    },
    { 
      name: 'QUIRINO IMO', 
      code: 'QUI-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'NUEVA VIZCAYA IMO', 
      code: 'NV-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'CAGAYAN-BATANES IMO', 
      code: 'CB-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    }
  ],
  'REGION III': [
    { 
      name: 'BATAAN-ZAMBALES IMO', 
      code: 'BZ-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'PAMPANGA IMO', 
      code: 'PAM-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'BULACAN-AURORA IMO', 
      code: 'BA-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'TARLAC IMO', 
      code: 'TAR-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    }
  ],
  'REGION IV-A': [
    { 
      name: 'LAGUNA-RIZAL IMO', 
      code: 'LR-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'BATANGAS IMO', 
      code: 'BAT-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'QUEZON IMO', 
      code: 'QUE-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'CAVITE IMO', 
      code: 'CAV-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    }
  ],
  'REGION IV-B': [
    { 
      name: 'MINDORO ORIENTAL-MARINDUQUE IMO', 
      code: 'MOM-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'MINDORO OCCIDENTAL IMO', 
      code: 'MOCC-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'PALAWAN IMO', 
      code: 'PAL-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'ROMBLON IMO', 
      code: 'ROM-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    }
  ],
  'REGION V': [
    { 
      name: 'CAMARINES SUR IMO', 
      code: 'CS-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'CAMARINES NORTE IMO', 
      code: 'CN-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'ALBAY-CATANDUANES IMO', 
      code: 'AC-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'SORSOGON-MASBATE IMO', 
      code: 'SM-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    }
  ],
  'REGION VI': [
    { 
      name: 'ILOILO-GUIMARAS IMO', 
      code: 'IG-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'AKLAN-CAPIZ IMO', 
      code: 'AKC-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'NEGROS OCCIDENTAL IMO', 
      code: 'NO-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'ANTIQUE IMO', 
      code: 'ANT-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    }
  ],
  'REGION VII': [
    { 
      name: 'BOHOL IMO', 
      code: 'BOH-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'CEBU IMO', 
      code: 'CEB-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'NEGROS ORIENTAL-SIQUIJOR IMO', 
      code: 'NOS-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    }
  ],
  'REGION VIII': [
    { 
      name: 'LEYTE-BILIRAN IMO', 
      code: 'LB-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'SAMAR-NORTHERN SAMAR IMO', 
      code: 'SNS-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'EASTERN SAMAR IMO', 
      code: 'ES-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'SOUTHERN LEYTE IMO', 
      code: 'SL-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    }
  ],
  'REGION IX': [
    { 
      name: 'ZAMBOANGA DEL SUR IMO', 
      code: 'ZDS-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'ZAMBOANGA DEL NORTE IMO', 
      code: 'ZDN-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'ZAMBOANGA-SIBUGAY IMO', 
      code: 'ZS-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    }
  ],
  'REGION X': [
    { 
      name: 'BUKIDNON IMO', 
      code: 'BUK-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'LANAO DEL NORTE-MISAMIS OCCIDENTAL IMO', 
      code: 'LNMO-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'MISAMIS ORIENTAL-CAMIGUIN IMO', 
      code: 'MOC-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    }
  ],
  'REGION XI': [
    { 
      name: 'DAVAO DEL SUR-DAVAO OCCIDENTAL IMO', 
      code: 'DDSDO-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'DAVAO DEL NORTE-DAVAO DE ORO IMO', 
      code: 'DDNDDO-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'DAVAO ORIENTAL IMO', 
      code: 'DO-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    }
  ],
  'REGION XII': [
    { 
      name: 'SOUTH COTABATO-SARANGANI IMO', 
      code: 'SCS-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'SULTAN KUDARAT IMO', 
      code: 'SK-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'NORTH COTABATO IMO', 
      code: 'NC-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    }
  ],
  'CAR': [
    { 
      name: 'KALINGA-APAYAO IMO', 
      code: 'KA-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'MT. PROVINCE-IFUGAO IMO', 
      code: 'MPI-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'ABRA-BENGUET IMO', 
      code: 'AB-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    }
  ],
  'CARAGA': [
    { 
      name: 'AGUSAN DEL SUR IMO', 
      code: 'ADS-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'AGUSAN DEL NORTE-SURIGAO DEL NORTE IMO', 
      code: 'ADNSDN-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    },
    { 
      name: 'SURIGAO DEL SUR IMO', 
      code: 'SDS-IMO',
      sections: [
        { name: 'Engineering Section', code: 'ES' },
        { name: 'Administrative and Finance Section', code: 'AFS' },
        { name: 'Operation and Maintenance Section', code: 'OMS' }
      ]
    }
  ]
};

async function fixIrrigationManagementOfficeData() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    const departmentsCollection = db.collection('departments');
    const regionsCollection = db.collection('regions');
    const mappingsCollection = db.collection('departmentdivisionmappings');
    
    // Find IRRIGATION MANAGEMENT OFFICE department
    const imoDept = await departmentsCollection.findOne({ Department: 'IRRIGATION MANAGEMENT OFFICE' });
    
    if (!imoDept) {
      console.log('❌ IRRIGATION MANAGEMENT OFFICE department not found');
      return;
    }
    
    console.log(`✅ Found IRRIGATION MANAGEMENT OFFICE: ${imoDept._id}`);
    
    // Get all regions
    const regions = await regionsCollection.find({}).toArray();
    console.log(`✅ Found ${regions.length} regions`);
    
    let updatedCount = 0;
    let createdCount = 0;
    
    // Process each region
    for (const region of regions) {
      const regionName = region.Region;
      const provincialIMOs = PROVINCIAL_IMO_STRUCTURE[regionName];
      
      if (!provincialIMOs) {
        console.log(`⚠️  No Provincial IMO structure defined for ${regionName}`);
        continue;
      }
      
      console.log(`\n📍 Processing ${regionName}...`);
      
      // Check if mapping exists for this region
      const existingMapping = await mappingsCollection.findOne({
        departmentId: imoDept._id,
        regionId: region._id
      });
      
      if (existingMapping) {
        // Update existing mapping
        const result = await mappingsCollection.updateOne(
          { _id: existingMapping._id },
          {
            $set: {
              departmentName: 'IRRIGATION MANAGEMENT OFFICE',
              regionName: regionName,
              divisions: provincialIMOs,
              updatedAt: new Date()
            }
          }
        );
        
        if (result.modifiedCount > 0) {
          console.log(`   ✅ Updated mapping for ${regionName} with ${provincialIMOs.length} Provincial IMOs`);
          updatedCount++;
        }
      } else {
        // Create new mapping
        const newMapping = {
          departmentId: imoDept._id,
          departmentName: 'IRRIGATION MANAGEMENT OFFICE',
          regionId: region._id,
          regionName: regionName,
          divisions: provincialIMOs,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await mappingsCollection.insertOne(newMapping);
        console.log(`   ✅ Created new mapping for ${regionName} with ${provincialIMOs.length} Provincial IMOs`);
        createdCount++;
      }
    }
    
    console.log(`\n✅ Fix completed!`);
    console.log(`   - Updated: ${updatedCount} mappings`);
    console.log(`   - Created: ${createdCount} mappings`);
    
  } catch (error) {
    console.error('❌ Error fixing IRRIGATION MANAGEMENT OFFICE data:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ MongoDB connection closed');
  }
}

// Run the script
if (require.main === module) {
  fixIrrigationManagementOfficeData()
    .then(() => {
      console.log('\n🎉 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixIrrigationManagementOfficeData };