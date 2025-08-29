# FMIS Budget Management System

A comprehensive Financial Management Information System (FMIS) for budget planning, personnel management, and financial reporting. This full-stack application provides a modern, user-friendly interface for managing government budget allocations, personnel services, and various allowances.

## 🚀 Features

### Core Budget Management
- **Personnel Services Management** - Comprehensive employee and salary management
- **MOOE (Maintenance and Other Operating Expenses)** - Operating expense tracking
- **Capital Outlay Management** - Infrastructure and equipment budget planning
- **Budgetary Support** - Financial support allocation and tracking

### Personnel & Payroll
- **Employee Management** - Complete employee database with position titles
- **Salary Administration** - Salary grades and compensation management
- **Allowances Management**:
  - Subsistence Allowance (MDS & ST)
  - Meal Allowance
  - Medical Allowance
  - Children Allowance
  - Loyalty Pay
- **Overtime Pay Management** - Overtime calculation and tracking
- **Court Appearance Tracking** - Legal appearance compensation
- **Retiree Management** - Retirement benefit administration

### Financial Operations
- **Income Management** - Revenue tracking with categories and subcategories
- **Proposal System** - Budget proposal creation and approval workflow
- **Fiscal Year Management** - Multi-year budget planning
- **Regional Management** - Multi-region budget allocation
- **RATA Management** - Representation and Transportation Allowance

### Reporting & Analytics
- **Comprehensive Reports** - Financial and personnel reports
- **Proposal Summaries** - Budget proposal analytics
- **Export Functionality** - CSV and Excel export capabilities
- **Dashboard Analytics** - Real-time budget monitoring

### Advanced Features
- **Role-Based Access Control (RBAC)** - Secure user permissions
- **Auto-save Functionality** - Prevent data loss
- **Excel Import/Export** - Bulk data operations
- **Chart of Accounts** - Standardized accounting structure
- **Title Mapping** - Position title standardization

## 🛠 Tech Stack

### Frontend
- **React 18** - Modern React with hooks
- **Vite** - Fast build tool and development server
- **Material-UI (MUI)** - Modern component library
- **React Router** - Client-side routing
- **React Query** - Server state management
- **React Hook Form** - Form handling with validation
- **Framer Motion** - Smooth animations
- **Styled Components** - CSS-in-JS styling

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling
- **JWT** - Authentication and authorization
- **Multer** - File upload handling
- **CORS** - Cross-origin resource sharing

### Development Tools
- **ESLint** - Code linting
- **Nodemon** - Development server auto-restart
- **dotenv** - Environment variable management

## 📁 Project Structure

```
FMIS-BUDGET-JUNE/
├── CLIENT/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Application pages
│   │   ├── context/       # React context providers
│   │   ├── utils/         # Utility functions
│   │   ├── config/        # Configuration files
│   │   └── tests/         # Frontend tests
│   ├── public/            # Static assets
│   └── package.json       # Frontend dependencies
├── SERVER/                # Node.js backend application
│   ├── controllers/       # Request handlers
│   ├── models/           # Database models
│   ├── routers/          # API route definitions
│   ├── middleware/       # Custom middleware
│   ├── config/           # Database configuration
│   ├── utils/            # Backend utilities
│   └── package.json      # Backend dependencies
└── Documentation/        # Project documentation
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn package manager

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/reymund27/FMIS-BUDGET-JUNE.git
cd FMIS-BUDGET-JUNE
```

2. **Setup Backend**
```bash
cd SERVER
npm install
```

3. **Setup Frontend**
```bash
cd ../CLIENT
npm install
```

4. **Environment Configuration**
Create `.env` file in the SERVER directory:
```env
MONGODB_URL=mongodb://localhost:27017/fmis_budget
APP_PORT=5000
JWT_SECRET=your_jwt_secret_key
CLIENT1=http://localhost:3000
CLIENT2=http://localhost:5173
CLIENT3=http://localhost:4173
```

### Running the Application

1. **Start MongoDB** (if running locally)
```bash
mongod
```

2. **Start Backend Server**
```bash
cd SERVER
npm start
```

3. **Start Frontend Development Server**
```bash
cd CLIENT
npm start
```

The application will be available at:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`

## 🔧 API Endpoints

### Core Modules
- `/api/personnel` - Personnel management
- `/api/mooe` - MOOE budget operations
- `/api/capital-outlay` - Capital outlay management
- `/api/proposals` - Budget proposals
- `/api/fiscal-year` - Fiscal year operations
- `/api/categories` - Budget categories
- `/api/departments` - Department management
- `/api/regions` - Regional operations

### Allowances & Benefits
- `/api/subsistence-allowance` - Subsistence allowances
- `/api/meal-allowance` - Meal allowances
- `/api/medical-allowance` - Medical allowances
- `/api/loyalty-pay` - Loyalty pay management
- `/api/overtime` - Overtime calculations
- `/api/court-appearance` - Court appearance tracking

### Administrative
- `/api/users` - User management
- `/api/settings` - System settings
- `/api/reports` - Report generation
- `/api/upload` - File upload operations

## 🎨 Recent Enhancements

### UI/UX Improvements
- Modern gradient designs and animations
- Enhanced table interfaces with auto-save functionality
- Improved form handling and validation
- Mobile-responsive design patterns
- Compact view options for better space utilization

### Functionality Enhancements
- Advanced chart of accounts management
- Enhanced capital outlay title mapping
- Improved compensation settings
- Enhanced income category management
- Streamlined court appearance access

### Performance Optimizations
- Optimized database queries
- Improved caching strategies
- Enhanced error handling
- Better loading states and user feedback

## 🧪 Testing

Run frontend tests:
```bash
cd CLIENT
npm test
```

Run backend tests:
```bash
cd SERVER
npm test
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is proprietary software developed for government financial management.

## 👨‍💻 Author

**Reymund Edra**
- GitHub: [@reymund27](https://github.com/reymund27)
- Email: reymundedra@gmail.com

## 🆘 Support

For support and questions, please contact the development team or create an issue in the repository.

---

*Built with ❤️ for efficient government budget management*