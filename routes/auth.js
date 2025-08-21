const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { authenticateToken, generateToken, invalidateToken } = require('../middleware/auth');

const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// In-memory user storage (replace with database)
let users = [
  {
    id: 'test-exporter-1',
    email: 'exporter@test.com',
    password: '$2a$10$mkBSl3jz5T8kKpdBaKl4b.XgXJS3HfLPjXrnMZ6wavjZzij0R/IJW', // password: 'password123'
    role: 'exporter',
    companyName: 'Global Export Solutions',
    contactPerson: 'John Smith',
    phone: '+1-555-0123',
    address: '123 Export Street, Trade City, TC 12345',
    businessLicense: 'EXP-2024-001',
    taxId: 'TAX-EXP-001',
    createdAt: new Date('2024-01-01'),
    isActive: true
  },
  {
    id: 'test-importer-1',
    email: 'importer@test.com',
    password: '$2a$10$mkBSl3jz5T8kKpdBaKl4b.XgXJS3HfLPjXrnMZ6wavjZzij0R/IJW', // password: 'password123'
    role: 'importer',
    companyName: 'International Import Corp',
    contactPerson: 'Sarah Johnson',
    phone: '+1-555-0456',
    address: '456 Import Avenue, Commerce City, CC 67890',
    businessLicense: 'IMP-2024-001',
    taxId: 'TAX-IMP-001',
    createdAt: new Date('2024-01-01'),
    isActive: true
  }
];
let sessions = [];

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['exporter', 'importer']),
  body('companyName').notEmpty().trim(),
  body('contactPerson').notEmpty().trim(),
  body('phone').notEmpty().trim()
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];

// Register new user
const register = async (req, res) => {
  try {
    // Validate input
    await Promise.all(registerValidation.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      email,
      password,
      role,
      companyName,
      contactPerson,
      phone,
      address,
      website,
      businessType,
      establishedYear,
      annualTurnover
    } = req.body;

    // Check if user already exists
    const existingUser = users.find(user => user.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user
    const newUser = {
      id: uuidv4(),
      email,
      password: hashedPassword,
      role,
      profile: {
        companyName,
        contactPerson,
        phone,
        address: address || '',
        website: website || '',
        businessType: businessType || '',
        establishedYear: establishedYear || null,
        annualTurnover: annualTurnover || null
      },
      documents: [],
      isVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    users.push(newUser);

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: newUser.id, 
        email: newUser.email, 
        role: newUser.role 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Store session
    sessions.push({
      userId: newUser.id,
      token,
      createdAt: new Date().toISOString()
    });

    // Return user data (without password)
    const { password: _, ...userWithoutPassword } = newUser;
    
    res.status(201).json({
      message: 'User registered successfully',
      user: userWithoutPassword,
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Login user
const login = async (req, res) => {
  try {
    // Validate input
    await Promise.all(loginValidation.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = users.find(user => user.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = generateToken(user);

    // Store session
    sessions.push({
      userId: user.id,
      token,
      createdAt: new Date().toISOString()
    });

    // Update last login
    user.lastLogin = new Date().toISOString();

    // Return user data (without password)
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Logout user
const logout = (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    // Remove session from local storage
    sessions = sessions.filter(session => session.token !== token);
    
    // Remove token from active sessions
    if (token) {
      invalidateToken(token);
    }
    
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get user profile
const getProfile = (req, res) => {
  try {
    const user = users.find(user => user.id === req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return user data (without password)
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const userIndex = users.findIndex(user => user.id === req.user.id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    const {
      companyName,
      contactPerson,
      phone,
      address,
      website,
      businessType,
      establishedYear,
      annualTurnover
    } = req.body;

    // Update profile
    users[userIndex].profile = {
      ...users[userIndex].profile,
      companyName: companyName || users[userIndex].profile.companyName,
      contactPerson: contactPerson || users[userIndex].profile.contactPerson,
      phone: phone || users[userIndex].profile.phone,
      address: address || users[userIndex].profile.address,
      website: website || users[userIndex].profile.website,
      businessType: businessType || users[userIndex].profile.businessType,
      establishedYear: establishedYear || users[userIndex].profile.establishedYear,
      annualTurnover: annualTurnover || users[userIndex].profile.annualTurnover
    };

    users[userIndex].updatedAt = new Date().toISOString();

    // Return updated user data (without password)
    const { password: _, ...userWithoutPassword } = users[userIndex];
    res.json({
      message: 'Profile updated successfully',
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Define routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/logout', authenticateToken, logout);
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);

// Export router
module.exports = router;

// Export users array for other modules (development only)
module.exports.users = users;
module.exports.sessions = sessions;