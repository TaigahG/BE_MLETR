const express = require('express');
const QRCode = require('qrcode');
const speakeasy = require('speakeasy');
const User = require('../models/User');
const AuthMiddleware = require('../middleware/authMiddleware');
const { Magic } = require('@magic-sdk/admin');

const router = express.Router();

// Initialize Magic Admin SDK
const magic = new Magic(process.env.MAGIC_SECRET_KEY);

// Generate 2FA Secret
router.post('/generate-secret', AuthMiddleware.authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        
        // Generate secret
        const secret = user.generateTwoFactorSecret();
        await user.save();

        // Generate QR code
        const otpAuthUrl = speakeasy.totp.keyuri(
            user.email, 
            'Document Management', 
            secret.base32
        );
        
        const qrCode = await QRCode.toDataURL(otpAuthUrl);

        res.json({
            secret: secret.base32,
            qrCode
        });
    } catch (error) {
        res.status(500).json({ 
            message: 'Failed to generate 2FA secret', 
            error: error.message 
        });
    }
});

// Enable Two-Factor Authentication
router.post('/enable', AuthMiddleware.authenticate, async (req, res) => {
    try {
        const { token } = req.body;
        const user = await User.findById(req.user._id).select('+twoFactorSecret');

        // Verify token
        const isValid = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: token
        });

        if (!isValid) {
            return res.status(400).json({ 
                message: 'Invalid token. Two-factor authentication not enabled.' 
            });
        }

        // Enable 2FA
        user.twoFactorEnabled = true;
        await user.save();

        res.json({ 
            message: 'Two-factor authentication enabled successfully' 
        });
    } catch (error) {
        res.status(500).json({ 
            message: 'Failed to enable two-factor authentication', 
            error: error.message 
        });
    }
});

// Disable Two-Factor Authentication
router.post('/disable', AuthMiddleware.authenticate, async (req, res) => {
    try {
        const { token } = req.body;
        const user = await User.findById(req.user._id).select('+twoFactorSecret');

        // Verify current token
        const isValid = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: token
        });

        if (!isValid) {
            return res.status(400).json({ 
                message: 'Invalid token. Two-factor authentication not disabled.' 
            });
        }

        // Disable 2FA
        user.twoFactorEnabled = false;
        user.twoFactorSecret = undefined;
        await user.save();

        res.json({ 
            message: 'Two-factor authentication disabled successfully' 
        });
    } catch (error) {
        res.status(500).json({ 
            message: 'Failed to disable two-factor authentication', 
            error: error.message 
        });
    }
});

// Magic Link Authentication
router.post('/magic-link', async (req, res) => {
    try {
        const { email } = req.body;
        
        // Check if user exists
        let user = await User.findOne({ email });
        
        if (!user) {
            // Create new user if not exists
            user = new User({ 
                email, 
                username: email.split('@')[0] 
            });
        }

        // Generate Magic Link
        const didToken = await magic.auth.createToken({ 
            email,
            // Optional: add metadata
            metadata: {
                userId: user._id.toString()
            }
        });

        // Mark user as Magic Link verified
        user.magicLinkVerified = true;
        await user.save();

        res.json({ 
            message: 'Magic Link generated',
            didToken 
        });
    } catch (error) {
        res.status(500).json({ 
            message: 'Magic Link generation failed', 
            error: error.message 
        });
    }
});

// Verify Magic Link
router.post('/verify-magic-link', async (req, res) => {
    try {
        const { didToken } = req.body;
        
        // Validate Magic Link
        const metadata = await magic.auth.getMetadataByToken(didToken);
        
        // Find or create user
        let user = await User.findById(metadata.userId);
        
        if (!user) {
            return res.status(404).json({ 
                message: 'User not found' 
            });
        }

        // Generate JWT
        const token = AuthMiddleware.generateToken(user);

        res.json({
            message: 'Magic Link verified',
            user: {
                id: user._id,
                email: user.email,
                magicLinkVerified: user.magicLinkVerified
            },
            token
        });
    } catch (error) {
        res.status(401).json({ 
            message: 'Magic Link verification failed', 
            error: error.message 
        });
    }
});

module.exports = router;
