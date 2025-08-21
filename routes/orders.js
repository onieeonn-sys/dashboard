const express = require('express');
const { validationResult, body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { bids } = require('./bidding');
const { requirements } = require('./requirements');
const { users } = require('./auth');

const router = express.Router();

// In-memory orders storage (replace with database)
let orders = [];

// Configure multer for document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/documents/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 20 // Maximum 20 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|xls|xlsx|jpg|jpeg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype.includes('pdf') || 
                     file.mimetype.includes('document') || file.mimetype.includes('spreadsheet');
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only document and image files are allowed'));
    }
  }
});

// Order phases in sequence
const ORDER_PHASES = [
  'confirmation',
  'payment',
  'production',
  'inspection',
  'shipping',
  'delivery'
];

// Validation rules
const orderUpdateValidation = [
  body('phase').optional().isIn(ORDER_PHASES),
  body('status').optional().isIn(['active', 'completed', 'cancelled', 'disputed']),
  body('notes').optional().trim().isLength({ max: 2000 }),
  body('estimatedDelivery').optional().isISO8601().toDate()
];

// Create order from accepted bid
const createOrderFromBid = (bidId) => {
  try {
    const bid = bids.find(b => b.id === bidId && b.status === 'accepted');
    if (!bid) {
      throw new Error('Accepted bid not found');
    }
    
    const requirement = requirements.find(r => r.id === bid.requirementId);
    if (!requirement) {
      throw new Error('Requirement not found');
    }
    
    const exporter = users.find(u => u.id === bid.exporterId);
    const importer = users.find(u => u.id === requirement.importerId);
    
    if (!exporter || !importer) {
      throw new Error('User not found');
    }
    
    const newOrder = {
      id: uuidv4(),
      bidId: bid.id,
      requirementId: requirement.id,
      exporterId: bid.exporterId,
      importerId: requirement.importerId,
      
      // Order details from requirement and bid
      title: requirement.title,
      description: requirement.description,
      category: requirement.category,
      quantity: requirement.quantity,
      unit: requirement.unit,
      price: bid.price,
      currency: bid.currency,
      totalValue: bid.price * requirement.quantity,
      
      // Delivery details
      deliveryLocation: requirement.deliveryLocation,
      deliveryTime: bid.deliveryTime,
      deliveryTimeUnit: bid.deliveryTimeUnit,
      estimatedDelivery: new Date(Date.now() + (bid.deliveryTime * 
        (bid.deliveryTimeUnit === 'days' ? 1 : bid.deliveryTimeUnit === 'weeks' ? 7 : 30) * 24 * 60 * 60 * 1000)).toISOString(),
      
      // Terms
      paymentTerms: bid.paymentTerms || requirement.paymentTerms || '',
      deliveryTerms: bid.deliveryTerms || requirement.deliveryTerms || '',
      
      // Order status
      currentPhase: 'confirmation',
      status: 'active',
      
      // Phase tracking
      phases: {
        confirmation: {
          status: 'pending',
          startedAt: new Date().toISOString(),
          completedAt: null,
          documents: [],
          notes: '',
          updatedBy: null
        },
        payment: {
          status: 'not_started',
          startedAt: null,
          completedAt: null,
          documents: [],
          notes: '',
          updatedBy: null
        },
        production: {
          status: 'not_started',
          startedAt: null,
          completedAt: null,
          documents: [],
          notes: '',
          updatedBy: null
        },
        inspection: {
          status: 'not_started',
          startedAt: null,
          completedAt: null,
          documents: [],
          notes: '',
          updatedBy: null
        },
        shipping: {
          status: 'not_started',
          startedAt: null,
          completedAt: null,
          documents: [],
          notes: '',
          updatedBy: null
        },
        delivery: {
          status: 'not_started',
          startedAt: null,
          completedAt: null,
          documents: [],
          notes: '',
          updatedBy: null
        }
      },
      
      // Metadata
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    orders.push(newOrder);
    return newOrder;
    
  } catch (error) {
    console.error('Create order error:', error);
    throw error;
  }
};

// Get all orders for user
const getOrders = (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      status = 'all',
      phase = 'all',
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    // Filter orders by user role
    let userOrders = orders.filter(o => 
      o.exporterId === userId || o.importerId === userId
    );
    
    // Apply filters
    if (status !== 'all') {
      userOrders = userOrders.filter(o => o.status === status);
    }
    
    if (phase !== 'all') {
      userOrders = userOrders.filter(o => o.currentPhase === phase);
    }
    
    // Sort orders
    userOrders.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'createdAt' || sortBy === 'updatedAt' || sortBy === 'estimatedDelivery') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    // Pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedOrders = userOrders.slice(startIndex, endIndex);
    
    res.json({
      orders: paginatedOrders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(userOrders.length / parseInt(limit)),
        totalOrders: userOrders.length,
        hasNext: endIndex < userOrders.length,
        hasPrev: startIndex > 0
      }
    });
    
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get single order by ID
const getOrderById = (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    const order = orders.find(o => 
      o.id === id && (o.exporterId === userId || o.importerId === userId)
    );
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found or unauthorized' });
    }
    
    // Add user role information
    const orderWithRole = {
      ...order,
      userRole: order.exporterId === userId ? 'exporter' : 'importer'
    };
    
    res.json(orderWithRole);
    
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update order phase
const updateOrderPhase = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    // Validate input
    await Promise.all(orderUpdateValidation.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const orderIndex = orders.findIndex(o => 
      o.id === id && (o.exporterId === userId || o.importerId === userId)
    );
    
    if (orderIndex === -1) {
      return res.status(404).json({ error: 'Order not found or unauthorized' });
    }
    
    const order = orders[orderIndex];
    
    if (order.status !== 'active') {
      return res.status(400).json({ error: 'Cannot update inactive order' });
    }
    
    const { phase, notes, estimatedDelivery } = req.body;
    
    // Handle uploaded documents
    const documents = req.files ? req.files.map(file => ({
      id: uuidv4(),
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      size: file.size,
      uploadedBy: userId,
      uploadedAt: new Date().toISOString()
    })) : [];
    
    if (phase) {
      // Validate phase progression
      const currentPhaseIndex = ORDER_PHASES.indexOf(order.currentPhase);
      const newPhaseIndex = ORDER_PHASES.indexOf(phase);
      
      if (newPhaseIndex < currentPhaseIndex) {
        return res.status(400).json({ error: 'Cannot move to previous phase' });
      }
      
      if (newPhaseIndex > currentPhaseIndex + 1) {
        return res.status(400).json({ error: 'Cannot skip phases' });
      }
      
      // Complete current phase
      if (order.phases[order.currentPhase].status === 'pending') {
        order.phases[order.currentPhase].status = 'completed';
        order.phases[order.currentPhase].completedAt = new Date().toISOString();
        order.phases[order.currentPhase].updatedBy = userId;
      }
      
      // Start new phase
      if (newPhaseIndex > currentPhaseIndex) {
        order.currentPhase = phase;
        order.phases[phase].status = 'pending';
        order.phases[phase].startedAt = new Date().toISOString();
        order.phases[phase].updatedBy = userId;
      }
    }
    
    // Update current phase with notes and documents
    if (notes) {
      order.phases[order.currentPhase].notes = notes;
    }
    
    if (documents.length > 0) {
      order.phases[order.currentPhase].documents.push(...documents);
    }
    
    if (estimatedDelivery) {
      order.estimatedDelivery = new Date(estimatedDelivery).toISOString();
    }
    
    // Update phase metadata
    order.phases[order.currentPhase].updatedBy = userId;
    order.updatedAt = new Date().toISOString();
    
    // Check if order is completed
    if (order.currentPhase === 'delivery' && order.phases.delivery.status === 'completed') {
      order.status = 'completed';
    }
    
    orders[orderIndex] = order;
    
    res.json({
      message: 'Order updated successfully',
      order: order
    });
    
  } catch (error) {
    console.error('Update order phase error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Upload documents to order phase
const uploadOrderDocuments = (req, res) => {
  try {
    const { id, phase } = req.params;
    const userId = req.user.userId;
    
    if (!ORDER_PHASES.includes(phase)) {
      return res.status(400).json({ error: 'Invalid phase' });
    }
    
    const orderIndex = orders.findIndex(o => 
      o.id === id && (o.exporterId === userId || o.importerId === userId)
    );
    
    if (orderIndex === -1) {
      return res.status(404).json({ error: 'Order not found or unauthorized' });
    }
    
    const order = orders[orderIndex];
    
    if (order.status !== 'active') {
      return res.status(400).json({ error: 'Cannot upload documents to inactive order' });
    }
    
    // Handle uploaded documents
    const documents = req.files ? req.files.map(file => ({
      id: uuidv4(),
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      size: file.size,
      uploadedBy: userId,
      uploadedAt: new Date().toISOString()
    })) : [];
    
    if (documents.length === 0) {
      return res.status(400).json({ error: 'No documents uploaded' });
    }
    
    // Add documents to phase
    order.phases[phase].documents.push(...documents);
    order.phases[phase].updatedBy = userId;
    order.updatedAt = new Date().toISOString();
    
    orders[orderIndex] = order;
    
    res.json({
      message: 'Documents uploaded successfully',
      documents: documents,
      phase: phase
    });
    
  } catch (error) {
    console.error('Upload order documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Cancel order
const cancelOrder = (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { reason } = req.body;
    
    const orderIndex = orders.findIndex(o => 
      o.id === id && (o.exporterId === userId || o.importerId === userId)
    );
    
    if (orderIndex === -1) {
      return res.status(404).json({ error: 'Order not found or unauthorized' });
    }
    
    const order = orders[orderIndex];
    
    if (order.status !== 'active') {
      return res.status(400).json({ error: 'Cannot cancel inactive order' });
    }
    
    // Check if order can be cancelled (only in early phases)
    const currentPhaseIndex = ORDER_PHASES.indexOf(order.currentPhase);
    if (currentPhaseIndex > 2) { // After production phase
      return res.status(400).json({ error: 'Cannot cancel order in current phase' });
    }
    
    order.status = 'cancelled';
    order.cancellationReason = reason || '';
    order.cancelledBy = userId;
    order.cancelledAt = new Date().toISOString();
    order.updatedAt = new Date().toISOString();
    
    orders[orderIndex] = order;
    
    res.json({
      message: 'Order cancelled successfully',
      order: order
    });
    
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get order statistics
const getOrderStats = (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    
    const userOrders = orders.filter(o => 
      o.exporterId === userId || o.importerId === userId
    );
    
    const stats = {
      total: userOrders.length,
      active: userOrders.filter(o => o.status === 'active').length,
      completed: userOrders.filter(o => o.status === 'completed').length,
      cancelled: userOrders.filter(o => o.status === 'cancelled').length,
      disputed: userOrders.filter(o => o.status === 'disputed').length,
      
      // Phase distribution
      phases: {
        confirmation: userOrders.filter(o => o.currentPhase === 'confirmation' && o.status === 'active').length,
        payment: userOrders.filter(o => o.currentPhase === 'payment' && o.status === 'active').length,
        production: userOrders.filter(o => o.currentPhase === 'production' && o.status === 'active').length,
        inspection: userOrders.filter(o => o.currentPhase === 'inspection' && o.status === 'active').length,
        shipping: userOrders.filter(o => o.currentPhase === 'shipping' && o.status === 'active').length,
        delivery: userOrders.filter(o => o.currentPhase === 'delivery' && o.status === 'active').length
      },
      
      // Financial stats
      totalValue: userOrders
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (o.totalValue || 0), 0),
      
      // Role-specific stats
      ...(userRole === 'exporter' ? {
        averageOrderValue: userOrders.length > 0 ? 
          userOrders.reduce((sum, o) => sum + (o.totalValue || 0), 0) / userOrders.length : 0,
        onTimeDeliveryRate: userOrders.filter(o => o.status === 'completed').length > 0 ?
          (userOrders.filter(o => o.status === 'completed' && 
            new Date(o.phases.delivery.completedAt) <= new Date(o.estimatedDelivery)).length /
           userOrders.filter(o => o.status === 'completed').length * 100).toFixed(2) : 0
      } : {})
    };
    
    res.json(stats);
    
  } catch (error) {
    console.error('Get order stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Define routes
router.get('/', authenticateToken, getOrders);
router.get('/stats', authenticateToken, getOrderStats);
router.get('/:id', authenticateToken, getOrderById);
router.post('/from-bid/:bidId', authenticateToken, requireRole('importer'), createOrderFromBid);
router.put('/:id/phase', authenticateToken, orderUpdateValidation, updateOrderPhase);
router.post('/:id/documents', authenticateToken, upload.array('documents', 10), uploadOrderDocuments);
router.put('/:id/cancel', authenticateToken, cancelOrder);

// Export router
module.exports = router;

// Export orders array and constants for other modules (development only)
module.exports.orders = orders;
module.exports.ORDER_PHASES = ORDER_PHASES;