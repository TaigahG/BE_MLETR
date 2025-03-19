const User = require('../models/User');
const Document = require('../models/Document');
const jwt = require('jsonwebtoken');

class UserController {
    async register(req, res) {
        try {
            const { username, email, password, walletAddress } = req.body;

            // Check if user already exists
            const existingUser = await User.findOne({ 
                $or: [{ email }, { username }] 
            });

            if (existingUser) {
                return res.status(400).json({ 
                    error: 'User already exists' 
                });
            }

            // Create new user
            const user = new User({
                username,
                email,
                password,
                walletAddress
            });

            await user.save();

            // Generate JWT token
            const token = jwt.sign(
                { id: user._id }, 
                process.env.JWT_SECRET, 
                { expiresIn: '1d' }
            );

            res.status(201).json({
                message: 'User registered successfully',
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email
                },
                token
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async login(req, res) {
        try {
            const { email, password } = req.body;

            // Find user
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(401).json({ 
                    error: 'Invalid credentials' 
                });
            }

            // Check password
            const isMatch = await user.comparePassword(password);
            if (!isMatch) {
                return res.status(401).json({ 
                    error: 'Invalid credentials' 
                });
            }

            // Generate JWT token
            const token = jwt.sign(
                { id: user._id }, 
                process.env.JWT_SECRET, 
                { expiresIn: '1d' }
            );

            res.json({
                message: 'Login successful',
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    role: user.role
                },
                token
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getUserProfile(req, res) {
        try {
            const user = await User.findById(req.user._id)
                .select('-password');

            res.json({
                message: 'User profile retrieved successfully',
                user
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateUserProfile(req, res) {
        try {
            const { username, walletAddress } = req.body;

            const user = await User.findById(req.user._id);

            if (username) user.username = username;
            if (walletAddress) user.walletAddress = walletAddress;

            await user.save();

            res.json({
                message: 'User profile updated successfully',
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    walletAddress: user.walletAddress
                }
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getUserDocuments(req, res) {
        try {
            const documents = await Document.find({
                $or: [
                    { creator: req.user._id },
                    { endorsementChain: req.user._id }
                ]
            }).populate('creator');

            res.json({
                message: 'User documents retrieved successfully',
                documents
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new UserController();
