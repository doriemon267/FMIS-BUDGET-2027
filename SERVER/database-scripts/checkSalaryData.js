const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const SalaryGrade = require('../models/SalarySelection');

// Correctly resolve the path to the .env file
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const checkSalaryData = async () => {
    try {
        const dbUrl = process.env.MONGODB_URL;
        if (!dbUrl) {
            console.error('🔴 MONGODB_URL not found in .env file.');
            return;
        }
        
        console.log(`🔵 Connecting to database: ${dbUrl}`);
        await mongoose.connect(dbUrl, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ MongoDB Connected...');

        console.log('\n--- Verifying Salary Grades Collection ---');

        // 1. Count all documents
        const totalCount = await SalaryGrade.countDocuments({});
        console.log(`📄 Total documents in 'salarygrades' collection: ${totalCount}`);

        // 2. Check for documents with 'salary_grade' (Permanent)
        const permanentCount = await SalaryGrade.countDocuments({ salary_grade: { $exists: true, $ne: null } });
        console.log(`  - Records with 'salary_grade' (for Permanent): ${permanentCount}`);
        
        // 3. Check for documents with 'job_grade' (Casual)
        const casualCount = await SalaryGrade.countDocuments({ job_grade: { $exists: true, $ne: null } });
        console.log(`  - Records with 'job_grade' (for Casual): ${casualCount}`);

        console.log('\n--- Sample Records ---');

        // 4. Show a sample Permanent record
        console.log('\n🔍 Sample PERMANENT record (SG 24):');
        const samplePermanent = await SalaryGrade.findOne({ salary_grade: '24' });
        if (samplePermanent) {
            console.log(JSON.stringify(samplePermanent, null, 2));
        } else {
            console.log('  - No record found for SG 24.');
        }

        // 5. Show a sample Casual record
        console.log('\n🔍 Sample CASUAL record (JG 12):');
        const sampleCasual = await SalaryGrade.findOne({ job_grade: '12' });
        if (sampleCasual) {
            console.log(JSON.stringify(sampleCasual, null, 2));
        } else {
            console.log('  - No record found for JG 12.');
        }

    } catch (error) {
        console.error('❌ Error checking database:', error);
    } finally {
        console.log('\n--- Verification Complete ---');
        mongoose.disconnect();
    }
};

checkSalaryData();
