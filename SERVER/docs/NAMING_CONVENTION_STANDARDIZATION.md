# 🔧 Naming Convention Standardization

## Overview
This document outlines the comprehensive plan to standardize naming conventions across the entire BUDGET-FMIS codebase for better organization, maintainability, and developer experience.

## 🎯 Standardization Goals

### Current Issues
- ❌ Mixed case in file names (`ps_annexes_controller.js` vs `BudgetManagerOrgController.js`)
- ❌ Inconsistent router names (`rataRoutes.js` vs `RATARoutes.js`)
- ❌ Mixed model naming (`chartOfAccounts.js` vs `PersonnelServices.js`)
- ❌ Inconsistent variable naming (`ps_annexes` vs `budgetManagerOrgRouter`)
- ❌ Mixed function names (`getAllPS_Annexes` vs `getAllRATAs`)

### Target Standards
- ✅ **Controllers**: `camelCase` + `Controller.js`
- ✅ **Models**: `PascalCase` + `.js`
- ✅ **Routes**: `camelCase` + `Routes.js`
- ✅ **Components**: `PascalCase` + `.jsx`
- ✅ **Variables**: `camelCase`
- ✅ **Functions**: `camelCase`
- ✅ **Constants**: `UPPER_SNAKE_CASE`

## 📋 Implementation Plan

### Phase 1: Core Models ✅ COMPLETED
- [x] `models/chartOfAccounts.js` → Standardized schema and model names
- [x] `models/mooeProposals.js` → Standardized to `MooeProposal`
- [x] `models/childrenAllowance.js` → Already properly standardized
- [x] `models/mealAllowance.js` → Already properly standardized

### Phase 2: Controllers ✅ COMPLETED (Content Updates)
- [x] `controllers/mooeController.js` → Updated MOOEProposal → MooeProposal (10 occurrences)
- [x] `controllers/proposalController.js` → Updated model references
- [x] `controllers/budgetManagerOrgController.js` → Updated model references
- [x] `controllers/ps_annexes_controller.js` → Updated function names and variables
- [ ] File renaming still needed for some controllers

### Phase 3: Routes ✅ COMPLETED (Content Updates)
- [x] `routers/budgetManagerOrgRoutes.js` → Updated model references
- [x] Route variable names updated in affected files
- [ ] File renaming still needed for some route files

### Phase 4: Middleware & Utils ✅ ANALYZED
- [x] `middleware/check_token.js` → Already properly structured
- [ ] File renaming needed: `check_token.js` → `checkToken.js`
- [ ] `utils/controller_get_process.js` → `utils/controllerGetProcess.js`
- [ ] `utils/date-related.js` → `utils/dateRelated.js`

### Phase 5: Index.js Updates ✅ COMPLETED
- [x] Router variable names standardized
- [x] Import statements updated for consistency

### Phase 5: Client-Side Components
- [ ] Update component folder names
- [ ] Standardize component file names
- [ ] Update import statements

## 🔄 Changes Made

### ✅ Models Updated

#### ChartOfAccounts Model
```javascript
// Before
const chartofAccountSchema = new mongoose.Schema(...)
module.exports = mongoose.model("chart_of_account", chartofAccountSchema);

// After  
const chartOfAccountsSchema = new mongoose.Schema(...)
module.exports = mongoose.model("ChartOfAccounts", chartOfAccountsSchema);
```

#### MooeProposal Model
```javascript
// Before
const MOOEProposalSchema = new Schema(...)
module.exports = mongoose.model('MOOEProposal', MOOEProposalSchema);

// After
const mooeProposalSchema = new Schema(...)
module.exports = mongoose.model('MooeProposal', mooeProposalSchema);
```

## 📊 File Mapping Reference

### Controllers
| Current | Standardized |
|---------|-------------|
| `BudgetManagerOrgController.js` | `budgetManagerOrgController.js` |
| `RATAController.js` | `rataController.js` |
| `COSPersonnelController.js` | `cosPersonnelController.js` |
| `ps_annexes_controller.js` | `personnelServicesAnnexesController.js` |

### Models
| Current | Standardized |
|---------|-------------|
| `chartOfAccounts.js` | ✅ `ChartOfAccounts.js` (schema updated) |
| `mooeProposals.js` | ✅ `MooeProposals.js` (model updated) |
| `childrenAllowance.js` | `ChildrenAllowance.js` |
| `employeeCourtAppearance.js` | `EmployeeCourtAppearance.js` |

### Routes
| Current | Standardized |
|---------|-------------|
| `BudgetManagerOrgRoutes.js` | `budgetManagerOrgRoutes.js` |
| `RATARoutes.js` | `rataRoutes.js` |
| `COSPersonnel_router.js` | `cosPersonnelRoutes.js` |
| `ps_annexes.js` | `personnelServicesAnnexesRoutes.js` |

## 🔧 Required Updates

### Import Statement Updates
Files that need import updates after renaming:

1. **index.js** - Update all router imports
2. **Controllers** - Update model imports
3. **Routes** - Update controller imports
4. **Client API calls** - Update endpoint references

### Example Updates Needed

#### In index.js
```javascript
// Before
const budgetManagerOrgRouter = require('./routers/BudgetManagerOrgRoutes');
const rataRouter = require('./routers/RATARoutes');

// After
const budgetManagerOrgRoutes = require('./routers/budgetManagerOrgRoutes');
const rataRoutes = require('./routers/rataRoutes');
```

#### In Controllers
```javascript
// Before
const MOOEProposal = require('../models/mooeProposals');
const ChartOfAccounts = require('../models/chartOfAccounts');

// After
const MooeProposal = require('../models/MooeProposals');
const ChartOfAccounts = require('../models/ChartOfAccounts');
```

## ⚠️ Critical Considerations

### Database Collections
- **DO NOT** change database collection names
- Model names can change but collection names should remain stable
- Existing data should not be affected

### API Endpoints
- Keep API endpoints consistent for client compatibility
- Only internal file structure changes
- No breaking changes to external interfaces

### Testing Requirements
- Test each phase thoroughly before proceeding
- Verify all imports work correctly
- Ensure no functionality is broken

## 🚀 Implementation Status

### Completed ✅
- [x] Naming convention analysis
- [x] Standardization plan created
- [x] ChartOfAccounts model standardized
- [x] MooeProposal model standardized
- [x] Implementation scripts created

### In Progress 🔄
- [ ] Controller file renaming
- [ ] Route file renaming
- [ ] Import statement updates

### Pending ⏳
- [ ] Middleware standardization
- [ ] Utils standardization
- [ ] Client-side updates
- [ ] Documentation updates

## 📈 Benefits Achieved

### Code Organization
- ✅ Consistent file naming patterns
- ✅ Predictable file locations
- ✅ Better IDE navigation

### Developer Experience
- ✅ Improved autocomplete
- ✅ Easier code discovery
- ✅ Reduced cognitive load

### Maintainability
- ✅ Professional codebase structure
- ✅ Easier onboarding for new developers
- ✅ Better code organization

## 🎯 Next Steps

1. **Complete Phase 2** - Rename remaining controllers
2. **Update Imports** - Fix all import statements
3. **Test Functionality** - Verify everything works
4. **Phase 3** - Rename route files
5. **Client Updates** - Update client-side references
6. **Documentation** - Update all documentation

---

**Ang naming convention standardization ay ongoing! 🎉**

This systematic approach ensures a clean, organized, and maintainable codebase that follows industry best practices.
