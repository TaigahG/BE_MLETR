const express = require('express');
const User = require('../models/User');
const { Magic } = require('@magic-sdk/admin');
const jwt = require('jsonwebtoken');

const router = express.Router();

const magic = new Magic(process.env.MAGIC_SECRET_KEY);

router.post('/request-magic-link', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ 
                message: 'Email is required' 
            });
        }
        console.log(`Would send magic link to: ${email}`);

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

router.post('/verify', async (req, res) => {
    try {
        const didToken = req.headers.authorization ? req.headers.authorization.substr(7) : null;
        await magic.token.validate(didToken);
        const metadata = await magic.users.getMetadataByToken(didToken);
        const email = metadata.email;

        if (!email || !didToken) {
            return res.status(400).json({ 
                message: 'Missing required fields' 
            });
        }

        try {
            await magic.token.validate(didToken);
        } catch (validationError) {
            console.error('Magic Link Token Validation Error:', validationError);
            return res.status(401).json({ 
                message: 'Invalid Magic Link token' 
            });
        }

        let user = await User.findOne({ email });

        if (!user) {
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


// Add this to authRoutes.js - REMOVE BEFORE PRODUCTION
router.get('/test-login/:email', async (req, res) => {
    try {
      const email = req.params.email;
      
      // Create or find user
      let user = await User.findOne({ email });
      if (!user) {
        user = new User({
          email,
          username: email.split('@')[0]
        });
        await user.save();
      }
      
      // Generate JWT
      const token = jwt.sign(
        { id: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );
      
      res.json({
        message: "Test login successful (bypasses Magic Link)",
        token,
        user: {
          id: user._id,
          email: user.email,
          username: user.username
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

module.exports = router;