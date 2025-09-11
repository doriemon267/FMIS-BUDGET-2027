const mongoose = require('mongoose')
module.exports = async () => {
    try {
        // Remove deprecated options - they have no effect since Node.js Driver version 4.0.0
        await mongoose.connect(process.env.MONGODB_URL)
        // // Test the connection with a simple query
        const db = mongoose.connection.db;
        await db.admin().ping();
        } catch (e) {
        console.error('❌ Error connecting to MongoDB:', e.message)
        process.exit(1)
    }
}