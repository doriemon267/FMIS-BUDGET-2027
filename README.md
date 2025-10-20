# FMIS Budget Management System

A comprehensive Financial Management Information System for budget proposals and tracking.

## 📁 Project Structure

```
FMIS-BUDGET-SEPTEMBER/
├── CLIENT/                    # React frontend application
│   ├── src/                  # Source code
│   ├── public/               # Static assets
│   └── package.json          # Frontend dependencies
│
├── SERVER/                    # Node.js backend application
│   ├── controllers/          # Route controllers
│   ├── models/              # Database models
│   ├── routes/              # API routes
│   ├── middleware/          # Custom middleware
│   └── package.json         # Backend dependencies
│
├── DOCUMENTATION/            # All project documentation
│   ├── README.md            # Main project documentation
│   ├── *.md                 # Feature-specific documentation
│   └── guides/              # Implementation guides
│
├── SCRIPTS/                 # Utility and maintenance scripts
│   ├── cleanup_*.js         # Code cleanup utilities
│   ├── fix_*.js            # Database fix scripts
│   └── test_*.js           # Testing scripts
│
├── ASSETS/                  # Project assets
│   ├── screenshots/         # Application screenshots
│   └── images/             # Other image assets
│
└── TEMP_FILES/             # Temporary and test files
    ├── test_data*.json     # Test data files
    └── misc files          # Other temporary files
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- MongoDB
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/doriemon267/FMIS-BUDGET-SEPTEMBER.git
   cd FMIS-BUDGET-SEPTEMBER
   ```

2. **Setup Backend**
   ```bash
   cd SERVER
   npm install
   cp .env.example .env
   # Configure your environment variables in .env
   npm start
   ```

3. **Setup Frontend**
   ```bash
   cd CLIENT
   npm install
   npm start
   ```

## 🎯 Recent Major Updates

### ✅ PDF Export System Enhancement
- Professional table formatting with borders and colors
- Fixed empty table content issues
- Enhanced currency formatting (removed +/- signs)
- Server-side data fetching to prevent payload issues
- Comprehensive debugging and error handling

### ✅ UI/UX Improvements  
- Mobile-responsive design
- Bulk action capabilities
- Enhanced export functionality
- Improved user experience across all modules

### ✅ Security Implementation
- Role-based access control (RBAC)
- JWT authentication
- Route protection
- User authorization middleware

## 📋 Key Features

- **Budget Proposal Management**: Create, edit, and track budget proposals
- **Personnel Services**: Manage employee compensation and benefits
- **MOOE Management**: Maintenance and Other Operating Expenses tracking
- **Capital Outlay**: Capital expenditure planning and monitoring
- **Income Tracking**: Revenue and income category management
- **Professional Reports**: PDF and Excel export with professional formatting
- **Multi-region Support**: Regional budget segregation
- **Real-time Updates**: Live data synchronization
- **Backup System**: Automated database backup functionality

## 🛠️ Technology Stack

**Frontend:**
- React 18+
- Material-UI (MUI)
- JavaScript/JSX
- CSS3

**Backend:**
- Node.js
- Express.js
- MongoDB with Mongoose
- JWT Authentication
- PDFKit for PDF generation
- ExcelJS for Excel exports

## 📖 Documentation

All detailed documentation is available in the `DOCUMENTATION/` folder:

- **Implementation Guides**: Step-by-step setup instructions
- **Feature Documentation**: Detailed feature explanations
- **API Documentation**: Backend API references
- **Troubleshooting Guides**: Common issues and solutions
- **Security Documentation**: Security implementation details

Additional docs in repo root:

- `PROPOSAL_TOTALS_AUTO_RECALC.md`: End-to-end guide for automatic Proposal totals recalculation, admin endpoint, and maintenance script.

Maintenance script:

- Recalculate all proposals totals
   - Script: `SERVER/scripts/recalculate-all-proposals.js`
   - NPM script: `recalc:proposals`
   - Run (PowerShell):
      ```powershell
      npm run recalc:proposals
      ```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For technical support or questions, please refer to the documentation in the `DOCUMENTATION/` folder or create an issue in the repository.

---

**Last Updated**: October 20, 2025
**Version**: 2.1.0
**Status**: Production Ready
