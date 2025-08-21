const jwt = require('jsonwebtoken');

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// In-memory session storage (replace with Redis in production)
const activeSessions = new Set();

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    // Check if token is in active sessions
    if (!activeSessions.has(token)) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            // Remove invalid token from active sessions
            activeSessions.delete(token);
            return res.status(403).json({ message: 'Invalid token' });
        }

        req.user = user;
        next();
    });
}

// Role-based access control middleware
function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const userRole = req.user.role;
        const allowedRoles = Array.isArray(roles) ? roles : [roles];

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({ 
                message: `Access denied. Required role(s): ${allowedRoles.join(', ')}` 
            });
        }

        next();
    };
}

// Generate JWT token
function generateToken(user) {
    const payload = {
        id: user.id,
        email: user.email,
        role: user.role,
        iat: Math.floor(Date.now() / 1000)
    };

    const token = jwt.sign(payload, JWT_SECRET, { 
        expiresIn: '24h',
        issuer: 'onieon-marketplace',
            audience: 'onieon-users'
    });

    // Add token to active sessions
    activeSessions.add(token);

    return token;
}

// Verify and decode token without middleware
function verifyToken(token) {
    try {
        if (!activeSessions.has(token)) {
            throw new Error('Token not in active sessions');
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        return { success: true, user: decoded };
    } catch (error) {
        activeSessions.delete(token);
        return { success: false, error: error.message };
    }
}

// Invalidate token (logout)
function invalidateToken(token) {
    activeSessions.delete(token);
    return true;
}

// Clean up expired tokens (should be called periodically)
function cleanupExpiredTokens() {
    const now = Math.floor(Date.now() / 1000);
    
    activeSessions.forEach(token => {
        try {
            const decoded = jwt.decode(token);
            if (decoded && decoded.exp && decoded.exp < now) {
                activeSessions.delete(token);
            }
        } catch (error) {
            // Invalid token, remove it
            activeSessions.delete(token);
        }
    });
}

// Optional: Admin middleware for admin-only routes
function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }

    next();
}

// Rate limiting helper for sensitive operations
const sensitiveOperations = new Map(); // userId -> { count, resetTime }

function rateLimitSensitive(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const userId = req.user.id;
        const now = Date.now();
        const userAttempts = sensitiveOperations.get(userId);

        if (!userAttempts || now > userAttempts.resetTime) {
            // Reset or initialize counter
            sensitiveOperations.set(userId, {
                count: 1,
                resetTime: now + windowMs
            });
            return next();
        }

        if (userAttempts.count >= maxAttempts) {
            return res.status(429).json({ 
                message: 'Too many attempts. Please try again later.',
                retryAfter: Math.ceil((userAttempts.resetTime - now) / 1000)
            });
        }

        userAttempts.count++;
        sensitiveOperations.set(userId, userAttempts);
        next();
    };
}

// Cleanup function to be called periodically
setInterval(() => {
    cleanupExpiredTokens();
    
    // Clean up rate limiting data
    const now = Date.now();
    for (const [userId, data] of sensitiveOperations.entries()) {
        if (now > data.resetTime) {
            sensitiveOperations.delete(userId);
        }
    }
}, 60 * 60 * 1000); // Run every hour

module.exports = {
    authenticateToken,
    requireRole,
    requireAdmin,
    generateToken,
    verifyToken,
    invalidateToken,
    rateLimitSensitive,
    activeSessions,
    JWT_SECRET
};