require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDatabase = require('./config/database');

const gracefulShutdown = (server) => {
    const signals = ['SIGINT', 'SIGTERM'];
    
    signals.forEach(signal => {
        process.on(signal, () => {
            console.log(`Received ${signal}. Shutting down gracefully...`);
            
            server.close(() => {
                console.log('HTTP server closed.');
                
                process.exit(0);
            });

            setTimeout(() => {
                console.error('Could not close connections in time, forcefully shutting down');
                process.exit(1);
            }, 10000);
        });
    });
};

async function startServer() {
    try {
        console.log('Connecting to database...');
        await connectDatabase();
        console.log('Database connection established.');

        // Get app instance
        const expressApp = app.getApp();

        // Create HTTP server
        const server = http.createServer(expressApp);

        const PORT = process.env.PORT || 3000;
        const HOST = process.env.HOST || '0.0.0.0';

        server.listen(PORT, HOST, () => {
            console.log(`🚀 Server running on ${HOST}:${PORT}`);
            console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
        });

        gracefulShutdown(server);
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Run the server
startServer();