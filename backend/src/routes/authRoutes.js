const express = require('express');
const User = require('../models/User');
const { Magic } = require('@magic-sdk/admin');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Initialize Magic Admin SDK
const magic = new Magic(process.env.MAGIC_SECRET_KEY);

// Request Magic Link route
router.post('/request-magic-link', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ 
                message: 'Email is required' 
            });
        }

        // Generate a Magic Link 
        const didToken = await magic.auth.generateEmailOTP({ 
            email
        });

        res.status(200).json({
            message: 'Magic link sent to your email',
            email
        });
    } catch (error) {
        console.error('Magic Link Request Error:', error);
        res.status(500).json({ 
            message: 'Failed to send magic link. Please try again.' 
        });
    }
});

// Verify Magic Link token and log in
router.post('/verify', async (req, res) => {
    try {
        const { email, didToken } = req.body;

        // Validate input
        if (!email || !didToken) {
            return res.status(400).json({ 
                message: 'Missing required fields' 
            });
        }

        // Validate Magic Link token
        try {
            await magic.token.validate(didToken);
        } catch (validationError) {
            console.error('Magic Link Token Validation Error:', validationError);
            return res.status(401).json({ 
                message: 'Invalid Magic Link token' 
            });
        }

        // Find or create user
        let user = await User.findOne({ email });

        if (!user) {
            // Create new user
            try {
                user = new User({
                    email,
                    username: email.split('@')[0]
                });

                await user.save();
            } catch (saveError) {
                console.error('User Creation Error:', saveError);
                return res.status(500).json({ 
                    message: 'Failed to create user account' 
                });
            }
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                id: user._id, 
                email: user.email
            }, 
            process.env.JWT_SECRET, 
            { 
                expiresIn: '1d'
            }
        );

        // Successful response
        res.status(200).json({
            token,
            user: {
                id: user._id,
                email: user.email,
                username: user.username
            }
        });
    } catch (error) {
        console.error('Authentication Error:', error);
        res.status(500).json({ 
            message: 'Authentication failed. Please try again.' 
        });
    }

});

// Add this temporary code to your authRoutes.js for testing
// DO NOT USE IN PRODUCTION
router.get('/test-token', async (req, res) => {
    try {
      const testToken = await magic.auth.generateTestToken('your-test-email@example.com');
      res.json({ didToken: testToken });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

module.exports = router;