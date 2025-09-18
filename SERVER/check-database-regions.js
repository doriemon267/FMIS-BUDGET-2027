const mongoose = require('mongoose');

// Check database for NCR and all regions
async function checkDatabaseRegions() {
    const dbUrl = 'mongodb://localhost:27017/fmis_budget';

    console.log('🔍 Checking database for NCR and all regions...\n');

    try {
        await mongoose.connect(dbUrl);
        console.log('✅ Connected to database');

        // Get the regions collection
        const Region = mongoose.connection.db.collection('regions');

        // Get all regions
        const allRegions = await Region.find({}).toArray();

        console.log(`📊 Total regions in database: ${allRegions.length}`);
        console.log('🏷️  All regions:');

        allRegions.forEach((region, index) => {
            console.log(`   ${index + 1}. ${region.Region || region.name || 'Unknown'}`);
        });

        // Check specifically for NCR
        const ncrRegion = await Region.findOne({ Region: 'NCR' });
        console.log(`\n🔍 NCR in database: ${ncrRegion ? 'YES' : 'NO'}`);

        if (ncrRegion) {
            console.log(`   NCR details: ${JSON.stringify(ncrRegion, null, 2)}`);
        }

        // Check for Central Office
        const centralOffice = await Region.findOne({ Region: 'Central Office' });
        console.log(`🏢 Central Office in database: ${centralOffice ? 'YES' : 'NO'}`);

        if (centralOffice) {
            console.log(`   Central Office details: ${JSON.stringify(centralOffice, null, 2)}`);
        }

        await mongoose.disconnect();
        console.log('✅ Disconnected from database');

    } catch (error) {
        console.error('❌ Database connection error:', error.message);
    }
}

checkDatabaseRegions();