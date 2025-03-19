const mongoose = require('mongoose');
require('dotenv').config();

const connectDatabase = async () => {
    try {
        // Updated connection string
        const connectionString = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/documentmanagement';
        
        await mongoose.connect(connectionString, {
            // Remove deprecated options
        });
        
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error.message);
        process.exit(1);
    }
};

module.exports = connectDatabase;
