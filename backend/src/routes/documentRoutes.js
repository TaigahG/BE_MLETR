// documentRoutes.js
const express = require('express');
const DocumentController = require('../controllers/documentController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post(
    '/create', 
    authMiddleware.authenticate,
    DocumentController.createDocument
);

router.post(
    '/:documentId/verify', 
    authMiddleware.authenticate,
    DocumentController.verifyDocument
);

router.post(
    '/:documentId/transfer', 
    authMiddleware.authenticate,
    DocumentController.transferDocument
);

router.get(
    '/job-status/:queueName/:jobId',
    authMiddleware.authenticate,
    DocumentController.getJobStatus
);

router.get(
    '/:documentId/history',
    authMiddleware.authenticate,
    DocumentController.getDocumentHistory
);

module.exports = router;