const express = require('express');
const { validationResult, body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { requirements } = require('./requirements');
const { users } = require('./auth');

const router = express.Router();

// In-memory bids storage (replace with database)
let bids = [
  {
    id: 'bid-001',
    requirementId: 'req-001',
    exporterId: 'test-exporter-1',
    productId: 'prod-001',
    price: 4.25,
    currency: 'USD',
    quantity: 5000,
    unit: 'kg',
    deliveryTerms: 'FOB Cartagena Port',
    paymentTerms: '30% advance, 70% on shipment',
    deliveryTime: '3 weeks from order confirmation',
    validUntil: new Date('2024-02-15'),
    message: 'We can provide premium Colombian Arabica coffee beans that meet all your specifications. Our beans are directly sourced from highland farms and come with full traceability.',
    status: 'submitted',
    submittedAt: new Date('2024-01-22'),
    updatedAt: new Date('2024-01-22'),
    attachments: [],
    isActive: true
  },
  {
    id: 'bid-002',
    requirementId: 'req-002',
    exporterId: 'test-exporter-1',
    productId: 'prod-002',
    price: 3.00,
    currency: 'USD',
    quantity: 10000,
    unit: 'meter',
    deliveryTerms: 'CIF Los Angeles',
    paymentTerms: 'LC at sight',
    deliveryTime: '4 weeks from order confirmation',
    validUntil: new Date('2024-02-20'),
    message: 'Our GOTS certified organic cotton fabric is perfect for your sustainable clothing line. We offer consistent quality and can provide samples for your approval.',
    status: 'submitted',
    submittedAt: new Date('2024-01-21'),
    updatedAt: new Date('2024-01-21'),
    attachments: [],
    isActive: true
  }
];

// Validation rules
const bidValidation = [
  body('requirementId').notEmpty().isUUID(),
  body('price').isNumeric().isFloat({ min: 0 }),
  body('currency').isIn(['USD', 'EUR', 'INR', 'GBP', 'JPY', 'CNY']),
  body('deliveryTime').isNumeric().isInt({ min: 1 }),
  body('deliveryTimeUnit').isIn(['days', 'weeks', 'months']),
  body('paymentTerms').optional().trim(),
  body('deliveryTerms').optional().trim(),
  body('additionalNotes').optional().trim().isLength({ max: 1000 }),
  body('validUntil').optional().isISO8601().toDate()
];

// Helper function to calculate total price in USD for comparison
const convertToUSD = (price, currency) => {
  const exchangeRates = {
    'USD': 1,
    'EUR': 1.1,
    'INR': 0.012,
    'GBP': 1.25,
    'JPY': 0.0067,
    'CNY': 0.14
  };
  return price * (exchangeRates[currency] || 1);
};

// Helper function to convert delivery time to days
const convertToDays = (time, unit) => {
  const multipliers = {
    'days': 1,
    'weeks': 7,
    'months': 30
  };
  return time * (multipliers[unit] || 1);
};

// Helper function to calculate exporter reliability score
const getExporterReliability = (exporterId) => {
  // This would typically come from order history, ratings, etc.
  // For now, return a random score between 1-10
  const exporter = users.find(u => u.id === exporterId);
  if (!exporter) return 5;
  
  // Calculate based on account age, completed orders, ratings, etc.
  const accountAge = Math.floor((new Date() - new Date(exporter.createdAt)) / (1000 * 60 * 60 * 24));
  const baseScore = Math.min(accountAge / 30, 5); // Max 5 points for account age
  
  // Add random component for demo (in real app, use actual metrics)
  return Math.min(baseScore + Math.random() * 5, 10);
};

// Helper function to rank bids
const rankBids = (bids) => {
  return bids.sort((a, b) => {
    // Primary: lowest total price (converted to USD)
    const aPriceUSD = convertToUSD(a.price, a.currency);
    const bPriceUSD = convertToUSD(b.price, b.currency);
    
    if (aPriceUSD !== bPriceUSD) {
      return aPriceUSD - bPriceUSD;
    }
    
    // Secondary: shortest delivery time
    const aDeliveryDays = convertToDays(a.deliveryTime, a.deliveryTimeUnit);
    const bDeliveryDays = convertToDays(b.deliveryTime, b.deliveryTimeUnit);
    
    if (aDeliveryDays !== bDeliveryDays) {
      return aDeliveryDays - bDeliveryDays;
    }
    
    // Tertiary: highest exporter reliability
    const aReliability = getExporterReliability(a.exporterId);
    const bReliability = getExporterReliability(b.exporterId);
    
    return bReliability - aReliability;
  });
};

// Anti-fraud: Check for duplicate or suspicious bids
const validateBidIntegrity = (newBid, existingBids) => {
  const exporterBids = existingBids.filter(b => 
    b.exporterId === newBid.exporterId && 
    b.requirementId === newBid.requirementId
  );
  
  // Check for duplicate bids from same exporter
  if (exporterBids.length > 0) {
    return { valid: false, reason: 'Exporter has already submitted a bid for this requirement' };
  }
  
  // Check for suspiciously low prices (less than 10% of target price)
  const requirement = requirements.find(r => r.id === newBid.requirementId);
  if (requirement && requirement.targetPrice) {
    const targetPriceUSD = convertToUSD(requirement.targetPrice, requirement.currency);
    const bidPriceUSD = convertToUSD(newBid.price, newBid.currency);
    
    if (bidPriceUSD < targetPriceUSD * 0.1) {
      return { valid: false, reason: 'Bid price is suspiciously low' };
    }
  }
  
  return { valid: true };
};

// Get bids for a requirement
const getBidsForRequirement = (req, res) => {
  try {
    const { requirementId } = req.params;
    const { includeRanking = true } = req.query;
    
    // Check if requirement exists
    const requirement = requirements.find(r => r.id === requirementId);
    if (!requirement) {
      return res.status(404).json({ error: 'Requirement not found' });
    }
    
    // Get bids for this requirement
    let requirementBids = bids.filter(b => b.requirementId === requirementId && b.status === 'active');
    
    // Only show bids to requirement owner or bid owners
    if (req.user.role === 'importer' && requirement.importerId !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized to view these bids' });
    }
    
    if (req.user.role === 'exporter') {
      // Exporters can only see their own bids and basic info about others
      requirementBids = requirementBids.map(bid => {
        if (bid.exporterId === req.user.userId) {
          return bid;
        } else {
          return {
            id: bid.id,
            exporterId: bid.exporterId,
            price: bid.price,
            currency: bid.currency,
            deliveryTime: bid.deliveryTime,
            deliveryTimeUnit: bid.deliveryTimeUnit,
            createdAt: bid.createdAt
          };
        }
      });
    }
    
    // Rank bids if requested
    if (includeRanking === 'true' || includeRanking === true) {
      requirementBids = rankBids(requirementBids);
      
      // Add ranking information
      requirementBids = requirementBids.map((bid, index) => ({
        ...bid,
        rank: index + 1,
        priceUSD: convertToUSD(bid.price, bid.currency),
        deliveryDays: convertToDays(bid.deliveryTime, bid.deliveryTimeUnit),
        exporterReliability: getExporterReliability(bid.exporterId)
      }));
    }
    
    res.json({
      bids: requirementBids,
      total: requirementBids.length,
      requirement: {
        id: requirement.id,
        title: requirement.title,
        bidDeadline: requirement.bidDeadline,
        status: requirement.status
      }
    });
    
  } catch (error) {
    console.error('Get bids error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get exporter's bids
const getExporterBids = (req, res) => {
  try {
    const exporterId = req.user.userId;
    const {
      status = 'all',
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    let exporterBids = bids.filter(b => b.exporterId === exporterId);
    
    // Filter by status
    if (status !== 'all') {
      exporterBids = exporterBids.filter(b => b.status === status);
    }
    
    // Sort bids
    exporterBids.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
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
    const paginatedBids = exporterBids.slice(startIndex, endIndex);
    
    // Add requirement info to each bid
    const bidsWithRequirements = paginatedBids.map(bid => {
      const requirement = requirements.find(r => r.id === bid.requirementId);
      return {
        ...bid,
        requirement: requirement ? {
          id: requirement.id,
          title: requirement.title,
          category: requirement.category,
          quantity: requirement.quantity,
          unit: requirement.unit,
          bidDeadline: requirement.bidDeadline,
          status: requirement.status
        } : null
      };
    });
    
    res.json({
      bids: bidsWithRequirements,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(exporterBids.length / parseInt(limit)),
        totalBids: exporterBids.length,
        hasNext: endIndex < exporterBids.length,
        hasPrev: startIndex > 0
      }
    });
    
  } catch (error) {
    console.error('Get exporter bids error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Submit a bid (exporters only)
const submitBid = async (req, res) => {
  try {
    // Validate input
    await Promise.all(bidValidation.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const {
      requirementId,
      price,
      currency,
      deliveryTime,
      deliveryTimeUnit,
      paymentTerms,
      deliveryTerms,
      additionalNotes,
      validUntil
    } = req.body;
    
    // Check if requirement exists and is active
    const requirement = requirements.find(r => r.id === requirementId);
    if (!requirement) {
      return res.status(404).json({ error: 'Requirement not found' });
    }
    
    if (requirement.status !== 'active') {
      return res.status(400).json({ error: 'Requirement is not accepting bids' });
    }
    
    // Check if bid deadline has passed
    const bidDeadline = new Date(requirement.bidDeadline);
    const now = new Date();
    if (now > bidDeadline) {
      return res.status(400).json({ error: 'Bid deadline has passed' });
    }
    
    // Check if exporter is trying to bid on their own requirement
    if (requirement.importerId === req.user.userId) {
      return res.status(400).json({ error: 'Cannot bid on your own requirement' });
    }
    
    const newBid = {
      id: uuidv4(),
      requirementId,
      exporterId: req.user.userId,
      price: parseFloat(price),
      currency,
      deliveryTime: parseInt(deliveryTime),
      deliveryTimeUnit,
      paymentTerms: paymentTerms || '',
      deliveryTerms: deliveryTerms || '',
      additionalNotes: additionalNotes || '',
      validUntil: validUntil ? new Date(validUntil).toISOString() : null,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Validate bid integrity (anti-fraud)
    const integrityCheck = validateBidIntegrity(newBid, bids);
    if (!integrityCheck.valid) {
      return res.status(400).json({ error: integrityCheck.reason });
    }
    
    bids.push(newBid);
    
    // Update requirement bid count
    const requirementIndex = requirements.findIndex(r => r.id === requirementId);
    if (requirementIndex !== -1) {
      requirements[requirementIndex].bidCount = (requirements[requirementIndex].bidCount || 0) + 1;
      requirements[requirementIndex].updatedAt = new Date().toISOString();
    }
    
    // Log bid activity for audit
    console.log(`New bid submitted: ${newBid.id} by exporter ${req.user.userId} for requirement ${requirementId}`);
    
    res.status(201).json({
      message: 'Bid submitted successfully',
      bid: newBid
    });
    
  } catch (error) {
    console.error('Submit bid error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update bid (exporters only, before deadline)
const updateBid = async (req, res) => {
  try {
    const { id } = req.params;
    const bidIndex = bids.findIndex(b => b.id === id && b.exporterId === req.user.userId);
    
    if (bidIndex === -1) {
      return res.status(404).json({ error: 'Bid not found or unauthorized' });
    }
    
    const bid = bids[bidIndex];
    
    // Check if bid can be updated
    if (bid.status !== 'active') {
      return res.status(400).json({ error: 'Cannot update inactive bid' });
    }
    
    // Check if requirement is still active and deadline hasn't passed
    const requirement = requirements.find(r => r.id === bid.requirementId);
    if (!requirement || requirement.status !== 'active') {
      return res.status(400).json({ error: 'Requirement is no longer accepting bids' });
    }
    
    const bidDeadline = new Date(requirement.bidDeadline);
    const now = new Date();
    if (now > bidDeadline) {
      return res.status(400).json({ error: 'Bid deadline has passed' });
    }
    
    // Validate input
    await Promise.all(bidValidation.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const {
      price,
      currency,
      deliveryTime,
      deliveryTimeUnit,
      paymentTerms,
      deliveryTerms,
      additionalNotes,
      validUntil
    } = req.body;
    
    // Update bid
    bids[bidIndex] = {
      ...bid,
      price: price ? parseFloat(price) : bid.price,
      currency: currency || bid.currency,
      deliveryTime: deliveryTime ? parseInt(deliveryTime) : bid.deliveryTime,
      deliveryTimeUnit: deliveryTimeUnit || bid.deliveryTimeUnit,
      paymentTerms: paymentTerms !== undefined ? paymentTerms : bid.paymentTerms,
      deliveryTerms: deliveryTerms !== undefined ? deliveryTerms : bid.deliveryTerms,
      additionalNotes: additionalNotes !== undefined ? additionalNotes : bid.additionalNotes,
      validUntil: validUntil ? new Date(validUntil).toISOString() : bid.validUntil,
      updatedAt: new Date().toISOString()
    };
    
    // Log bid update for audit
    console.log(`Bid updated: ${id} by exporter ${req.user.userId}`);
    
    res.json({
      message: 'Bid updated successfully',
      bid: bids[bidIndex]
    });
    
  } catch (error) {
    console.error('Update bid error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Withdraw bid (exporters only)
const withdrawBid = (req, res) => {
  try {
    const { id } = req.params;
    const bidIndex = bids.findIndex(b => b.id === id && b.exporterId === req.user.userId);
    
    if (bidIndex === -1) {
      return res.status(404).json({ error: 'Bid not found or unauthorized' });
    }
    
    const bid = bids[bidIndex];
    
    if (bid.status !== 'active') {
      return res.status(400).json({ error: 'Cannot withdraw inactive bid' });
    }
    
    // Update bid status
    bids[bidIndex].status = 'withdrawn';
    bids[bidIndex].updatedAt = new Date().toISOString();
    
    // Update requirement bid count
    const requirementIndex = requirements.findIndex(r => r.id === bid.requirementId);
    if (requirementIndex !== -1) {
      requirements[requirementIndex].bidCount = Math.max((requirements[requirementIndex].bidCount || 1) - 1, 0);
      requirements[requirementIndex].updatedAt = new Date().toISOString();
    }
    
    // Log bid withdrawal for audit
    console.log(`Bid withdrawn: ${id} by exporter ${req.user.userId}`);
    
    res.json({
      message: 'Bid withdrawn successfully',
      bid: bids[bidIndex]
    });
    
  } catch (error) {
    console.error('Withdraw bid error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Accept bid (importers only)
const acceptBid = (req, res) => {
  try {
    const { id } = req.params;
    const bid = bids.find(b => b.id === id);
    
    if (!bid) {
      return res.status(404).json({ error: 'Bid not found' });
    }
    
    // Check if requirement belongs to the importer
    const requirement = requirements.find(r => r.id === bid.requirementId);
    if (!requirement || requirement.importerId !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized to accept this bid' });
    }
    
    if (requirement.status !== 'active') {
      return res.status(400).json({ error: 'Requirement is not active' });
    }
    
    if (bid.status !== 'active') {
      return res.status(400).json({ error: 'Bid is not active' });
    }
    
    // Accept the bid
    const bidIndex = bids.findIndex(b => b.id === id);
    bids[bidIndex].status = 'accepted';
    bids[bidIndex].acceptedAt = new Date().toISOString();
    bids[bidIndex].updatedAt = new Date().toISOString();
    
    // Reject all other bids for this requirement
    bids.forEach((b, index) => {
      if (b.requirementId === bid.requirementId && b.id !== id && b.status === 'active') {
        bids[index].status = 'rejected';
        bids[index].updatedAt = new Date().toISOString();
      }
    });
    
    // Update requirement status
    const requirementIndex = requirements.findIndex(r => r.id === bid.requirementId);
    if (requirementIndex !== -1) {
      requirements[requirementIndex].status = 'awarded';
      requirements[requirementIndex].awardedBidId = id;
      requirements[requirementIndex].updatedAt = new Date().toISOString();
    }
    
    // Log bid acceptance for audit
    console.log(`Bid accepted: ${id} by importer ${req.user.userId} for requirement ${bid.requirementId}`);
    
    res.json({
      message: 'Bid accepted successfully',
      bid: bids[bidIndex],
      requirement: requirements[requirementIndex]
    });
    
  } catch (error) {
    console.error('Accept bid error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get bid statistics
const getBidStats = (req, res) => {
  try {
    const exporterId = req.user.userId;
    const exporterBids = bids.filter(b => b.exporterId === exporterId);
    
    const stats = {
      total: exporterBids.length,
      active: exporterBids.filter(b => b.status === 'active').length,
      accepted: exporterBids.filter(b => b.status === 'accepted').length,
      rejected: exporterBids.filter(b => b.status === 'rejected').length,
      withdrawn: exporterBids.filter(b => b.status === 'withdrawn').length,
      winRate: exporterBids.length > 0 ? 
        (exporterBids.filter(b => b.status === 'accepted').length / exporterBids.length * 100).toFixed(2) : 0
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Get bid stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Define routes
router.get('/requirement/:requirementId', getBidsForRequirement);
router.get('/my', authenticateToken, requireRole('exporter'), getExporterBids);
router.get('/stats', authenticateToken, getBidStats);
router.post('/', authenticateToken, requireRole('exporter'), bidValidation, submitBid);
router.put('/:id', authenticateToken, requireRole('exporter'), updateBid);
router.delete('/:id', authenticateToken, requireRole('exporter'), withdrawBid);
router.put('/:id/accept', authenticateToken, requireRole('importer'), acceptBid);

// Export router
module.exports = router;

// Export bids array for other modules (development only)
module.exports.bids = bids;