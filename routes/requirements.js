const express = require('express');
const { validationResult, body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// In-memory requirements storage (replace with database)
let requirements = [
  {
    id: 'req-001',
    title: 'High-Quality Coffee Beans for Specialty Roastery',
    description: 'We are looking for premium Arabica coffee beans for our specialty coffee roastery. We need consistent quality, proper certifications, and reliable supply chain. The beans should be suitable for espresso and filter coffee preparation.',
    category: 'Food & Beverages',
    subcategory: 'Coffee & Tea',
    quantity: 5000,
    unit: 'kg',
    targetPrice: 4.00,
    maxPrice: 5.00,
    currency: 'USD',
    specifications: {
      origin: 'South America preferred',
      variety: 'Arabica',
      processing: 'Washed or Natural',
      grade: 'AA or higher',
      moisture: 'Max 12%',
      packaging: 'Jute bags or GrainPro'
    },
    deliveryLocation: 'New York, USA',
    deadline: new Date('2024-03-15'),
    importerId: 'test-importer-1',
    status: 'open',
    urgency: 'medium',
    certifications: ['Organic', 'Fair Trade'],
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-01-20'),
    isActive: true
  },
  {
    id: 'req-002',
    title: 'Sustainable Cotton Fabric for Garment Production',
    description: 'Seeking sustainable cotton fabric for our eco-friendly clothing line. We need GOTS certified organic cotton with consistent quality and color. The fabric will be used for t-shirts and casual wear.',
    category: 'Textiles',
    subcategory: 'Cotton Fabrics',
    quantity: 10000,
    unit: 'meter',
    targetPrice: 2.80,
    maxPrice: 3.50,
    currency: 'USD',
    specifications: {
      material: '100% Organic Cotton',
      weight: '160-200 GSM',
      width: '150cm minimum',
      weave: 'Plain or Jersey',
      color: 'Natural white or light colors',
      finish: 'Pre-shrunk and soft'
    },
    deliveryLocation: 'Los Angeles, USA',
    deadline: new Date('2024-04-01'),
    importerId: 'test-importer-1',
    status: 'open',
    urgency: 'high',
    certifications: ['GOTS', 'OEKO-TEX'],
    createdAt: new Date('2024-01-18'),
    updatedAt: new Date('2024-01-18'),
    isActive: true
  }
];

// Validation rules
const requirementValidation = [
  body('title').notEmpty().trim().isLength({ min: 5, max: 200 }),
  body('description').notEmpty().trim().isLength({ min: 20, max: 2000 }),
  body('category').notEmpty().trim(),
  body('subcategory').optional().trim(),
  body('quantity').isNumeric().isInt({ min: 1 }),
  body('unit').notEmpty().trim(),
  body('targetPrice').optional().isNumeric().isFloat({ min: 0 }),
  body('currency').isIn(['USD', 'EUR', 'INR', 'GBP', 'JPY', 'CNY']),
  body('deliveryLocation').notEmpty().trim(),
  body('bidDeadline').isISO8601().toDate(),
  body('deliveryDeadline').isISO8601().toDate(),
  body('specifications').optional().isObject(),
  body('certifications').optional().isArray(),
  body('paymentTerms').optional().trim(),
  body('deliveryTerms').optional().trim()
];

// Get all requirements with filtering and pagination
const getAllRequirements = (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      subcategory,
      minQuantity,
      maxQuantity,
      minPrice,
      maxPrice,
      currency = 'USD',
      location,
      search,
      status = 'active',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    let filteredRequirements = [...requirements];

    // Filter by status
    if (status !== 'all') {
      filteredRequirements = filteredRequirements.filter(r => r.status === status);
    }

    // Apply filters
    if (category) {
      filteredRequirements = filteredRequirements.filter(r => 
        r.category.toLowerCase().includes(category.toLowerCase())
      );
    }

    if (subcategory) {
      filteredRequirements = filteredRequirements.filter(r => 
        r.subcategory && r.subcategory.toLowerCase().includes(subcategory.toLowerCase())
      );
    }

    if (minQuantity) {
      filteredRequirements = filteredRequirements.filter(r => r.quantity >= parseInt(minQuantity));
    }

    if (maxQuantity) {
      filteredRequirements = filteredRequirements.filter(r => r.quantity <= parseInt(maxQuantity));
    }

    if (minPrice && filteredRequirements.some(r => r.targetPrice)) {
      filteredRequirements = filteredRequirements.filter(r => 
        r.targetPrice && r.targetPrice >= parseFloat(minPrice)
      );
    }

    if (maxPrice && filteredRequirements.some(r => r.targetPrice)) {
      filteredRequirements = filteredRequirements.filter(r => 
        r.targetPrice && r.targetPrice <= parseFloat(maxPrice)
      );
    }

    if (location) {
      filteredRequirements = filteredRequirements.filter(r => 
        r.deliveryLocation.toLowerCase().includes(location.toLowerCase())
      );
    }

    if (search) {
      const searchTerm = search.toLowerCase();
      filteredRequirements = filteredRequirements.filter(r => 
        r.title.toLowerCase().includes(searchTerm) ||
        r.description.toLowerCase().includes(searchTerm) ||
        r.category.toLowerCase().includes(searchTerm)
      );
    }

    // Sort requirements
    filteredRequirements.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'createdAt' || sortBy === 'updatedAt' || sortBy === 'bidDeadline' || sortBy === 'deliveryDeadline') {
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
    const paginatedRequirements = filteredRequirements.slice(startIndex, endIndex);

    res.json({
      requirements: paginatedRequirements,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(filteredRequirements.length / parseInt(limit)),
        totalRequirements: filteredRequirements.length,
        hasNext: endIndex < filteredRequirements.length,
        hasPrev: startIndex > 0
      }
    });

  } catch (error) {
    console.error('Get requirements error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get single requirement by ID
const getRequirementById = (req, res) => {
  try {
    const { id } = req.params;
    const requirement = requirements.find(r => r.id === id);
    
    if (!requirement) {
      return res.status(404).json({ error: 'Requirement not found' });
    }

    // Increment view count
    requirement.views = (requirement.views || 0) + 1;

    res.json(requirement);
  } catch (error) {
    console.error('Get requirement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get requirements by importer
const getImporterRequirements = (req, res) => {
  try {
    const importerId = req.user.userId;
    const importerRequirements = requirements.filter(r => r.importerId === importerId);
    
    res.json({
      requirements: importerRequirements,
      total: importerRequirements.length
    });
  } catch (error) {
    console.error('Get importer requirements error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create new requirement (importers only)
const createRequirement = async (req, res) => {
  try {
    // Validate input
    await Promise.all(requirementValidation.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      description,
      category,
      subcategory,
      quantity,
      unit,
      targetPrice,
      currency,
      deliveryLocation,
      bidDeadline,
      deliveryDeadline,
      specifications,
      certifications,
      paymentTerms,
      deliveryTerms,
      additionalNotes
    } = req.body;

    // Validate deadlines
    const bidDeadlineDate = new Date(bidDeadline);
    const deliveryDeadlineDate = new Date(deliveryDeadline);
    const now = new Date();

    if (bidDeadlineDate <= now) {
      return res.status(400).json({ error: 'Bid deadline must be in the future' });
    }

    if (deliveryDeadlineDate <= bidDeadlineDate) {
      return res.status(400).json({ error: 'Delivery deadline must be after bid deadline' });
    }

    const newRequirement = {
      id: uuidv4(),
      importerId: req.user.userId,
      title,
      description,
      category,
      subcategory: subcategory || '',
      quantity: parseInt(quantity),
      unit,
      targetPrice: targetPrice ? parseFloat(targetPrice) : null,
      currency,
      deliveryLocation,
      bidDeadline: bidDeadlineDate.toISOString(),
      deliveryDeadline: deliveryDeadlineDate.toISOString(),
      specifications: specifications || {},
      certifications: certifications || [],
      paymentTerms: paymentTerms || '',
      deliveryTerms: deliveryTerms || '',
      additionalNotes: additionalNotes || '',
      status: 'active',
      views: 0,
      bidCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    requirements.push(newRequirement);

    res.status(201).json({
      message: 'Requirement created successfully',
      requirement: newRequirement
    });

  } catch (error) {
    console.error('Create requirement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update requirement (importers only)
const updateRequirement = async (req, res) => {
  try {
    const { id } = req.params;
    const requirementIndex = requirements.findIndex(r => r.id === id && r.importerId === req.user.userId);
    
    if (requirementIndex === -1) {
      return res.status(404).json({ error: 'Requirement not found or unauthorized' });
    }

    const requirement = requirements[requirementIndex];

    // Check if requirement can be updated (no bids yet or still active)
    if (requirement.status === 'closed' || requirement.status === 'awarded') {
      return res.status(400).json({ error: 'Cannot update closed or awarded requirement' });
    }

    // Validate input
    await Promise.all(requirementValidation.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      description,
      category,
      subcategory,
      quantity,
      unit,
      targetPrice,
      currency,
      deliveryLocation,
      bidDeadline,
      deliveryDeadline,
      specifications,
      certifications,
      paymentTerms,
      deliveryTerms,
      additionalNotes,
      status
    } = req.body;

    // Validate deadlines if provided
    if (bidDeadline) {
      const bidDeadlineDate = new Date(bidDeadline);
      const now = new Date();
      if (bidDeadlineDate <= now) {
        return res.status(400).json({ error: 'Bid deadline must be in the future' });
      }
    }

    if (deliveryDeadline && bidDeadline) {
      const bidDeadlineDate = new Date(bidDeadline);
      const deliveryDeadlineDate = new Date(deliveryDeadline);
      if (deliveryDeadlineDate <= bidDeadlineDate) {
        return res.status(400).json({ error: 'Delivery deadline must be after bid deadline' });
      }
    }

    // Update requirement
    requirements[requirementIndex] = {
      ...requirement,
      title: title || requirement.title,
      description: description || requirement.description,
      category: category || requirement.category,
      subcategory: subcategory || requirement.subcategory,
      quantity: quantity ? parseInt(quantity) : requirement.quantity,
      unit: unit || requirement.unit,
      targetPrice: targetPrice ? parseFloat(targetPrice) : requirement.targetPrice,
      currency: currency || requirement.currency,
      deliveryLocation: deliveryLocation || requirement.deliveryLocation,
      bidDeadline: bidDeadline ? new Date(bidDeadline).toISOString() : requirement.bidDeadline,
      deliveryDeadline: deliveryDeadline ? new Date(deliveryDeadline).toISOString() : requirement.deliveryDeadline,
      specifications: specifications || requirement.specifications,
      certifications: certifications || requirement.certifications,
      paymentTerms: paymentTerms || requirement.paymentTerms,
      deliveryTerms: deliveryTerms || requirement.deliveryTerms,
      additionalNotes: additionalNotes || requirement.additionalNotes,
      status: status || requirement.status,
      updatedAt: new Date().toISOString()
    };

    res.json({
      message: 'Requirement updated successfully',
      requirement: requirements[requirementIndex]
    });

  } catch (error) {
    console.error('Update requirement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete requirement (importers only)
const deleteRequirement = (req, res) => {
  try {
    const { id } = req.params;
    const requirementIndex = requirements.findIndex(r => r.id === id && r.importerId === req.user.userId);
    
    if (requirementIndex === -1) {
      return res.status(404).json({ error: 'Requirement not found or unauthorized' });
    }

    const requirement = requirements[requirementIndex];

    // Check if requirement can be deleted (no bids yet)
    if (requirement.bidCount > 0) {
      return res.status(400).json({ error: 'Cannot delete requirement with existing bids' });
    }

    requirements.splice(requirementIndex, 1);

    res.json({ message: 'Requirement deleted successfully' });
  } catch (error) {
    console.error('Delete requirement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Close requirement (importers only)
const closeRequirement = (req, res) => {
  try {
    const { id } = req.params;
    const requirementIndex = requirements.findIndex(r => r.id === id && r.importerId === req.user.userId);
    
    if (requirementIndex === -1) {
      return res.status(404).json({ error: 'Requirement not found or unauthorized' });
    }

    requirements[requirementIndex].status = 'closed';
    requirements[requirementIndex].updatedAt = new Date().toISOString();

    res.json({
      message: 'Requirement closed successfully',
      requirement: requirements[requirementIndex]
    });
  } catch (error) {
    console.error('Close requirement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get requirement statistics
const getRequirementStats = (req, res) => {
  try {
    const importerId = req.user.userId;
    const importerRequirements = requirements.filter(r => r.importerId === importerId);
    
    const stats = {
      total: importerRequirements.length,
      active: importerRequirements.filter(r => r.status === 'active').length,
      closed: importerRequirements.filter(r => r.status === 'closed').length,
      awarded: importerRequirements.filter(r => r.status === 'awarded').length,
      totalViews: importerRequirements.reduce((sum, r) => sum + (r.views || 0), 0),
      totalBids: importerRequirements.reduce((sum, r) => sum + (r.bidCount || 0), 0)
    };

    res.json(stats);
  } catch (error) {
    console.error('Get requirement stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Define routes
router.get('/', getAllRequirements);
router.get('/stats', authenticateToken, getRequirementStats);
router.get('/my', authenticateToken, requireRole('importer'), getImporterRequirements);
router.get('/:id', getRequirementById);
router.post('/', authenticateToken, requireRole('importer'), requirementValidation, createRequirement);
router.put('/:id', authenticateToken, requireRole('importer'), updateRequirement);
router.put('/:id/close', authenticateToken, requireRole('importer'), closeRequirement);
router.delete('/:id', authenticateToken, requireRole('importer'), deleteRequirement);

// Export router
module.exports = router;

// Export requirements array for other modules (development only)
module.exports.requirements = requirements;