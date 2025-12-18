#!/bin/bash

# 🔒 FMIS Budget System Security Implementation Script
# This script helps implement the security measures identified in the security assessment

echo "🚀 FMIS Budget System Security Implementation"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the SERVER directory"
    exit 1
fi

echo ""
print_info "Phase 1: Critical Security Fixes"
echo "================================="

# 1. Update package.json with security dependencies
print_info "1. Adding security dependencies..."

# Check if helmet is installed
if npm list helmet > /dev/null 2>&1; then
    print_status "helmet already installed"
else
    npm install helmet --save
fi

# Check if express-rate-limit is installed
if npm list express-rate-limit > /dev/null 2>&1; then
    print_status "express-rate-limit already installed"
else
    npm install express-rate-limit --save
fi

# Check if express-validator is installed
if npm list express-validator > /dev/null 2>&1; then
    print_status "express-validator already installed"
else
    npm install express-validator --save
fi

# Check if csurf is installed
if npm list csurf > /dev/null 2>&1; then
    print_status "csurf already installed"
else
    npm install csurf --save
fi

print_info "2. Checking environment configuration..."

# Check if .env.example exists
if [ -f ".env.example" ]; then
    print_status ".env.example file exists"
else
    print_warning ".env.example file not found"
fi

# Check if .env exists
if [ -f ".env" ]; then
    print_warning ".env file exists - ensure it contains secure configurations"
    
    # Check for critical environment variables
    if grep -q "JWT_SECRET_KEY" .env; then
        print_status "JWT_SECRET_KEY found in .env"
    else
        print_error "JWT_SECRET_KEY not found in .env - THIS IS CRITICAL!"
    fi
    
    if grep -q "ACCOUNT_USER_API_URL" .env; then
        print_status "ACCOUNT_USER_API_URL found in .env"
    else
        print_warning "ACCOUNT_USER_API_URL not found in .env"
    fi
    
else
    print_warning ".env file not found - copy from .env.example and configure"
fi

print_info "3. Checking middleware files..."

# Check if security middleware exists
if [ -f "middleware/security.js" ]; then
    print_status "Security middleware exists"
else
    print_error "Security middleware not found"
fi

# Check if validation middleware exists
if [ -f "middleware/validation.js" ]; then
    print_status "Validation middleware exists"
else
    print_error "Validation middleware not found"
fi

# Check if secure upload middleware exists
if [ -f "middleware/secureUpload.js" ]; then
    print_status "Secure upload middleware exists"
else
    print_error "Secure upload middleware not found"
fi

echo ""
print_info "Phase 2: Dependency Security"
echo "============================="

print_info "4. Checking for vulnerable dependencies..."

# Run npm audit and capture output
audit_output=$(npm audit --audit-level moderate 2>&1)
audit_exit_code=$?

if [ $audit_exit_code -eq 0 ]; then
    print_status "No moderate or higher vulnerabilities found"
else
    print_warning "Vulnerabilities detected. Running fixes..."
    
    # Try to fix automatically
    npm audit fix 2>/dev/null
    
    # Check again
    audit_output_after=$(npm audit --audit-level moderate 2>&1)
    if echo "$audit_output_after" | grep -q "vulnerabilities"; then
        print_warning "Some vulnerabilities remain. Manual review required."
        echo "Run 'npm audit' for details"
    else
        print_status "Vulnerabilities fixed"
    fi
fi

print_info "5. Checking specific vulnerable packages..."

# Check for specific vulnerable packages
vulnerable_packages=("html-pdf" "xlsx" "form-data" "tough-cookie")

for package in "${vulnerable_packages[@]}"; do
    if npm list "$package" > /dev/null 2>&1; then
        version=$(npm list "$package" --depth=0 2>/dev/null | grep "$package" | sed 's/.*@//')
        print_warning "$package@$version is installed (potential security risk)"
    fi
done

echo ""
print_info "Phase 3: Security Configuration Validation"
echo "==========================================="

print_info "6. Checking authentication configuration..."

# Check checkToken.js for security issues
if [ -f "middleware/checkToken.js" ]; then
    if grep -q "SUPER ADMIN" middleware/checkToken.js; then
        print_warning "Default admin role found in checkToken.js - ensure this is intentional"
    else
        print_status "No default admin roles found"
    fi
    
    if grep -q "ALLOW_MOCK_AUTH" middleware/checkToken.js; then
        print_status "Mock auth properly configured with environment flag"
    else
        print_warning "Mock auth configuration needs review"
    fi
else
    print_error "checkToken.js middleware not found"
fi

print_info "7. Checking CORS configuration..."

# Check index.js for CORS settings
if [ -f "index.js" ]; then
    if grep -q "corsOptions" index.js; then
        print_status "Custom CORS configuration found"
    else
        print_warning "Default CORS configuration - should be customized"
    fi
else
    print_error "index.js not found"
fi

echo ""
print_info "Phase 4: File Upload Security"
echo "=============================="

print_info "8. Checking upload routes..."

# Find all files that use multer
upload_files=$(find . -name "*.js" -exec grep -l "multer\|upload" {} \; 2>/dev/null)

if [ -n "$upload_files" ]; then
    print_info "Found upload-related files:"
    echo "$upload_files" | while read -r file; do
        echo "  - $file"
        
        # Check for secure upload usage
        if grep -q "secureUpload" "$file"; then
            print_status "  ✅ Uses secure upload middleware"
        else
            print_warning "  ⚠️  May need secure upload middleware"
        fi
    done
else
    print_info "No upload-related files found"
fi

echo ""
print_info "Phase 5: Database Security"
echo "=========================="

print_info "9. Checking database connection security..."

# Check for database configuration
if [ -f "config/mongo_db.js" ]; then
    if grep -q "ssl:" config/mongo_db.js; then
        print_status "SSL configuration found in database connection"
    else
        print_warning "No SSL configuration found for database"
    fi
else
    print_warning "Database configuration file not found"
fi

print_info "10. Checking for NoSQL injection vulnerabilities..."

# Look for potentially unsafe MongoDB queries
unsafe_patterns=('$where' '\$regex.*req\.' 'new RegExp.*req\.')

for pattern in "${unsafe_patterns[@]}"; do
    if grep -r "$pattern" . --include="*.js" > /dev/null 2>&1; then
        print_warning "Potentially unsafe MongoDB query pattern found: $pattern"
    fi
done

echo ""
print_info "Security Implementation Summary"
echo "==============================="

# Generate summary
echo ""
print_info "🔒 Critical Actions Required:"
echo "1. Review and configure .env file with secure values"
echo "2. Set ACCOUNT_USER_API_URL for production authentication"
echo "3. Generate strong JWT_SECRET_KEY (minimum 256 bits)"
echo "4. Update vulnerable dependencies (especially xlsx, html-pdf)"
echo "5. Apply security middleware to all routes"
echo "6. Test authentication and authorization"
echo "7. Configure HTTPS for production"
echo "8. Set up monitoring and logging"

echo ""
print_info "📋 Next Steps:"
echo "1. Copy .env.example to .env and configure"
echo "2. Replace vulnerable packages where possible"
echo "3. Apply rate limiting to upload endpoints"
echo "4. Implement input validation on all routes"
echo "5. Set up security monitoring"
echo "6. Conduct security testing"

echo ""
print_status "Security implementation script completed!"
print_info "Review the output above and address any issues marked with ⚠️ or ❌"

exit 0
