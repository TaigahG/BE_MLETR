const express = require('express');
const TransferController = require('../controllers/transferController');
const AuthMiddleware = require('../middleware/authMiddleware');
const ValidationMiddleware = require('../middleware/validationMiddleware');

const router = express.Router();

router.post(
    '/initiate', 
    AuthMiddleware.authenticate,
    ValidationMiddleware.validateDocumentTransfer(),
    TransferController.initiateTransfer
);

router.post(
    '/:transferId/approve', 
    AuthMiddleware.authenticate,
    TransferController.approveTransfer
);

router.post(
    '/:transferId/reject', 
    AuthMiddleware.authenticate,
    TransferController.rejectTransfer
);

router.get(
    '/history/:documentId', 
    AuthMiddleware.authenticate,
    TransferController.getTransferHistory
);

module.exports = router;
