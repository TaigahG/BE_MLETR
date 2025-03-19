// authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

class AuthMiddleware {
    async authenticate(req, res, next) {
        try {
            // Extract token from header
            const authHeader = req.header('Authorization');
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).send({ error: 'Authentication required' });
            }
            
            const token = authHeader.replace('Bearer ', '');
            
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Find user
            const user = await User.findOne({ 
                _id: decoded.id,
                email: decoded.email
            });

            if (!user) {
                throw new Error();
            }

            // Update last login time
            user.lastLogin = new Date();
            await user.save();

            // Attach user to request
            req.token = token;
            req.user = user;
            next();
        } catch (error) {
            res.status(401).send({ error: 'Please authenticate' });
        }
    }
}

module.exports = new AuthMiddleware();