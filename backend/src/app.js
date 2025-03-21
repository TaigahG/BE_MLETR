// Updated app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDatabase = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const BlockchainMonitorService = require('./services/blockchainMonitorService');


// Route imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const documentRoutes = require('./routes/documentRoutes');
const transferRoutes = require('./routes/transferRoutes');
const twoFactorRoutes = require('./routes/twoFactorRoutes');

class App {
    constructor() {
        this.app = express();
        this.initializeMiddlewares();
        this.initializeRoutes();
        this.initializeErrorHandling();
    }

    async initialize() {
        try {
            await connectDatabase();
        
            console.log('✅ Database connected successfully');
            
            // Start blockchain monitoring if enabled
            if (process.env.ENABLE_BLOCKCHAIN_MONITOR === 'true') {
                await BlockchainMonitorService.startMonitoring();
                console.log('✅ Blockchain monitoring started');
            }
            
            return true;
        } catch (error) {
            console.error('❌ Application initialization failed:', error);
            return false;
        }
    }

    initializeMiddlewares() {
        // Security middlewares
        this.app.use(helmet());
        this.app.use(cors({
            origin: process.env.CORS_ORIGIN || '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization']
        }));
        
        // Body parsing
        this.app.use(express.json({ limit: '1mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '1mb' }));
        
        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} [${req.method}] ${req.url}`);
            next();
        });
    }

    initializeRoutes() {
        // API version prefix
        const apiPrefix = '/api/v1';
        
        // Health check routes
        this.app.get('/', (req, res) => {
            res.json({ 
                message: 'Document Management API',
                status: 'OK',
                version: process.env.APP_VERSION || '1.0.0'
            });
        });
        
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'UP',
                timestamp: new Date().toISOString(),
                services: {
                    database: 'UP',
                    blockchain: process.env.ENABLE_BLOCKCHAIN_MONITOR === 'true' ? 'UP' : 'DISABLED'
                }
            });
        });

        // API routes
        this.app.use(`${apiPrefix}/auth`, authRoutes);
        this.app.use(`${apiPrefix}/users`, userRoutes);
        this.app.use(`${apiPrefix}/documents`, documentRoutes);
        this.app.use(`${apiPrefix}/transfers`, transferRoutes);
        this.app.use(`${apiPrefix}/two-factor`, twoFactorRoutes);
        // Add this in your app.js before the 404 handler
        this.app.get('/test', (req, res) => {
            res.json({ message: 'Test route works!' });
        });
        
        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                status: 'error',
                message: 'Resource not found'
            });
        });
    }
    
    initializeErrorHandling() {
        this.app.use(errorHandler);
    }

    getApp() {
        return this.app;
    }
}

module.exports = new App();