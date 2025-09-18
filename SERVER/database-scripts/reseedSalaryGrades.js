const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const SalaryGrade = require('../models/SalarySelection');

// Correctly resolve the path to the .env file
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const permanentSalaryData = [
    { sg: '1', rates: [13000, 13111, 13223, 13334, 13446, 13557, 13669, 13780] },
    { sg: '2', rates: [13819, 13927, 14036, 14144, 14253, 14361, 14470, 14578] },
    { sg: '3', rates: [14678, 14793, 14909, 15024, 15140, 15255, 15371, 15486] },
    { sg: '4', rates: [15586, 15706, 15825, 15945, 16064, 16183, 16302, 16420] },
    { sg: '5', rates: [16666, 16489, 16819, 17155, 17499, 17849, 18206, 18570] },
    { sg: '6', rates: [17325, 17585, 17849, 18116, 18388, 18664, 18944, 19228] },
    { sg: '7', rates: [17905, 18084, 18265, 18448, 18632, 18818, 19007, 19644] },
    { sg: '8', rates: [19744, 19928, 20111, 20295, 20478, 20662, 20845, 21029] },
    { sg: '9', rates: [21129, 21446, 21768, 22094, 22426, 22762, 23103, 23450] },
    { sg: '10', rates: [23094, 23325, 23558, 23794, 24032, 24272, 24515, 24567] },
    { sg: '11', rates: [27000, 27405, 27816, 28233, 28657, 29087, 29523, 29966] },
    { sg: '12', rates: [29417, 29682, 29949, 30218, 30490, 30765, 31042, 31230] },
    { sg: '13', rates: [31320, 31790, 32267, 32751, 33242, 33741, 34247, 34760] },
    { sg: '14', rates: [34189, 34531, 34876, 35225, 35577, 35933, 36292, 36341] },
    { sg: '15', rates: [36619, 37351, 38098, 38860, 39638, 40430, 41239, 42064] },
    { sg: '16', rates: [39401, 39992, 40592, 41201, 41819, 42446, 43083, 43729] },
    { sg: '17', rates: [42182, 42604, 43030, 43460, 43895, 44334, 44777, 46355] },
    { sg: '18', rates: [46725, 51386, 52671, 53987, 55337, 56721, 58139, 59592] },
    { sg: '19', rates: [51386, 52825, 54304, 55824, 57387, 58994, 60646, 62344] },
    { sg: '20', rates: [60707, 61921, 63160, 64423, 65711, 67025, 68366, 69733] },
    { sg: '21', rates: [65367, 67001, 68676, 70393, 72153, 73957, 75806, 79349] },
    { sg: '22', rates: [80003, 81603, 83235, 84900, 86598, 88330, 90096, 91898] },
    { sg: '23', rates: [82987, 84847, 86340, 88066, 89828, 91624, 93457, 95326] },
    { sg: '24', rates: [91937, 93132, 94343, 95569, 96812, 98070, 99345, 100888] },
    { sg: '25', rates: [102690, 106586, 110483, 114379, 118275, 122171, 126068, 129964] },
    { sg: '26', rates: [131124, 133372, 135620, 137868, 140115, 142363, 144611, 146859] },
    { sg: '27', rates: [148171, 150711, 153251, 155791, 158331, 160871, 163411, 165951] },
    { sg: '28', rates: [167432, 170302, 173173, 176043, 178914, 181784, 184655, 187525] },
    { sg: '29', rates: [189199, 192442, 195686, 198929, 202172, 205415, 208659, 211902] },
    { sg: '30', rates: [278434, 284201, 289969, 295736, 301504, 307271, 313039, 318806] },
    { sg: '31', rates: [331954, 339067, 346181, 353294, 360408, 367521, 374635, 381748] },
    { sg: '32', rates: [419144, 422737, 426329, 429922, 433514, 437107, 440699, 444292] },
];

const casualSalaryData = [
    { jg: '2', rates: [13000, 13111, 13223, 13334, 13446, 13557, 13669, 13780] },
    { jg: '3', rates: [13819, 13927, 14036, 14144, 14253, 14361, 14470, 14578] },
    { jg: '4', rates: [14678, 14793, 14909, 15024, 15140, 15255, 15371, 15486] },
    { jg: '5', rates: [15586, 16166, 16745, 17325, 17905, 18485, 19064, 19644] },
    { jg: '6', rates: [19744, 19928, 20111, 20295, 20478, 20662, 20845, 21029] },
    { jg: '7', rates: [21129, 21620, 22111, 22602, 23094, 23585, 24076, 24567] },
    { jg: '8', rates: [27000, 27604, 28209, 28813, 29417, 30021, 30626, 31230] },
    { jg: '9', rates: [31320, 32037, 32755, 33472, 34189, 34906, 35624, 36341] },
    { jg: '10', rates: [36619, 38010, 39401, 40792, 42182, 43573, 44964, 46355] },
    { jg: '11', rates: [46725, 51386, 56046, 60707, 65367, 70028, 74688, 79349] },
    { jg: '12', rates: [80003, 82987, 85970, 88954, 91937, 94921, 97904, 100888] },
    { jg: '13', rates: [102690, 106586, 110483, 114379, 118275, 122171, 126068, 129964] },
    { jg: '14', rates: [131124, 133372, 135620, 137868, 140115, 142363, 144611, 146859] },
    { jg: '15', rates: [148171, 150711, 153251, 155791, 158331, 160871, 163411, 165951] },
    { jg: '16', rates: [167432, 170302, 173173, 176043, 178914, 181784, 184655, 187525] },
    { jg: '17', rates: [189199, 192442, 195686, 198929, 202172, 205415, 208659, 211902] },
    { jg: '18', rates: [278434, 284201, 289969, 295736, 301504, 307271, 313039, 318806] },
    { jg: '19', rates: [331954, 339067, 346181, 353294, 360408, 367521, 374635, 381748] },
    { jg: '20', rates: [419144, 422737, 426329, 429922, 433514, 437107, 440699, 444292] },
];

const reseedSalaryGrades = async () => {
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

        // Step 1: Delete all existing documents
        console.log("\n--- STEP 1: DELETING ALL EXISTING SALARY GRADES ---");
        const deleteResult = await SalaryGrade.deleteMany({});
        console.log(`🔥 ${deleteResult.deletedCount} documents deleted from 'salarygrades' collection.`);

        // Step 2: Verify that the collection is empty
        const countAfterDelete = await SalaryGrade.countDocuments({});
        console.log(`📄 Verification: Collection now has ${countAfterDelete} documents.`);
        if (countAfterDelete !== 0) {
            console.error("❌ ERROR: Collection is not empty after deletion. Aborting.");
            return;
        }
        console.log("✅ Verification successful. Collection is empty.");

        // Step 3: Insert new permanent salary grades
        console.log("\n--- STEP 2: INSERTING NEW SALARY GRADES ---");
        const permanentDocs = permanentSalaryData.map(item => {
            const ratesMap = new Map();
            item.rates.forEach((rate, index) => {
                ratesMap.set((index + 1).toString(), rate);
            });
            return {
                salary_grade: item.sg,
                steps: Array.from({ length: 8 }, (_, i) => i + 1),
                rates: ratesMap,
            };
        });
        await SalaryGrade.insertMany(permanentDocs);
        console.log(`🌱 ${permanentDocs.length} PERMANENT salary grade records inserted.`);

        // Step 4: Insert new casual job grades
        const casualDocs = casualSalaryData.map(item => {
            const ratesMap = new Map();
            item.rates.forEach((rate, index) => {
                ratesMap.set((index + 1).toString(), rate);
            });
            return {
                job_grade: item.jg,
                steps: Array.from({ length: 8 }, (_, i) => i + 1),
                rates: ratesMap,
            };
        });
        await SalaryGrade.insertMany(casualDocs);
        console.log(`🌱 ${casualDocs.length} CASUAL job grade records inserted.`);

        // Step 5: Final verification
        const finalCount = await SalaryGrade.countDocuments({});
        console.log(`\n--- STEP 3: FINAL VERIFICATION ---`);
        console.log(`✨ Reseeding complete. Collection now contains ${finalCount} documents.`);

    } catch (error) {
        console.error('❌ An error occurred during the reseeding process:', error);
    } finally {
        mongoose.disconnect();
        console.log("\n🔌 Database connection closed.");
    }
};

reseedSalaryGrades();
