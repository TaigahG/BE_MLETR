const mongoose = require('mongoose');
require('dotenv').config();

const connectDatabase = async () => {
    try {
        const connectionString = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/document_management';
        console.log('Connecting to MongoDB: ', connectionString);
        
        await mongoose.connect(connectionString, {
            serverSelectionTimeoutMS: 30000, 
            socketTimeoutMS: 45000, 

            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        mongoose.connection.on('connected', () => {
            console.log('MongoDB connection established successfully');
        });
        
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB connection disconnected');
        });
        
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            console.log('MongoDB connection closed due to app termination');
            process.exit(0);
        });
        
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error.message);
        process.exit(1);
    }
};

module.exports = connectDatabase;