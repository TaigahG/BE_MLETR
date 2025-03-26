const express = require('express');
const DocumentController = require('../controllers/documentController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post(
    '/upload',
    authMiddleware.authenticate,
    DocumentController.uploadFile(),
    DocumentController.handleFileUpload
);

router.post(
    '/create', 
    authMiddleware.authenticate,
    DocumentController.createDocument
);

router.get(
    '/user',
    authMiddleware.authenticate,
    DocumentController.getUserDocuments
);

router.get(
    '/:documentId',
    authMiddleware.authenticate,
    DocumentController.getDocumentDetails
);

router.get(
    '/:documentId/history',
    authMiddleware.authenticate,
    DocumentController.getDocumentHistory
);

router.get(
    '/:documentId/download',
    authMiddleware.authenticate,
    DocumentController.downloadDocument
);

router.get(
    '/download-all',
    authMiddleware.authenticate,
    DocumentController.downloadAllDocuments
);

router.get(
    '/job-status/:queueName/:jobId',
    authMiddleware.authenticate,
    DocumentController.getJobStatus
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

module.exports = router;