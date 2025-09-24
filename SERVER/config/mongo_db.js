const mongoose = require('mongoose')

// Create connection for main database
const mainConnection = mongoose.createConnection(process.env.MONGODB_MAIN_URL, {
  // options if needed
});

module.exports = async () => {
    try {
        // Connect default database (budget)
        await mongoose.connect(process.env.MONGODB_BUDGET_URL)
        console.log('✅ Connected to FMIS Budget DB');

        // Connect main database
        await mainConnection.asPromise();
        console.log('✅ Connected to FMIS Main DB');

        // Test the default connection
        const db = mongoose.connection.db;
        await db.admin().ping();
    } catch (e) {
        console.error('❌ Error connecting to MongoDB:', e.message)
        process.exit(1)
    }
}

// Export connections for use in models
module.exports.mainConnection = mainConnection;