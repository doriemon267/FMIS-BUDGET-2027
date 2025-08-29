# 🔒 FMIS Budget System Security Implementation Script (PowerShell)
# This script helps implement the security measures identified in the security assessment

Write-Host "🚀 FMIS Budget System Security Implementation" -ForegroundColor Green
Write-Host "==============================================`n" -ForegroundColor Green

function Write-Success {
    param($Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param($Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error {
    param($Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Info {
    param($Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Blue
}

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Error "Please run this script from the SERVER directory"
    exit 1
}

Write-Info "Phase 1: Critical Security Fixes"
Write-Host "================================="

# 1. Check and install security dependencies
Write-Info "1. Checking security dependencies..."

$requiredPackages = @("helmet", "express-rate-limit", "express-validator", "express-slow-down")

foreach ($package in $requiredPackages) {
    $installed = npm list $package 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "$package already installed"
    } else {
        Write-Info "Installing $package..."
        npm install $package --save
        if ($LASTEXITCODE -eq 0) {
            Write-Success "$package installed successfully"
        } else {
            Write-Error "Failed to install $package"
        }
    }
}

Write-Info "2. Checking environment configuration..."

# Check if .env.example exists
if (Test-Path ".env.example") {
    Write-Success ".env.example file exists"
} else {
    Write-Warning ".env.example file not found"
}

# Check if .env exists
if (Test-Path ".env") {
    Write-Warning ".env file exists - ensure it contains secure configurations"
    
    $envContent = Get-Content ".env" -Raw
    
    # Check for critical environment variables
    if ($envContent -match "JWT_SECRET_KEY") {
        Write-Success "JWT_SECRET_KEY found in .env"
    } else {
        Write-Error "JWT_SECRET_KEY not found in .env - THIS IS CRITICAL!"
    }
    
    if ($envContent -match "ACCOUNT_USER_API_URL") {
        Write-Success "ACCOUNT_USER_API_URL found in .env"
    } else {
        Write-Warning "ACCOUNT_USER_API_URL not found in .env"
    }
    
    if ($envContent -match "NODE_ENV=production") {
        Write-Success "NODE_ENV set to production"
    } else {
        Write-Warning "NODE_ENV not set to production"
    }
} else {
    Write-Warning ".env file not found - copy from .env.example and configure"
}

Write-Info "3. Checking middleware files..."

# Check if security middleware exists
$middlewareFiles = @(
    @{Name = "Security middleware"; Path = "middleware/security.js"},
    @{Name = "Validation middleware"; Path = "middleware/validation.js"},
    @{Name = "Secure upload middleware"; Path = "middleware/secureUpload.js"}
)

foreach ($middleware in $middlewareFiles) {
    if (Test-Path $middleware.Path) {
        Write-Success "$($middleware.Name) exists"
    } else {
        Write-Error "$($middleware.Name) not found at $($middleware.Path)"
    }
}

Write-Host "`nPhase 2: Dependency Security" -ForegroundColor Blue
Write-Host "============================="

Write-Info "4. Checking for vulnerable dependencies..."

# Run npm audit
$auditResult = npm audit --audit-level moderate 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Success "No moderate or higher vulnerabilities found"
} else {
    Write-Warning "Vulnerabilities detected. Here's the summary:"
    
    # Extract vulnerability count
    $vulnerabilityLine = $auditResult | Where-Object { $_ -match "vulnerabilities" } | Select-Object -Last 1
    if ($vulnerabilityLine) {
        Write-Host "  $vulnerabilityLine" -ForegroundColor Yellow
    }
    
    Write-Info "Attempting automatic fixes..."
    npm audit fix 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Some vulnerabilities were fixed automatically"
    } else {
        Write-Warning "Automatic fix completed with warnings. Manual review may be required."
    }
}

Write-Info "5. Checking specific vulnerable packages..."

$vulnerablePackages = @("html-pdf", "xlsx", "form-data", "tough-cookie", "mongoose")

foreach ($package in $vulnerablePackages) {
    $packageInfo = npm list $package --depth=0 2>$null
    if ($LASTEXITCODE -eq 0) {
        $version = ($packageInfo | Select-String "@").ToString().Split("@")[-1]
        Write-Warning "$package@$version is installed (potential security risk)"
    }
}

Write-Host "`nPhase 3: Security Configuration Validation" -ForegroundColor Blue
Write-Host "==========================================="

Write-Info "6. Checking authentication configuration..."

# Check checkToken.js for security issues
if (Test-Path "middleware/checkToken.js") {
    $tokenContent = Get-Content "middleware/checkToken.js" -Raw
    
    if ($tokenContent -match "BUDGET ADMIN.*test|mock") {
        Write-Error "Hardcoded admin role found in checkToken.js - SECURITY RISK!"
    } else {
        Write-Success "No obvious hardcoded admin roles found"
    }
    
    if ($tokenContent -match "ALLOW_MOCK_AUTH") {
        Write-Success "Mock auth properly configured with environment flag"
    } else {
        Write-Warning "Mock auth configuration needs review"
    }
} else {
    Write-Error "checkToken.js middleware not found"
}

Write-Info "7. Checking CORS configuration..."

# Check index.js for CORS settings
if (Test-Path "index.js") {
    $indexContent = Get-Content "index.js" -Raw
    
    if ($indexContent -match "corsOptions|cors\(") {
        Write-Success "CORS configuration found"
        
        if ($indexContent -match "origin.*function") {
            Write-Success "Custom CORS origin validation implemented"
        } else {
            Write-Warning "CORS may not have proper origin validation"
        }
    } else {
        Write-Warning "CORS configuration not found or needs review"
    }
} else {
    Write-Error "index.js not found"
}

Write-Host "`nPhase 4: File Upload Security" -ForegroundColor Blue
Write-Host "=============================="

Write-Info "8. Checking upload routes..."

# Find all files that use multer or upload
$uploadFiles = Get-ChildItem -Recurse -Include "*.js" | Select-String -Pattern "multer|upload\.single|upload\.array" | Select-Object -ExpandProperty Filename -Unique

if ($uploadFiles) {
    Write-Info "Found upload-related files:"
    foreach ($file in $uploadFiles) {
        Write-Host "  - $file"
        
        $fileContent = Get-Content $file -Raw
        if ($fileContent -match "secureUpload|handleUploadError") {
            Write-Success "  ✅ Uses secure upload middleware"
        } else {
            Write-Warning "  ⚠️  May need secure upload middleware"
        }
    }
} else {
    Write-Info "No upload-related files found"
}

Write-Host "`nPhase 5: Database Security" -ForegroundColor Blue
Write-Host "=========================="

Write-Info "9. Checking database connection security..."

# Check for database configuration
if (Test-Path "config/mongo_db.js") {
    $dbContent = Get-Content "config/mongo_db.js" -Raw
    
    if ($dbContent -match "ssl:|sslValidate:") {
        Write-Success "SSL configuration found in database connection"
    } else {
        Write-Warning "No SSL configuration found for database"
    }
    
    if ($dbContent -match "authSource:") {
        Write-Success "Authentication source configured"
    } else {
        Write-Warning "Database authentication source not configured"
    }
} else {
    Write-Warning "Database configuration file not found"
}

Write-Info "10. Checking for NoSQL injection vulnerabilities..."

# Look for potentially unsafe MongoDB queries
$unsafePatterns = @('$where', '\$regex.*req\.', 'new RegExp.*req\.')

foreach ($pattern in $unsafePatterns) {
    $matches = Get-ChildItem -Recurse -Include "*.js" | Select-String -Pattern $pattern
    if ($matches) {
        Write-Warning "Potentially unsafe MongoDB query pattern found: $pattern"
        foreach ($match in $matches) {
            Write-Host "  - $($match.Filename):$($match.LineNumber)" -ForegroundColor Gray
        }
    }
}

Write-Host "`nSecurity Implementation Summary" -ForegroundColor Green
Write-Host "==============================="

Write-Host "`n🔒 Critical Actions Required:" -ForegroundColor Red
Write-Host "1. Review and configure .env file with secure values"
Write-Host "2. Set ACCOUNT_USER_API_URL for production authentication"
Write-Host "3. Generate strong JWT_SECRET_KEY (minimum 256 bits)"
Write-Host "4. Update vulnerable dependencies (especially xlsx, html-pdf)"
Write-Host "5. Apply security middleware to all routes"
Write-Host "6. Test authentication and authorization"
Write-Host "7. Configure HTTPS for production"
Write-Host "8. Set up monitoring and logging"

Write-Host "`n📋 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Copy .env.example to .env and configure"
Write-Host "2. Replace vulnerable packages where possible"
Write-Host "3. Apply rate limiting to upload endpoints"
Write-Host "4. Implement input validation on all routes"
Write-Host "5. Set up security monitoring"
Write-Host "6. Conduct security testing"

Write-Host "`n🔧 Quick Fixes You Can Run Now:" -ForegroundColor Cyan
Write-Host "1. npm update mongoose (to fix critical vulnerabilities)"
Write-Host "2. npm uninstall html-pdf (if PDF generation is not needed)"
Write-Host "3. Copy .env.example to .env: Copy-Item .env.example .env"
Write-Host "4. Generate JWT secret: openssl rand -base64 64"

Write-Success "`nSecurity implementation script completed!"
Write-Info "Review the output above and address any issues marked with ⚠️ or ❌"

# Check if OpenSSL is available for key generation
try {
    $opensslVersion = openssl version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n🔑 Generate a secure JWT key with:" -ForegroundColor Green
        Write-Host "openssl rand -base64 64" -ForegroundColor White
    }
} catch {
    Write-Host "`n🔑 To generate a secure JWT key, install OpenSSL or use an online generator" -ForegroundColor Yellow
}
