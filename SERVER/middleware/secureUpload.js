const multer = require('multer');
const path = require('path');

// File type validation
const fileFilter = (req, file, cb) => {
  console.log('🔍 File upload attempt:', {
    filename: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });

  // Allowed MIME types
  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv', // .csv
    'application/csv'
  ];
  
  // Allowed file extensions
  const allowedExtensions = ['.xlsx', '.xls', '.csv'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  // Check MIME type
  if (!allowedMimeTypes.includes(file.mimetype)) {
    console.error('❌ Invalid MIME type:', file.mimetype);
    return cb(new Error(`Invalid file type. Expected: ${allowedMimeTypes.join(', ')}`), false);
  }
  
  // Check file extension
  if (!allowedExtensions.includes(fileExtension)) {
    console.error('❌ Invalid file extension:', fileExtension);
    return cb(new Error(`Invalid file extension. Expected: ${allowedExtensions.join(', ')}`), false);
  }
  
  // Additional security checks
  if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
    console.error('❌ Suspicious filename:', file.originalname);
    return cb(new Error('Invalid filename. Path traversal detected.'), false);
  }
  
  console.log('✅ File validation passed:', file.originalname);
  cb(null, true);
};

// Configure multer with security options
const createSecureUpload = (options = {}) => {
  const defaultOptions = {
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB default limit
      files: 1, // Only one file at a time
      fields: 10, // Limit number of form fields
      fieldNameSize: 100, // Limit field name length
      fieldSize: 1024 * 1024 // 1MB field value limit
    },
    fileFilter: fileFilter
  };
  
  // Merge with custom options
  const config = {
    ...defaultOptions,
    ...options,
    limits: {
      ...defaultOptions.limits,
      ...options.limits
    }
  };
  
  return multer(config);
};

// Standard upload middleware
const upload = createSecureUpload();

// Smaller file upload for specific use cases
const smallUpload = createSecureUpload({
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
    files: 1
  }
});

// Large file upload for bulk operations
const bulkUpload = createSecureUpload({
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1
  }
});

// Error handler for multer errors
const handleUploadError = (error, req, res, next) => {
  console.error('📤 Upload error:', error);

  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({ 
          error: 'File too large', 
          message: `Maximum file size is ${Math.round(error.limit / 1024 / 1024)}MB` 
        });
      
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({ 
          error: 'Too many files', 
          message: 'Only one file can be uploaded at a time' 
        });
      
      case 'LIMIT_FIELD_COUNT':
        return res.status(400).json({ 
          error: 'Too many fields', 
          message: 'Form has too many fields' 
        });
      
      case 'LIMIT_FIELD_KEY':
        return res.status(400).json({ 
          error: 'Field name too long', 
          message: 'Form field name is too long' 
        });
      
      case 'LIMIT_FIELD_VALUE':
        return res.status(400).json({ 
          error: 'Field value too long', 
          message: 'Form field value is too long' 
        });
      
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({ 
          error: 'Unexpected field', 
          message: 'Unexpected file field in form' 
        });
      
      default:
        return res.status(400).json({ 
          error: 'Upload error', 
          message: error.message 
        });
    }
  }
  
  // Custom file filter errors
  if (error.message.includes('Invalid file type') || 
      error.message.includes('Invalid file extension') ||
      error.message.includes('Path traversal detected')) {
    return res.status(400).json({ 
      error: 'Invalid file', 
      message: error.message 
    });
  }
  
  // Other errors
  console.error('Unexpected upload error:', error);
  return res.status(500).json({ 
    error: 'Upload failed', 
    message: 'An unexpected error occurred during file upload' 
  });
};

// File content validation (additional security layer)
const validateFileContent = async (req, res, next) => {
  if (!req.file) {
    return next();
  }
  
  try {
    const buffer = req.file.buffer;
    
    // Check for malicious content patterns
    const maliciousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i
    ];
    
    const contentString = buffer.toString('utf8', 0, Math.min(buffer.length, 1024));
    
    for (const pattern of maliciousPatterns) {
      if (pattern.test(contentString)) {
        console.error('❌ Malicious content detected in file:', req.file.originalname);
        return res.status(400).json({
          error: 'Malicious content detected',
          message: 'File contains potentially dangerous content'
        });
      }
    }
    
    // Validate file structure for Excel/CSV
    if (req.file.mimetype.includes('excel') || req.file.mimetype.includes('csv')) {
      // Basic validation - check if file starts with expected headers
      const firstBytes = buffer.slice(0, 100);
      
      if (req.file.mimetype.includes('csv')) {
        // CSV should start with printable characters
        const csvStart = firstBytes.toString('utf8');
        if (!/^[\x20-\x7E\r\n,]*$/.test(csvStart)) {
          console.error('❌ Invalid CSV format detected');
          return res.status(400).json({
            error: 'Invalid file format',
            message: 'File does not appear to be a valid CSV'
          });
        }
      }
    }
    
    console.log('✅ File content validation passed:', req.file.originalname);
    next();
    
  } catch (error) {
    console.error('File content validation error:', error);
    return res.status(500).json({
      error: 'File validation failed',
      message: 'Could not validate file content'
    });
  }
};

// Audit logging for file uploads
const auditFileUpload = (req, res, next) => {
  if (req.file) {
    console.log('📁 File upload audit:', {
      user: req.user?.id || 'anonymous',
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
  }
  next();
};

module.exports = {
  upload,
  smallUpload,
  bulkUpload,
  createSecureUpload,
  handleUploadError,
  validateFileContent,
  auditFileUpload
};
