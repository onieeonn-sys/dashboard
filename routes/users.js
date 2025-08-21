const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// In-memory user storage (replace with database in production)
const users = new Map();

// Validation rules
const updateProfileValidation = [
    body('firstName').optional().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
    body('lastName').optional().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
    body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
    body('profile.companyName').optional().isLength({ min: 2 }).withMessage('Company name must be at least 2 characters'),
    body('profile.website').optional().isURL().withMessage('Invalid website URL')
];

const changePasswordValidation = [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
];

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = users.get(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Remove sensitive information
        const { password, ...userProfile } = user;
        res.json(userProfile);
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user profile
router.put('/profile', authenticateToken, updateProfileValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const user = users.get(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update user data
        const allowedUpdates = ['firstName', 'lastName', 'phone', 'profile'];
        const updates = {};
        
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                if (field === 'profile') {
                    updates[field] = { ...user.profile, ...req.body[field] };
                } else {
                    updates[field] = req.body[field];
                }
            }
        });

        // Apply updates
        Object.assign(user, updates);
        user.updatedAt = new Date();
        users.set(req.user.id, user);

        // Remove sensitive information
        const { password, ...userProfile } = user;
        res.json({
            message: 'Profile updated successfully',
            user: userProfile
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Change password
router.put('/change-password', authenticateToken, changePasswordValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { currentPassword, newPassword } = req.body;
        const user = users.get(req.user.id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        // Hash new password
        const saltRounds = 12;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
        
        // Update password
        user.password = hashedNewPassword;
        user.updatedAt = new Date();
        users.set(req.user.id, user);

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user statistics (for dashboard)
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const user = users.get(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Calculate user statistics based on role
        const stats = {
            profileCompleteness: calculateProfileCompleteness(user),
            memberSince: user.createdAt,
            lastActive: user.lastLoginAt || user.createdAt,
            accountStatus: user.isActive ? 'active' : 'inactive'
        };

        if (user.role === 'exporter') {
            stats.totalProducts = 0; // Will be calculated from products data
            stats.totalBids = 0; // Will be calculated from bids data
            stats.totalOrders = 0; // Will be calculated from orders data
        } else if (user.role === 'importer') {
            stats.totalRequirements = 0; // Will be calculated from requirements data
            stats.totalOrders = 0; // Will be calculated from orders data
        }

        res.json(stats);
    } catch (error) {
        console.error('Get user stats error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Upload profile picture
router.post('/upload-avatar', authenticateToken, async (req, res) => {
    try {
        // This would typically handle file upload with multer
        // For now, return a placeholder response
        res.json({ 
            message: 'Avatar upload feature coming soon',
            avatarUrl: '/images/default-avatar.png'
        });
    } catch (error) {
        console.error('Upload avatar error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete user account
router.delete('/account', authenticateToken, async (req, res) => {
    try {
        const user = users.get(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // In a real application, you would:
        // 1. Soft delete or anonymize user data
        // 2. Handle related data (products, bids, orders)
        // 3. Send confirmation email
        
        // For now, just mark as inactive
        user.isActive = false;
        user.deletedAt = new Date();
        users.set(req.user.id, user);

        res.json({ message: 'Account deactivated successfully' });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Helper function to calculate profile completeness
function calculateProfileCompleteness(user) {
    const requiredFields = [
        'firstName', 'lastName', 'email', 'phone',
        'profile.companyName', 'profile.companyType', 'profile.address', 'profile.country'
    ];
    
    let completedFields = 0;
    
    requiredFields.forEach(field => {
        const fieldParts = field.split('.');
        let value = user;
        
        for (const part of fieldParts) {
            value = value?.[part];
        }
        
        if (value && value.toString().trim() !== '') {
            completedFields++;
        }
    });
    
    return Math.round((completedFields / requiredFields.length) * 100);
}

// Export users map for use in other modules
module.exports = { router, users };