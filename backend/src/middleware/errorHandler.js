const errorHandler = (err, req, res, next) => {
    console.error('Global Error Handler:', {
        message: err.message,
        stack: err.stack,
        status: err.status || 500
    });

    const statusCode = err.status || 500;

    const errorResponse = {
        success: false,
        status: statusCode,
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { 
            stack: err.stack 
        })
    };

    res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;
