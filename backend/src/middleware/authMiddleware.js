// authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { Magic } = require('@magic-sdk/admin');

const magic = new Magic(process.env.MAGIC_SECRET_KEY);

class AuthMiddleware {
    async authenticate(req, res, next) {
        try {
            // Extract token from header
            const authHeader = req.header('Authorization');
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            
            const token = authHeader.replace('Bearer ', '');
            
            // Check if this is a Magic Link token
            if (token.startsWith('did:')) {
                try {
                    // Validate Magic Link token
                    await magic.token.validate(token);
                    
                    // Get user metadata from Magic
                    const metadata = await magic.users.getMetadataByToken(token);
                    
                    // Find or create user
                    let user = await User.findOne({ email: metadata.email });
                    
                    if (!user) {
                        user = new User({
                            email: metadata.email,
                            username: metadata.email.split('@')[0],
                            walletAddress: metadata.publicAddress
                        });
                        await user.save();
                    }
                    
                    // Update last login time
                    user.lastLogin = new Date();
                    await user.save();
                    
                    // Attach user to request
                    req.token = token;
                    req.user = user;
                    req.magicUser = metadata;
                    return next();
                } catch (error) {
                    console.error('Magic Link validation error:', error);
                    return res.status(401).json({ error: 'Invalid Magic Link token' });
                }
            }
            
            // Handle JWT tokens
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                
                // Find user
                const user = await User.findOne({ 
                    _id: decoded.id
                });
                
                if (!user) {
                    throw new Error('User not found');
                }
                
                // Update last login time
                user.lastLogin = new Date();
                await user.save();
                
                // Attach user to request
                req.token = token;
                req.user = user;
                next();
            } catch (error) {
                console.error('JWT validation error:', error);
                return res.status(401).json({ error: 'Invalid authentication token' });
            }
        } catch (error) {
            console.error('Authentication error:', error);
            res.status(401).json({ error: 'Please authenticate' });
        }
    }
    
    // Generate JWT token for the user
    generateToken(user) {
        return jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );
    }
}

module.exports = new AuthMiddleware();