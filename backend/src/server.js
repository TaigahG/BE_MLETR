require('dotenv').config();
const http = require('http');
const app = require('./app');

// Graceful shutdown handler
const gracefulShutdown = (server) => {
    const signals = ['SIGINT', 'SIGTERM'];
    
    signals.forEach(signal => {
        process.on(signal, () => {
            console.log(`Received ${signal}. Shutting down gracefully...`);
            
            server.close(() => {
                console.log('HTTP server closed.');
                
                // Close database connections or other resources if needed
                process.exit(0);
            });

            // Force close server after 10 seconds
            setTimeout(() => {
                console.error('Could not close connections in time, forcefully shutting down');
                process.exit(1);
            }, 10000);
        });
    });
};

// Create HTTP server
const server = http.createServer(app.getApp());

// Server configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Start server
server.listen(PORT, HOST, () => {
    console.log(`🚀 Server running on ${HOST}:${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Setup graceful shutdown
gracefulShutdown(server);

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    
    // Optional: Crash the process
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    
    // Optional: Crash the process
    process.exit(1);
});

module.exports = server;
