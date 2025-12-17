const mongoose = require('mongoose')

// Create connection for main database
const mainConnection = mongoose.createConnection(process.env.MONGODB_MAIN_URL,
     {
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
        // In DEBUG or when mock auth is enabled, don't crash the entire server - log and allow the server to boot
        if (process.env.DEBUG_MODE === 'true' || process.env.ALLOW_MOCK_AUTH === 'true') {
            console.warn('⚠️ Starting server in debug/mock mode without active MongoDB connection. Some features will be limited.');
            return; // return early; server continues without DB
        }
        process.exit(1)
    }
}

// Export connections for use in models
module.exports.mainConnection = mainConnection;