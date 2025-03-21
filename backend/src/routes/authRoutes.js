const express = require('express');
const User = require('../models/User');
const { Magic } = require('@magic-sdk/admin');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

const magic = new Magic(process.env.MAGIC_SECRET_KEY);

router.post('/verify', async (req, res) => {
    try {
        const didToken = req.headers.authorization ? req.headers.authorization.substr(7) : null;
        
        if (!didToken) {
            return res.status(400).json({ 
                success: false,
                message: 'Missing DID token in authorization header' 
            });
        }
        
        // Validate the didToken
        try {
            await magic.token.validate(didToken);
        } catch (validationError) {
            console.error('Magic Link Token Validation Error:', validationError);
            return res.status(401).json({ 
                success: false,
                message: 'Invalid Magic Link token' 
            });
        }
        
        const metadata = await magic.users.getMetadataByToken(didToken);
        
        if (!metadata.email) {
            return res.status(400).json({
                success: false,
                message: 'Email information missing from Magic token'
            });
        }

        let user = await User.findOne({ email: metadata.email });

        if (!user) {
            try {
                user = new User({
                    email: metadata.email,
                    username: metadata.email.split('@')[0],
                    walletAddress: metadata.publicAddress || null
                });

                await user.save();
                console.log('New user created:', user.email);
            } catch (saveError) {
                console.error('User Creation Error:', saveError);
                return res.status(500).json({ 
                    success: false,
                    message: 'Failed to create user account',
                    error: saveError.message
                });
            }
        }

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

        // Update last login time
        user.lastLogin = new Date();
        await user.save();

        // Return success response with user data and token
        res.status(200).json({
            success: true,
            message: 'Authentication successful',
            token,
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
                walletAddress: user.walletAddress
            }
        });
    } catch (error) {
        console.error('Authentication Error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Authentication failed. Please try again.',
            error: error.message
        });
    }
});

router.get('/me', authMiddleware.authenticate, async (req, res) => {
    try {
        const user = req.user;
        
        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
                walletAddress: user.walletAddress
            }
        });
    } catch (error) {
        console.error('Get Profile Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get user profile',
            error: error.message
        });
    }
});

router.post('/logout', authMiddleware.authenticate, async (req, res) => {
    try {
        // If it's a Magic Link token, log out from Magic too
        if (req.token.startsWith('did:')) {
            try {
                await magic.users.logoutByToken(req.token);
            } catch (magicError) {
                console.error('Magic logout error:', magicError);
                // Continue even if Magic logout fails
            }
        }
        
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout Error:', error);
        res.status(500).json({
            success: false,
            message: 'Logout failed',
            error: error.message
        });
    }
});

// // TEST endpoint - REMOVE BEFORE PRODUCTION
// router.get('/test-login/:email', async (req, res) => {
//     try {
//       const email = req.params.email;
      
//       // Create or find user
//       let user = await User.findOne({ email });
//       if (!user) {
//         user = new User({
//           email,
//           username: email.split('@')[0]
//         });
//         await user.save();
//       }
      
//       // Generate JWT
//       const token = jwt.sign(
//         { id: user._id, email: user.email },
//         process.env.JWT_SECRET,
//         { expiresIn: '1d' }
//       );
      
//       res.json({
//         success: true,
//         message: "Test login successful (bypasses Magic Link)",
//         token,
//         user: {
//           id: user._id,
//           email: user.email,
//           username: user.username
//         }
//       });
//     } catch (error) {
//       res.status(500).json({ 
//           success: false,
//           error: error.message 
//       });
//     }
// });

module.exports = router;