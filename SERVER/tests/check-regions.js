const mongoose = require('mongoose');

// Check what regions exist in the employees collection
async function checkRegions() {
    try {
        await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('🔵 Connected to database...\n');

        const db = mongoose.connection.db;
        const collection = db.collection('employees');

        // Get distinct regions
        const regions = await collection.distinct('Region');
        console.log('🌍 Available Regions in Database:');
        regions.forEach((region, index) => {
            console.log(`   ${index + 1}. ${region}`);
        });

        console.log(`\n📊 Total unique regions: ${regions.length}`);

        // Count employees per region
        console.log('\n📈 Employee count by region:');
        for (const region of regions) {
            const count = await collection.countDocuments({ Region: region });
            console.log(`   ${region}: ${count} employees`);
        }

        // Check if NCR exists
        const ncrExists = regions.includes('NCR');
        console.log(`\n🔍 NCR exists in database: ${ncrExists ? 'YES' : 'NO'}`);

        if (ncrExists) {
            const ncrCount = await collection.countDocuments({ Region: 'NCR' });
            console.log(`   NCR employee count: ${ncrCount}`);
        }

        await mongoose.disconnect();
        console.log('\n✅ Database check completed!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkRegions();