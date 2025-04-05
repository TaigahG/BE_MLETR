const errorHandler = (err, req, res, next) => {
    let statusCode = err.status || 500;
    let errorType = 'SERVER_ERROR';
    
    if (err.name === 'ValidationError') {
      statusCode = 400;
      errorType = 'VALIDATION_ERROR';
    } else if (err.name === 'JsonWebTokenError') {
      statusCode = 401;
      errorType = 'AUTH_ERROR';
    } else if (err.name === 'DocumentVerificationError') {
      statusCode = 400;
      errorType = 'VERIFICATION_ERROR';
    }
    
    console.error('Error:', {
      type: errorType,
      message: err.message,
      stack: err.stack,
      status: statusCode
    });
  
    const errorResponse = {
      success: false,
      status: statusCode,
      type: errorType,
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { 
        stack: err.stack 
      })
    };
  
    res.status(statusCode).json(errorResponse);
  };
  
  module.exports = errorHandler;