const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { Magic } = require('@magic-sdk/admin');

const magic = new Magic(process.env.MAGIC_SECRET_KEY);

class AuthMiddleware {
    async authenticate(req, res, next) {
        try {
            const authHeader = req.header('Authorization');
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            
            const token = authHeader.replace('Bearer ', '');
            
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                
                const user = await User.findOne({ 
                    _id: decoded.id
                });
                
                if (!user) {
                    return res.status(401).json({ error: 'User not found' });
                }
                
                user.lastLogin = new Date();
                await user.save();
                
                req.token = token;
                req.user = user;
                return next();
            } catch (jwtError) {
                console.error('JWT token error:', jwtError);

            }
            
            try {
                let decodedToken;
                try {
                    const buff = Buffer.from(token, 'base64');
                    decodedToken = buff.toString('utf-8');
                    
                    try {
                        const tokenData = JSON.parse(decodedToken);
                        
                        await magic.token.validate(token);
                        
                        const metadata = await magic.users.getMetadataByToken(token);
                        
                        if (!metadata.email) {
                            return res.status(400).json({ error: 'Email not found in Magic token' });
                        }
                        
                        let user = await User.findOne({ email: metadata.email });
                        
                        if (!user) {
                            user = new User({
                                email: metadata.email,
                                username: metadata.email.split('@')[0],
                                walletAddress: metadata.publicAddress || null
                            });
                            await user.save();
                        }
                        
                        user.lastLogin = new Date();
                        await user.save();
                        
                        req.token = token;
                        req.user = user;
                        req.magicUser = metadata;
                        return next();
                    } catch (parseError) {
                        throw new Error('Invalid Magic token format: ' + parseError.message);
                    }
                } catch (decodeError) {
                    if (token.startsWith('did:')) {
                        try {
                            await magic.token.validate(token);
                            
                            const metadata = await magic.users.getMetadataByToken(token);
                            
                            let user = await User.findOne({ email: metadata.email });
                            
                            if (!user) {
                                user = new User({
                                    email: metadata.email,
                                    username: metadata.email.split('@')[0],
                                    walletAddress: metadata.publicAddress || null
                                });
                                await user.save();
                            }
                            
                            user.lastLogin = new Date();
                            await user.save();
                            
                            req.token = token;
                            req.user = user;
                            req.magicUser = metadata;
                            return next();
                        } catch (magicError) {
                            throw new Error('Invalid Magic DID token: ' + magicError.message);
                        }
                    } else {
                        throw new Error('Not a base64 encoded token or DID');
                    }
                }
            } catch (magicError) {
                console.error('Magic token validation error:', magicError);
                return res.status(401).json({ error: 'Authentication failed: ' + magicError.message });
            }
        } catch (error) {
            console.error('Authentication error:', error);
            res.status(401).json({ error: 'Please authenticate' });
        }
    }
    
    generateToken(user) {
        return jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );
    }
}

module.exports = new AuthMiddleware();