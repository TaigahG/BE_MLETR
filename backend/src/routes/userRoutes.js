const express = require('express');
const UserController = require('../controllers/userController');
const AuthMiddleware = require('../middleware/authMiddleware');
const ValidationMiddleware = require('../middleware/validationMiddleware');

const router = express.Router();

router.post(
    '/register', 
    ValidationMiddleware.validateUserRegistration(),
    UserController.register
);

router.post(
    '/login', 
    UserController.login
);

router.get(
    '/profile', 
    AuthMiddleware.authenticate,
    UserController.getUserProfile
);

router.put(
    '/profile', 
    AuthMiddleware.authenticate,
    UserController.updateUserProfile
);

router.get(
    '/documents', 
    AuthMiddleware.authenticate,
    UserController.getUserDocuments
);

module.exports = router;
