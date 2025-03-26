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
                message: 'Missing token in authorization header' 
            });
        }
        
        let userMetadata;
        
        try {
            try {
                const buff = Buffer.from(didToken, 'base64');
                const decodedToken = buff.toString('utf-8');
                
                await magic.token.validate(didToken);
                
                userMetadata = await magic.users.getMetadataByToken(didToken);
            } catch (decodeError) {
                if (didToken.startsWith('did:')) {
                    await magic.token.validate(didToken);
                    userMetadata = await magic.users.getMetadataByToken(didToken);
                } else {
                    throw new Error('Invalid token format');
                }
            }
        } catch (validationError) {
            console.error('Magic Link Token Validation Error:', validationError);
            return res.status(401).json({ 
                success: false,
                message: 'Invalid authentication token' 
            });
        }
        
        if (!userMetadata || !userMetadata.email) {
            return res.status(400).json({
                success: false,
                message: 'Email information missing from token'
            });
        }

        let user = await User.findOne({ email: userMetadata.email });

        if (!user) {
            try {
                user = new User({
                    email: userMetadata.email,
                    username: userMetadata.email.split('@')[0],
                    walletAddress: userMetadata.publicAddress || null
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

        user.lastLogin = new Date();
        await user.save();

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
        if (req.token.startsWith('did:')) {
            try {
                await magic.users.logoutByToken(req.token);
            } catch (magicError) {
                console.error('Magic logout error:', magicError);
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