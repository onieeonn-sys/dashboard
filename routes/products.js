const express = require('express');
const { validationResult, body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// In-memory product storage (replace with database)
let products = [
  {
    id: 'prod-001',
    name: 'Premium Coffee Beans',
    description: 'High-quality Arabica coffee beans from Colombian highlands. Perfect for specialty coffee shops and roasters.',
    category: 'Food & Beverages',
    subcategory: 'Coffee & Tea',
    specifications: {
      origin: 'Colombia',
      variety: 'Arabica',
      processing: 'Washed',
      grade: 'AA',
      moisture: '12%',
      packaging: '60kg jute bags'
    },
    pricing: {
      currency: 'USD',
      basePrice: 4.50,
      unit: 'kg',
      minOrderQuantity: 1000,
      maxOrderQuantity: 50000
    },
    exporterId: 'test-exporter-1',
    images: [],
    certifications: ['Organic', 'Fair Trade', 'Rainforest Alliance'],
    availability: 'In Stock',
    leadTime: '2-3 weeks',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    isActive: true
  },
  {
    id: 'prod-002',
    name: 'Organic Cotton Fabric',
    description: 'Premium organic cotton fabric suitable for garment manufacturing. GOTS certified and eco-friendly.',
    category: 'Textiles',
    subcategory: 'Cotton Fabrics',
    specifications: {
      material: '100% Organic Cotton',
      weight: '180 GSM',
      width: '150cm',
      weave: 'Plain',
      color: 'Natural White',
      finish: 'Pre-shrunk'
    },
    pricing: {
      currency: 'USD',
      basePrice: 3.20,
      unit: 'meter',
      minOrderQuantity: 5000,
      maxOrderQuantity: 100000
    },
    exporterId: 'test-exporter-1',
    images: [],
    certifications: ['GOTS', 'OEKO-TEX Standard 100'],
    availability: 'In Stock',
    leadTime: '3-4 weeks',
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10'),
    isActive: true
  }
];

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/products/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 10 // Maximum 10 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Validation rules
const productValidation = [
  body('name').notEmpty().trim().isLength({ min: 3, max: 200 }),
  body('description').notEmpty().trim().isLength({ min: 10, max: 2000 }),
  body('category').notEmpty().trim(),
  body('subcategory').optional().trim(),
  body('price').isNumeric().isFloat({ min: 0 }),
  body('currency').isIn(['USD', 'EUR', 'INR', 'GBP', 'JPY', 'CNY']),
  body('minimumOrderQuantity').isNumeric().isInt({ min: 1 }),
  body('unit').notEmpty().trim(),
  body('specifications').optional().isObject(),
  body('certifications').optional().isArray(),
  body('origin').notEmpty().trim(),
  body('leadTime').isNumeric().isInt({ min: 1 }),
  body('shelfLife').optional().isNumeric().isInt({ min: 1 })
];

// Get all products with filtering and pagination
const getAllProducts = (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      subcategory,
      minPrice,
      maxPrice,
      currency = 'USD',
      origin,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    let filteredProducts = [...products];

    // Apply filters
    if (category) {
      filteredProducts = filteredProducts.filter(p => 
        p.category.toLowerCase().includes(category.toLowerCase())
      );
    }

    if (subcategory) {
      filteredProducts = filteredProducts.filter(p => 
        p.subcategory && p.subcategory.toLowerCase().includes(subcategory.toLowerCase())
      );
    }

    if (minPrice) {
      filteredProducts = filteredProducts.filter(p => p.price >= parseFloat(minPrice));
    }

    if (maxPrice) {
      filteredProducts = filteredProducts.filter(p => p.price <= parseFloat(maxPrice));
    }

    if (origin) {
      filteredProducts = filteredProducts.filter(p => 
        p.origin.toLowerCase().includes(origin.toLowerCase())
      );
    }

    if (search) {
      const searchTerm = search.toLowerCase();
      filteredProducts = filteredProducts.filter(p => 
        p.name.toLowerCase().includes(searchTerm) ||
        p.description.toLowerCase().includes(searchTerm) ||
        p.category.toLowerCase().includes(searchTerm)
      );
    }

    // Sort products
    filteredProducts.sort((a, b) => {
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
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

    res.json({
      products: paginatedProducts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(filteredProducts.length / parseInt(limit)),
        totalProducts: filteredProducts.length,
        hasNext: endIndex < filteredProducts.length,
        hasPrev: startIndex > 0
      }
    });

  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get single product by ID
const getProductById = (req, res) => {
  try {
    const { id } = req.params;
    const product = products.find(p => p.id === id);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get products by exporter
const getExporterProducts = (req, res) => {
  try {
    const exporterId = req.user.userId;
    const exporterProducts = products.filter(p => p.exporterId === exporterId);
    
    res.json({
      products: exporterProducts,
      total: exporterProducts.length
    });
  } catch (error) {
    console.error('Get exporter products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create new product (exporters only)
const createProduct = async (req, res) => {
  try {
    // Validate input
    await Promise.all(productValidation.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      description,
      category,
      subcategory,
      price,
      currency,
      minimumOrderQuantity,
      unit,
      specifications,
      certifications,
      origin,
      leadTime,
      shelfLife,
      packagingDetails,
      paymentTerms,
      deliveryTerms
    } = req.body;

    // Handle uploaded images
    const images = req.files ? req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      size: file.size
    })) : [];

    const newProduct = {
      id: uuidv4(),
      exporterId: req.user.userId,
      name,
      description,
      category,
      subcategory: subcategory || '',
      price: parseFloat(price),
      currency,
      minimumOrderQuantity: parseInt(minimumOrderQuantity),
      unit,
      specifications: specifications || {},
      certifications: certifications || [],
      origin,
      leadTime: parseInt(leadTime),
      shelfLife: shelfLife ? parseInt(shelfLife) : null,
      packagingDetails: packagingDetails || '',
      paymentTerms: paymentTerms || '',
      deliveryTerms: deliveryTerms || '',
      images,
      isActive: true,
      views: 0,
      inquiries: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    products.push(newProduct);

    res.status(201).json({
      message: 'Product created successfully',
      product: newProduct
    });

  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update product (exporters only)
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const productIndex = products.findIndex(p => p.id === id && p.exporterId === req.user.userId);
    
    if (productIndex === -1) {
      return res.status(404).json({ error: 'Product not found or unauthorized' });
    }

    // Validate input
    await Promise.all(productValidation.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      description,
      category,
      subcategory,
      price,
      currency,
      minimumOrderQuantity,
      unit,
      specifications,
      certifications,
      origin,
      leadTime,
      shelfLife,
      packagingDetails,
      paymentTerms,
      deliveryTerms,
      isActive
    } = req.body;

    // Handle new uploaded images
    const newImages = req.files ? req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      size: file.size
    })) : [];

    // Update product
    products[productIndex] = {
      ...products[productIndex],
      name: name || products[productIndex].name,
      description: description || products[productIndex].description,
      category: category || products[productIndex].category,
      subcategory: subcategory || products[productIndex].subcategory,
      price: price ? parseFloat(price) : products[productIndex].price,
      currency: currency || products[productIndex].currency,
      minimumOrderQuantity: minimumOrderQuantity ? parseInt(minimumOrderQuantity) : products[productIndex].minimumOrderQuantity,
      unit: unit || products[productIndex].unit,
      specifications: specifications || products[productIndex].specifications,
      certifications: certifications || products[productIndex].certifications,
      origin: origin || products[productIndex].origin,
      leadTime: leadTime ? parseInt(leadTime) : products[productIndex].leadTime,
      shelfLife: shelfLife ? parseInt(shelfLife) : products[productIndex].shelfLife,
      packagingDetails: packagingDetails || products[productIndex].packagingDetails,
      paymentTerms: paymentTerms || products[productIndex].paymentTerms,
      deliveryTerms: deliveryTerms || products[productIndex].deliveryTerms,
      isActive: isActive !== undefined ? isActive : products[productIndex].isActive,
      images: newImages.length > 0 ? [...products[productIndex].images, ...newImages] : products[productIndex].images,
      updatedAt: new Date().toISOString()
    };

    res.json({
      message: 'Product updated successfully',
      product: products[productIndex]
    });

  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete product (exporters only)
const deleteProduct = (req, res) => {
  try {
    const { id } = req.params;
    const productIndex = products.findIndex(p => p.id === id && p.exporterId === req.user.userId);
    
    if (productIndex === -1) {
      return res.status(404).json({ error: 'Product not found or unauthorized' });
    }

    products.splice(productIndex, 1);

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get product categories
const getCategories = (req, res) => {
  try {
    const categories = [...new Set(products.map(p => p.category))].sort();
    const subcategories = {};
    
    categories.forEach(category => {
      subcategories[category] = [...new Set(
        products
          .filter(p => p.category === category && p.subcategory)
          .map(p => p.subcategory)
      )].sort();
    });

    res.json({
      categories,
      subcategories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Define routes
router.get('/', getAllProducts);
router.get('/categories', getCategories);
router.get('/my', authenticateToken, requireRole('exporter'), getExporterProducts);
router.get('/:id', getProductById);
router.post('/', authenticateToken, requireRole('exporter'), upload.array('images', 5), productValidation, createProduct);
router.put('/:id', authenticateToken, requireRole('exporter'), upload.array('images', 5), updateProduct);
router.delete('/:id', authenticateToken, requireRole('exporter'), deleteProduct);

// Export router
module.exports = router;

// Export products array for other modules (development only)
module.exports.products = products;