const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDatabase = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

class App {
    constructor() {
        this.app = express();
        this.initializeMiddlewares();
        this.initializeRoutes();
        this.initializeErrorHandling();
    }

    initializeMiddlewares() {
        // CORS Configuration
        const corsOptions = {
            origin: function (origin, callback) {
                const allowedOrigins = [
                    'http://localhost:3000',   // Backend server
                    'http://localhost:5173',   // Vite default port
                    'http://localhost:5174',   // Alternative Vite port
                    'http://127.0.0.1:5173',   
                    'http://127.0.0.1:5174'    
                ];

                if (!origin || allowedOrigins.indexOf(origin) !== -1) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'));
                }
            },
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: [
                'Content-Type', 
                'Authorization', 
                'Access-Control-Allow-Methods',
                'Access-Control-Allow-Origin',
                'Access-Control-Allow-Headers'
            ],
            credentials: true,
            optionsSuccessStatus: 200
        };

        this.app.use(cors(corsOptions));

        // Security middleware
        this.app.use(helmet({
            // Disable X-Powered-By header
            hidePoweredBy: true,
            frameguard: { action: 'deny' }
        }));

        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        this.app.use((req, res, next) => {
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
            next();
        });
    }

    initializeRoutes() {
        const apiPrefix = '/api/v1';
        
        // Import routes
        const authRoutes = require('./routes/authRoutes');
        const userRoutes = require('./routes/userRoutes');
        const documentRoutes = require('./routes/documentRoutes');

        this.app.use(`${apiPrefix}/auth`, authRoutes);
        this.app.use(`${apiPrefix}/users`, userRoutes);
        this.app.use(`${apiPrefix}/documents`, documentRoutes);

        this.app.get('/health', (req, res) => {
            res.status(200).json({ 
                status: 'OK', 
                timestamp: new Date().toISOString() 
            });
        });
    }

    initializeErrorHandling() {
        this.app.use(errorHandler);
    }

    async initialize() {
        try {
            await connectDatabase();
            console.log('Database connected successfully');
            return this.app;
        } catch (error) {
            console.error('Application initialization failed:', error);
            process.exit(1);
        }
    }


    getApp() {
        return this.app;
    }
}

module.exports = new App();