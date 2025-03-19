const errorHandler = (err, req, res, next) => {
    // Log the error
    console.error('Global Error Handler:', {
        message: err.message,
        stack: err.stack,
        status: err.status || 500
    });

    // Determine status code
    const statusCode = err.status || 500;

    // Error response
    const errorResponse = {
        success: false,
        status: statusCode,
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { 
            stack: err.stack 
        })
    };

    // Send error response
    res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;
