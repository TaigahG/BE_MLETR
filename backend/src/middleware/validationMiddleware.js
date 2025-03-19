const { body, param, validationResult } = require('express-validator');

class ValidationMiddleware {
    // Validation for document creation
    validateDocumentCreation() {
        return [
            body('documentType')
                .isIn(['Transferable', 'Verifiable'])
                .withMessage('Invalid document type'),
            body('metadata')
                .notEmpty()
                .withMessage('Metadata is required'),
            this.handleValidationErrors
        ];
    }

    // Validation for document transfer
    validateDocumentTransfer() {
        return [
            body('documentId')
                .isMongoId()
                .withMessage('Invalid document ID'),
            body('recipient')
                .isMongoId()
                .withMessage('Invalid recipient ID'),
            this.handleValidationErrors
        ];
    }

    // Validation for user registration
    validateUserRegistration() {
        return [
            body('username')
                .isLength({ min: 3 })
                .withMessage('Username must be at least 3 characters long'),
            body('email')
                .isEmail()
                .withMessage('Invalid email address'),
            body('password')
                .isLength({ min: 6 })
                .withMessage('Password must be at least 6 characters long'),
            this.handleValidationErrors
        ];
    }

    // Handle validation errors
    handleValidationErrors(req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                errors: errors.array() 
            });
        }
        next();
    }
}

module.exports = new ValidationMiddleware();
