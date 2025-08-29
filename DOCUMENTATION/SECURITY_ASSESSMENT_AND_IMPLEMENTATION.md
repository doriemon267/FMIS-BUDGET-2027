# 🔒 FMIS Budget System Security Assessment & Implementation Guide

## 📊 Executive Summary

Your FMIS Budget System has been analyzed for security vulnerabilities. **32 vulnerabilities** were found across server (10) and client (22) dependencies, ranging from moderate to critical severity. Additionally, several application-level security gaps need immediate attention.

### 🚨 Risk Level: **HIGH** 
- **3 Critical vulnerabilities** in server dependencies
- **1 Critical vulnerability** in client dependencies  
- **Authentication bypass** in development mode
- **Missing input validation** and sanitization
- **Inadequate file upload security**
- **No rate limiting** or DDoS protection

---

## 🎯 Priority Security Issues

### 🔴 **CRITICAL (Immediate Action Required)**

#### 1. Dependency Vulnerabilities
**Server (10 vulnerabilities):**
- **form-data**: Critical - Unsafe random function
- **mongoose**: Critical - Search injection vulnerability (2 CVEs)
- **html-pdf**: High - Phantom.js dependency chain
- **xlsx**: High - Prototype pollution + ReDoS

**Client (22 vulnerabilities):**
- **form-data**: Critical - Unsafe random function  
- **axios**: High - SSRF and credential leakage
- **gatsby**: High - Multiple dependency vulnerabilities
- **xlsx**: High - Prototype pollution + ReDoS

#### 2. Authentication Bypass
```javascript
// SERVER/middleware/checkToken.js - CRITICAL SECURITY FLAW
if (!process.env.ACCOUNT_USER_API_URL) {
  req.user = {
    id: "test-user-id",
    name: "Test Budget Admin", 
    email: "budgetadmin@example.com",
    Roles: ["BUDGET ADMIN"] // ⚠️ BYPASS AUTHENTICATION
  };
  return next();
}
```

#### 3. Hardcoded Development User
Mock authentication creates admin users without validation.

---

## 🛠️ Security Implementation Plan

### Phase 1: Immediate Fixes (24-48 hours)

#### 1.1 Fix Critical Dependencies
```bash
# Server dependencies
cd SERVER
npm audit fix
npm update mongoose@latest
npm install multer@1.4.5-lts.1 --save

# Client dependencies  
cd CLIENT
npm audit fix
npm update axios@latest
npm update @eslint/plugin-kit@latest
```

#### 1.2 Secure Authentication
**Fix development authentication bypass:**

```javascript
// SERVER/middleware/checkToken.js
module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(403).json({ error: "Access denied." });
    }

    const jwtToken = authHeader.split(" ")[1];
    const payload = jwt.verify(jwtToken, process.env.JWT_SECRET_KEY);
    
    if (!payload) {
      return res.status(401).json({ error: "Access denied." });
    }

    // ✅ SECURE: Always require external authentication
    if (!process.env.ACCOUNT_USER_API_URL) {
      return res.status(500).json({ 
        error: "Authentication service not configured",
        message: "ACCOUNT_USER_API_URL must be set in production"
      });
    }

    // Fetch user data from external API
    const userRes = await fetch(process.env.ACCOUNT_USER_API_URL, {
      headers: { Authorization: `Bearer ${payload.accessToken}` },
    });

    if (!userRes.ok) {
      return res.status(403).json({ error: "Access denied" });
    }

    const user = await userRes.json();
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(401).json({ error: "Access denied" });
  }
};
```

#### 1.3 Environment Variables Security
**Create secure environment configuration:**

```bash
# SERVER/.env.example
NODE_ENV=production
JWT_SECRET_KEY=your-super-secure-jwt-secret-key-here-min-256-bits
DATABASE_URL=mongodb://localhost:27017/your-db-name
ACCOUNT_USER_API_URL=https://your-auth-service.com/api/user
APP_PORT=5000
CLIENT1=https://your-frontend-domain.com
CLIENT2=https://your-admin-domain.com
CLIENT3=https://your-backup-domain.com

# CLIENT/.env.example  
VITE_SERVER_URL=https://your-api-domain.com
VITE_AUTH_SERVER_URL=https://your-auth-service.com
VITE_AUTH_CLIENT_URL=https://your-auth-frontend.com
VITE_SECRET_KEY=your-client-encryption-key-here
```

### Phase 2: Application Security (1 week)

#### 2.1 Input Validation & Sanitization
**Implement express-validator:**

```javascript
// SERVER/middleware/validation.js
const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');

// MongoDB injection prevention
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (obj && typeof obj === 'object') {
      for (let key in obj) {
        if (typeof obj[key] === 'string') {
          // Remove MongoDB operators
          obj[key] = obj[key].replace(/\$|\./g, '');
        } else if (typeof obj[key] === 'object') {
          sanitize(obj[key]);
        }
      }
    }
  };
  
  sanitize(req.body);
  sanitize(req.query);
  sanitize(req.params);
  next();
};

// Validation rules
const validateMooeData = [
  body('*.income').isNumeric().withMessage('Income must be a number'),
  body('*.subsidy').isNumeric().withMessage('Subsidy must be a number'),
  body('*.uacsCode').matches(/^[0-9-]+$/).withMessage('Invalid UACS code format'),
  body('*.region').isLength({min:1, max:50}).escape().withMessage('Region required'),
];

const validateFileUpload = [
  body('activeRegion').notEmpty().escape().withMessage('Region required'),
  body('processBy').optional().isLength({max:100}).escape(),
];

// Error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

module.exports = {
  sanitizeInput,
  validateMooeData,
  validateFileUpload,
  handleValidationErrors
};
```

#### 2.2 File Upload Security
**Secure multer configuration:**

```javascript
// SERVER/middleware/secureUpload.js
const multer = require('multer');
const path = require('path');

const fileFilter = (req, file, cb) => {
  // Allow only specific file types
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only Excel and CSV files allowed.'), false);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only one file at a time
  },
  fileFilter: fileFilter
});

// Error handler for multer
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Only one file allowed.' });
    }
  }
  if (error.message === 'Invalid file type. Only Excel and CSV files allowed.') {
    return res.status(400).json({ error: error.message });
  }
  next(error);
};

module.exports = { upload, handleUploadError };
```

#### 2.3 Rate Limiting & DDoS Protection
**Implement rate limiting:**

```bash
npm install express-rate-limit helmet express-slow-down
```

```javascript
// SERVER/middleware/security.js
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');

// General rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true,
});

// File upload rate limiting
const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // Limit each IP to 3 uploads per 5 minutes
  message: 'Too many uploads, please try again later.',
});

// Speed limiting for heavy operations
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 10, // Allow 10 requests per 15 minutes at full speed
  delayMs: 500 // Add 500ms delay per request after delayAfter
});

// Security headers
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false // Adjust based on your needs
});

module.exports = {
  generalLimiter,
  authLimiter, 
  uploadLimiter,
  speedLimiter,
  securityHeaders
};
```

#### 2.4 Secure CORS Configuration
**Update CORS settings:**

```javascript
// SERVER/index.js - Update CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.CLIENT1,
      process.env.CLIENT2, 
      process.env.CLIENT3,
      // Add your specific domains
      'https://your-frontend-domain.com',
      'https://your-admin-domain.com'
    ].filter(Boolean); // Remove undefined values
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS policy'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));
```

### Phase 3: Database Security (1 week)

#### 3.1 MongoDB Security
**Secure database queries:**

```javascript
// SERVER/utils/dbSecurity.js
const mongoose = require('mongoose');

// Prevent NoSQL injection
const sanitizeQuery = (query) => {
  if (typeof query !== 'object' || query === null) {
    return query;
  }
  
  const sanitized = {};
  for (const key in query) {
    if (query.hasOwnProperty(key)) {
      // Remove dangerous operators
      if (key.startsWith('$') || key.includes('.')) {
        continue;
      }
      
      if (typeof query[key] === 'object') {
        sanitized[key] = sanitizeQuery(query[key]);
      } else if (typeof query[key] === 'string') {
        // Escape special regex characters
        sanitized[key] = query[key].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      } else {
        sanitized[key] = query[key];
      }
    }
  }
  return sanitized;
};

// Safe regex search
const createSafeRegexQuery = (searchTerm, field) => {
  if (!searchTerm || typeof searchTerm !== 'string') {
    return {};
  }
  
  const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    [field]: {
      $regex: new RegExp(escapedTerm, 'i'),
      $options: 'i'
    }
  };
};

module.exports = { sanitizeQuery, createSafeRegexQuery };
```

#### 3.2 Implement Database Connection Security
```javascript
// SERVER/config/mongo_db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.DATABASE_URL, {
      // Security options
      authSource: 'admin',
      ssl: process.env.NODE_ENV === 'production',
      sslValidate: process.env.NODE_ENV === 'production',
      
      // Connection options
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferMaxEntries: 0,
      bufferCommands: false,
    });

    // Log connection (without sensitive info)
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Set up error handlers
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
    });

  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
```

### Phase 4: Advanced Security (2 weeks)

#### 4.1 Audit Logging System
```javascript
// SERVER/middleware/auditLogger.js
const AuditLog = require('../models/AuditLog');

const auditLogger = (action, resource) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log the action
      const logEntry = {
        userId: req.user?.id,
        userName: req.user?.name,
        action: action,
        resource: resource,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        timestamp: new Date(),
        requestBody: action !== 'READ' ? req.body : undefined,
        statusCode: res.statusCode,
        success: res.statusCode < 400
      };
      
      // Save audit log (don't wait for it)
      AuditLog.create(logEntry).catch(err => {
        console.error('Audit log failed:', err);
      });
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

module.exports = auditLogger;
```

#### 4.2 Session Management
```javascript
// SERVER/middleware/sessionSecurity.js
const session = require('express-session');
const MongoStore = require('connect-mongo');

const sessionConfig = {
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET_KEY,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.DATABASE_URL,
    touchAfter: 24 * 3600 // Lazy session update
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent XSS
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    sameSite: 'strict' // CSRF protection
  },
  name: 'fmis.sid' // Don't use default session name
};

module.exports = session(sessionConfig);
```

#### 4.3 API Security Headers
```javascript
// SERVER/middleware/apiSecurity.js
const helmet = require('helmet');

const apiSecurityHeaders = helmet({
  // Set various HTTP headers
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  
  // Remove X-Powered-By header
  hidePoweredBy: true,
  
  // Set HSTS header
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  
  // Prevent MIME type sniffing
  noSniff: true,
  
  // Set X-Frame-Options
  frameguard: { action: 'deny' },
  
  // Set X-XSS-Protection
  xssFilter: true,
  
  // Set Referrer Policy
  referrerPolicy: { policy: 'same-origin' }
});

module.exports = apiSecurityHeaders;
```

## 🔧 Implementation Steps

### Step 1: Update Dependencies (Immediate)
```bash
# SERVER
cd SERVER
npm audit fix
npm install helmet express-rate-limit express-slow-down express-validator --save
npm install express-session connect-mongo --save

# CLIENT  
cd CLIENT
npm audit fix
npm update axios
```

### Step 2: Apply Security Middleware (Day 1)
```javascript
// SERVER/index.js - Add security middleware
const { generalLimiter, securityHeaders } = require('./middleware/security');
const { sanitizeInput } = require('./middleware/validation');

app.use(securityHeaders);
app.use(generalLimiter);
app.use(sanitizeInput);
```

### Step 3: Secure File Uploads (Day 2)
Update all upload routes to use secure upload middleware:
```javascript
const { upload, handleUploadError } = require('./middleware/secureUpload');
const { validateFileUpload, handleValidationErrors } = require('./middleware/validation');

router.post("/upload", 
  upload.single("file"), 
  handleUploadError,
  validateFileUpload,
  handleValidationErrors,
  controllerFunction
);
```

### Step 4: Environment Configuration (Day 3)
1. Create `.env` files with secure configurations
2. Remove hardcoded secrets from code
3. Set up proper JWT secret rotation
4. Configure database authentication

### Step 5: Testing & Validation (Week 2)
1. Security penetration testing
2. Vulnerability scanning
3. Code review for injection flaws
4. Authentication bypass testing

## 📋 Security Checklist

### ✅ Authentication & Authorization
- [ ] Remove authentication bypass in development
- [ ] Implement proper JWT validation
- [ ] Add role-based access control validation
- [ ] Set up session management
- [ ] Implement password policies (if applicable)

### ✅ Input Validation & Sanitization
- [ ] Add input validation for all endpoints
- [ ] Implement NoSQL injection prevention
- [ ] Sanitize user inputs
- [ ] Validate file uploads
- [ ] Escape output data

### ✅ Data Protection
- [ ] Encrypt sensitive data at rest
- [ ] Use HTTPS for data in transit
- [ ] Implement secure backup procedures
- [ ] Set up proper database permissions
- [ ] Regular security audits

### ✅ Infrastructure Security
- [ ] Update all dependencies
- [ ] Configure secure CORS policies
- [ ] Implement rate limiting
- [ ] Set up security headers
- [ ] Monitor and log security events

### ✅ File Upload Security
- [ ] Validate file types and sizes
- [ ] Scan uploaded files for malware
- [ ] Implement upload rate limiting
- [ ] Store files securely
- [ ] Validate file content

## 🚨 Critical Action Items

### Immediate (24 hours)
1. **Fix authentication bypass** - Replace mock authentication
2. **Update critical dependencies** - Fix mongoose, form-data, axios vulnerabilities  
3. **Implement input validation** - Prevent injection attacks
4. **Add rate limiting** - Prevent DoS attacks

### Short-term (1 week)
1. **Secure file uploads** - Implement proper validation and limits
2. **Add security headers** - Use helmet for basic protection
3. **Implement audit logging** - Track all security-relevant actions
4. **Set up monitoring** - Alert on suspicious activities

### Long-term (1 month)
1. **Security testing** - Penetration testing and vulnerability assessment
2. **Compliance review** - Ensure regulatory compliance
3. **Security training** - Team education on secure coding practices
4. **Incident response plan** - Prepare for security incidents

## 📞 Next Steps

1. **Prioritize critical fixes** - Start with authentication and dependency updates
2. **Create security baseline** - Document current security posture
3. **Implement monitoring** - Set up security event logging
4. **Regular audits** - Schedule periodic security reviews

---

**⚠️ Important:** This is a high-priority security issue. The authentication bypass alone could allow unauthorized access to sensitive budget data. Implement the critical fixes immediately.
