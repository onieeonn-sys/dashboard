const express = require('express');
const { validationResult, body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// In-memory documents storage (replace with database)
let documents = [];

// Document categories and types
const DOCUMENT_CATEGORIES = {
  business: [
    'IEC Certificate',
    'GST Registration',
    'Company Registration',
    'ISO Certification',
    'Trade License',
    'Bank Certificate',
    'Audited Financial Statements'
  ],
  product: [
    'Product Catalog',
    'Quality Certificate',
    'Test Reports',
    'Compliance Certificate',
    'Manufacturing License',
    'Product Images',
    'Technical Specifications'
  ],
  shipment: [
    'Commercial Invoice',
    'Packing List',
    'Bill of Lading',
    'Certificate of Origin',
    'Insurance Certificate',
    'Inspection Certificate',
    'Customs Declaration',
    'Shipping Instructions'
  ],
  compliance: [
    'Export License',
    'Import License',
    'Phytosanitary Certificate',
    'Health Certificate',
    'Environmental Clearance',
    'Safety Certificate',
    'Regulatory Approval'
  ]
};

// Configure multer for document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/documents/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit
    files: 50 // Maximum 50 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|xls|xlsx|jpg|jpeg|png|gif|tiff|bmp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || 
                     file.mimetype.includes('pdf') || 
                     file.mimetype.includes('document') || 
                     file.mimetype.includes('spreadsheet') ||
                     file.mimetype.includes('image');
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only document and image files are allowed'));
    }
  }
});

// Validation rules
const documentValidation = [
  body('title').notEmpty().trim().isLength({ min: 3, max: 200 }),
  body('category').isIn(Object.keys(DOCUMENT_CATEGORIES)),
  body('type').notEmpty().trim(),
  body('description').optional().trim().isLength({ max: 1000 }),
  body('expiryDate').optional().isISO8601().toDate(),
  body('issueDate').optional().isISO8601().toDate(),
  body('issuingAuthority').optional().trim().isLength({ max: 200 }),
  body('documentNumber').optional().trim().isLength({ max: 100 }),
  body('isPublic').optional().isBoolean()
];

// Helper function to validate document format
const validateDocumentFormat = (file) => {
  const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.gif', '.tiff', '.bmp'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (!allowedExtensions.includes(fileExtension)) {
    return { valid: false, message: 'Invalid file format' };
  }
  
  if (file.size > 15 * 1024 * 1024) {
    return { valid: false, message: 'File size exceeds 15MB limit' };
  }
  
  return { valid: true };
};

// Helper function to check document expiry
const checkDocumentExpiry = (document) => {
  if (!document.expiryDate) return { status: 'no_expiry', daysUntilExpiry: null };
  
  const now = new Date();
  const expiryDate = new Date(document.expiryDate);
  const timeDiff = expiryDate.getTime() - now.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  
  if (daysDiff < 0) {
    return { status: 'expired', daysUntilExpiry: daysDiff };
  } else if (daysDiff <= 30) {
    return { status: 'expiring_soon', daysUntilExpiry: daysDiff };
  } else {
    return { status: 'valid', daysUntilExpiry: daysDiff };
  }
};

// Get all documents for user
const getDocuments = (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      category = 'all',
      type = 'all',
      status = 'all',
      page = 1,
      limit = 20,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    // Filter documents by user
    let userDocuments = documents.filter(d => d.userId === userId);
    
    // Apply filters
    if (category !== 'all') {
      userDocuments = userDocuments.filter(d => d.category === category);
    }
    
    if (type !== 'all') {
      userDocuments = userDocuments.filter(d => d.type === type);
    }
    
    if (search) {
      const searchTerm = search.toLowerCase();
      userDocuments = userDocuments.filter(d => 
        d.title.toLowerCase().includes(searchTerm) ||
        d.description.toLowerCase().includes(searchTerm) ||
        d.type.toLowerCase().includes(searchTerm)
      );
    }
    
    // Add expiry status to each document
    userDocuments = userDocuments.map(doc => ({
      ...doc,
      expiryStatus: checkDocumentExpiry(doc)
    }));
    
    // Filter by expiry status
    if (status !== 'all') {
      userDocuments = userDocuments.filter(d => d.expiryStatus.status === status);
    }
    
    // Sort documents
    userDocuments.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'createdAt' || sortBy === 'updatedAt' || sortBy === 'expiryDate' || sortBy === 'issueDate') {
        aValue = new Date(aValue || 0);
        bValue = new Date(bValue || 0);
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
    const paginatedDocuments = userDocuments.slice(startIndex, endIndex);
    
    res.json({
      documents: paginatedDocuments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(userDocuments.length / parseInt(limit)),
        totalDocuments: userDocuments.length,
        hasNext: endIndex < userDocuments.length,
        hasPrev: startIndex > 0
      }
    });
    
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get single document by ID
const getDocumentById = (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    const document = documents.find(d => 
      d.id === id && (d.userId === userId || d.isPublic)
    );
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found or unauthorized' });
    }
    
    // Add expiry status
    const documentWithStatus = {
      ...document,
      expiryStatus: checkDocumentExpiry(document)
    };
    
    res.json(documentWithStatus);
    
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Upload new documents
const uploadDocuments = async (req, res) => {
  try {
    // Validate input
    await Promise.all(documentValidation.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const {
      title,
      category,
      type,
      description,
      expiryDate,
      issueDate,
      issuingAuthority,
      documentNumber,
      isPublic
    } = req.body;
    
    // Validate document type for category
    if (!DOCUMENT_CATEGORIES[category].includes(type)) {
      return res.status(400).json({ error: 'Invalid document type for category' });
    }
    
    // Validate uploaded files
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    const uploadedDocuments = [];
    
    for (const file of req.files) {
      const formatValidation = validateDocumentFormat(file);
      if (!formatValidation.valid) {
        return res.status(400).json({ error: formatValidation.message });
      }
      
      const newDocument = {
        id: uuidv4(),
        userId: req.user.userId,
        title,
        category,
        type,
        description: description || '',
        
        // File information
        filename: file.filename,
        originalName: file.originalname,
        path: file.path,
        size: file.size,
        mimeType: file.mimetype,
        
        // Document metadata
        expiryDate: expiryDate ? new Date(expiryDate).toISOString() : null,
        issueDate: issueDate ? new Date(issueDate).toISOString() : null,
        issuingAuthority: issuingAuthority || '',
        documentNumber: documentNumber || '',
        
        // Access control
        isPublic: isPublic === 'true' || isPublic === true,
        
        // Status
        isVerified: false,
        verificationNotes: '',
        
        // Metadata
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      documents.push(newDocument);
      uploadedDocuments.push(newDocument);
    }
    
    res.status(201).json({
      message: 'Documents uploaded successfully',
      documents: uploadedDocuments
    });
    
  } catch (error) {
    console.error('Upload documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update document metadata
const updateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    const documentIndex = documents.findIndex(d => d.id === id && d.userId === userId);
    
    if (documentIndex === -1) {
      return res.status(404).json({ error: 'Document not found or unauthorized' });
    }
    
    // Validate input
    await Promise.all(documentValidation.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const {
      title,
      category,
      type,
      description,
      expiryDate,
      issueDate,
      issuingAuthority,
      documentNumber,
      isPublic
    } = req.body;
    
    // Validate document type for category
    if (category && type && !DOCUMENT_CATEGORIES[category].includes(type)) {
      return res.status(400).json({ error: 'Invalid document type for category' });
    }
    
    const document = documents[documentIndex];
    
    // Update document
    documents[documentIndex] = {
      ...document,
      title: title || document.title,
      category: category || document.category,
      type: type || document.type,
      description: description !== undefined ? description : document.description,
      expiryDate: expiryDate ? new Date(expiryDate).toISOString() : document.expiryDate,
      issueDate: issueDate ? new Date(issueDate).toISOString() : document.issueDate,
      issuingAuthority: issuingAuthority !== undefined ? issuingAuthority : document.issuingAuthority,
      documentNumber: documentNumber !== undefined ? documentNumber : document.documentNumber,
      isPublic: isPublic !== undefined ? (isPublic === 'true' || isPublic === true) : document.isPublic,
      updatedAt: new Date().toISOString()
    };
    
    res.json({
      message: 'Document updated successfully',
      document: documents[documentIndex]
    });
    
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete document
const deleteDocument = (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    const documentIndex = documents.findIndex(d => d.id === id && d.userId === userId);
    
    if (documentIndex === -1) {
      return res.status(404).json({ error: 'Document not found or unauthorized' });
    }
    
    const document = documents[documentIndex];
    
    // Delete file from filesystem
    try {
      if (fs.existsSync(document.path)) {
        fs.unlinkSync(document.path);
      }
    } catch (fileError) {
      console.error('Error deleting file:', fileError);
    }
    
    documents.splice(documentIndex, 1);
    
    res.json({ message: 'Document deleted successfully' });
    
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Download document
const downloadDocument = (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    const document = documents.find(d => 
      d.id === id && (d.userId === userId || d.isPublic)
    );
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found or unauthorized' });
    }
    
    if (!fs.existsSync(document.path)) {
      return res.status(404).json({ error: 'File not found on server' });
    }
    
    res.download(document.path, document.originalName);
    
  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get document categories and types
const getDocumentCategories = (req, res) => {
  try {
    res.json({
      categories: DOCUMENT_CATEGORIES
    });
  } catch (error) {
    console.error('Get document categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get document compliance status
const getComplianceStatus = (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    
    const userDocuments = documents.filter(d => d.userId === userId);
    
    // Required documents based on user role
    const requiredDocs = {
      exporter: {
        business: ['IEC Certificate', 'GST Registration', 'Company Registration'],
        compliance: ['Export License']
      },
      importer: {
        business: ['IEC Certificate', 'GST Registration', 'Company Registration'],
        compliance: ['Import License']
      }
    };
    
    const required = requiredDocs[userRole] || { business: [], compliance: [] };
    const compliance = {};
    
    // Check each required document category
    Object.keys(required).forEach(category => {
      compliance[category] = {};
      
      required[category].forEach(docType => {
        const userDoc = userDocuments.find(d => d.category === category && d.type === docType);
        
        if (userDoc) {
          const expiryStatus = checkDocumentExpiry(userDoc);
          compliance[category][docType] = {
            status: expiryStatus.status === 'expired' ? 'expired' : 'available',
            document: userDoc,
            expiryStatus
          };
        } else {
          compliance[category][docType] = {
            status: 'missing',
            document: null,
            expiryStatus: null
          };
        }
      });
    });
    
    // Calculate overall compliance score
    const totalRequired = Object.values(required).reduce((sum, docs) => sum + docs.length, 0);
    const availableCount = Object.values(compliance)
      .reduce((sum, category) => 
        sum + Object.values(category).filter(doc => doc.status === 'available').length, 0
      );
    
    const complianceScore = totalRequired > 0 ? (availableCount / totalRequired * 100).toFixed(2) : 100;
    
    res.json({
      complianceScore: parseFloat(complianceScore),
      totalRequired,
      availableCount,
      compliance,
      summary: {
        missing: Object.values(compliance)
          .reduce((sum, category) => 
            sum + Object.values(category).filter(doc => doc.status === 'missing').length, 0
          ),
        expired: Object.values(compliance)
          .reduce((sum, category) => 
            sum + Object.values(category).filter(doc => doc.status === 'expired').length, 0
          ),
        expiringSoon: userDocuments.filter(d => 
          checkDocumentExpiry(d).status === 'expiring_soon'
        ).length
      }
    });
    
  } catch (error) {
    console.error('Get compliance status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get document statistics
const getDocumentStats = (req, res) => {
  try {
    const userId = req.user.userId;
    const userDocuments = documents.filter(d => d.userId === userId);
    
    const stats = {
      total: userDocuments.length,
      byCategory: {},
      byStatus: {
        valid: 0,
        expiring_soon: 0,
        expired: 0,
        no_expiry: 0
      },
      totalSize: userDocuments.reduce((sum, d) => sum + d.size, 0),
      verified: userDocuments.filter(d => d.isVerified).length,
      public: userDocuments.filter(d => d.isPublic).length
    };
    
    // Count by category
    Object.keys(DOCUMENT_CATEGORIES).forEach(category => {
      stats.byCategory[category] = userDocuments.filter(d => d.category === category).length;
    });
    
    // Count by expiry status
    userDocuments.forEach(doc => {
      const expiryStatus = checkDocumentExpiry(doc);
      stats.byStatus[expiryStatus.status]++;
    });
    
    res.json(stats);
    
  } catch (error) {
    console.error('Get document stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Define routes
router.get('/', authenticateToken, getDocuments);
router.get('/categories', getDocumentCategories);
router.get('/compliance', authenticateToken, getComplianceStatus);
router.get('/stats', authenticateToken, getDocumentStats);
router.get('/:id', authenticateToken, getDocumentById);
router.get('/:id/download', authenticateToken, downloadDocument);
router.post('/', authenticateToken, upload.array('documents', 10), documentValidation, uploadDocuments);
router.put('/:id', authenticateToken, updateDocument);
router.delete('/:id', authenticateToken, deleteDocument);

// Export router
module.exports = router;

// Export documents array and constants for other modules (development only)
module.exports.documents = documents;
module.exports.DOCUMENT_CATEGORIES = DOCUMENT_CATEGORIES;