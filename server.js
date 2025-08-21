const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// In-memory data stores (replace with database in production)
const users = [];
const products = [];
const requirements = [];
const bids = [];
const orders = [];
const documents = [];

// Import middleware
const { authenticateToken, requireRole } = require('./middleware/auth');

// Import route modules
const authRoutes = require('./routes/auth');
const { router: userRoutes } = require('./routes/users');
const productRoutes = require('./routes/products');
const requirementRoutes = require('./routes/requirements');
const biddingRoutes = require('./routes/bidding');
const orderRoutes = require('./routes/orders');
const documentRoutes = require('./routes/documents');
const analyticsRoutes = require('./routes/analytics');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/requirements', requirementRoutes);
app.use('/api/bids', biddingRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/analytics', analyticsRoutes);

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 B2B Marketplace server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;