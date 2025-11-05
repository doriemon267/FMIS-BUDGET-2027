# 📋 Deployment Checklist - Budget Planning Analyst Region Assignment

**Feature**: Budget Planning Analyst Region-Based Filtering  
**Release Date**: November 4, 2025  
**Status**: Ready for Deployment

---

## Pre-Deployment Verification

### Frontend Changes
- [ ] ✅ ACCESS_LEVELS renamed "Budget Revenue Division Level"
- [ ] ✅ Region selection UI added for Budget Planning Analyst
- [ ] ✅ Two button options (NIA-Wide vs Specific Regions)
- [ ] ✅ Multi-select region picker implemented
- [ ] ✅ Form validation added
- [ ] ✅ Payload includes `isNIAWide` and `assignedRegions`
- [ ] ✅ Updated handleSubmit function
- [ ] ✅ Reset form includes new fields

**File**: `CLIENT/src/pages/HierarchicalUserAssignmentPage.jsx`  
**Lines Changed**: ~150 lines  
**Backward Compatible**: Yes

### Backend Model Changes
- [ ] ✅ Added `isNIAWide: Boolean` field
- [ ] ✅ Added `assignedRegions: [ObjectId]` field
- [ ] ✅ Default values set (`false` and `[]`)
- [ ] ✅ Field descriptions added

**File**: `SERVER/models/HierarchicalUserAssignment.js`  
**Lines Changed**: ~20 lines  
**Backward Compatible**: Yes (uses defaults)

### Controller Changes
- [ ] ✅ Assignment payload updated
- [ ] ✅ Region data handling added
- [ ] ✅ Populate query enhanced for assignedRegions
- [ ] ✅ Logging updated with region info
- [ ] ✅ Error handling reviewed

**File**: `SERVER/controllers/HierarchicalUserAssignmentController.js`  
**Lines Changed**: ~50 lines  
**Backward Compatible**: Yes

### New Middleware File
- [ ] ✅ `budgetPlanningAnalystAccessControl.js` created
- [ ] ✅ Main middleware function implemented
- [ ] ✅ `shouldRouteToAnalyst()` helper created
- [ ] ✅ `findAppropriateAnalysts()` helper created
- [ ] ✅ Documentation comments added
- [ ] ✅ Error handling implemented

**File**: `SERVER/middleware/budgetPlanningAnalystAccessControl.js`  
**Lines of Code**: ~250 lines  
**New Dependencies**: None

### Documentation
- [ ] ✅ Main implementation guide created
- [ ] ✅ Quick reference guide created
- [ ] ✅ Implementation summary created
- [ ] ✅ Code examples provided
- [ ] ✅ API request/response samples included
- [ ] ✅ Testing scenarios documented
- [ ] ✅ Troubleshooting guide provided

**Files Created**: 3 new documentation files

---

## Testing Checklist

### Unit Tests
- [ ] Test NIA-Wide assignment creation
- [ ] Test specific region assignment creation
- [ ] Test region validation
- [ ] Test middleware for Budget Planning Analyst bypass
- [ ] Test middleware for other roles bypass
- [ ] Test region filtering logic
- [ ] Test shouldRouteToAnalyst() function
- [ ] Test findAppropriateAnalysts() function

### Integration Tests
- [ ] Create analyst with NIA-Wide access
  - Expected: Can be created, `isNIAWide = true`
- [ ] Create analyst with specific regions
  - Expected: Can be created, `assignedRegions = [...]`
- [ ] Edit analyst from NIA-Wide to specific regions
  - Expected: Successfully converts
- [ ] Edit analyst from specific regions to NIA-Wide
  - Expected: Successfully converts
- [ ] Validate region selection required
  - Expected: Error shown when no regions selected
- [ ] Verify API responses include region data
  - Expected: `isNIAWide` and `assignedRegions` in response

### UI Tests
- [ ] Region selector appears only for Budget Planning Analyst
- [ ] NIA-Wide button selectable and clickable
- [ ] Specific Regions button selectable and clickable
- [ ] Region picker shows when Specific Regions selected
- [ ] Region picker hides when NIA-Wide selected
- [ ] Multi-select works correctly in region picker
- [ ] Validation error shows for no regions
- [ ] Success notification shown on save

### Functional Tests
- [ ] Analyst with NIA-Wide sees all test proposals
- [ ] Analyst with specific regions sees only those regions
- [ ] Analyst with MARIIS region sees MARIIS proposals
- [ ] Analyst with CALABARZON region sees CALABARZON proposals
- [ ] Analyst with MARIIS doesn't see CALABARZON proposals
- [ ] Region assignment persists after page reload
- [ ] Can edit assignment multiple times

---

## Database Preparation

### Backup
- [ ] Full MongoDB backup taken
  - Database: `fmis_budget`
  - Collection: `hierarchicaluserassignments`
- [ ] Backup location: [Specify location]
- [ ] Backup date: [Date]
- [ ] Backup verified: [Yes/No]

### Migration Script (Optional)
- [ ] For existing analysts, decide on default:
  - Option A: Set to NIA-Wide (all regions)
  - Option B: Manual assignment required
- [ ] If needed, create migration script
  ```javascript
  // Example: Set existing BUDGET_PLANNING_ANALYST to NIA-Wide
  db.hierarchicaluserassignments.updateMany(
    { userRole: 'BUDGET_PLANNING_ANALYST', isNIAWide: { $exists: false } },
    { $set: { isNIAWide: true, assignedRegions: [] } }
  )
  ```
- [ ] Test migration script on backup
- [ ] Run on production if needed

### Data Validation
- [ ] Check for existing BUDGET_PLANNING_ANALYST records
- [ ] Verify no conflicting data
- [ ] Ensure region IDs exist in Region collection
- [ ] Document any data inconsistencies

---

## Deployment Steps

### Step 1: Backend Deployment
- [ ] Deploy updated models to server
  ```bash
  git pull origin workflow-6step-refactor-september-2025
  cd SERVER
  npm install (if needed)
  ```
- [ ] Deploy updated controller to server
- [ ] Deploy new middleware file to server
- [ ] Verify files in place:
  - `models/HierarchicalUserAssignment.js`
  - `controllers/HierarchicalUserAssignmentController.js`
  - `middleware/budgetPlanningAnalystAccessControl.js`
- [ ] Restart Node.js server
  ```bash
  pm2 restart fmis-budget-server
  ```
- [ ] Verify server is running
  ```bash
  curl http://localhost:5005/api/health
  ```

### Step 2: Frontend Deployment
- [ ] Deploy updated React component
  ```bash
  cd CLIENT
  npm run build
  ```
- [ ] Deploy built files to web server
- [ ] Clear browser cache (or version bump)
- [ ] Test UI loads correctly
- [ ] Verify Budget Planning Analyst region UI appears

### Step 3: Verification
- [ ] API endpoints responding correctly
- [ ] New fields appear in responses
- [ ] Frontend UI displays correctly
- [ ] No console errors in browser
- [ ] No server logs showing errors

---

## Post-Deployment Testing

### Smoke Tests (Immediate)
- [ ] Create test Budget Planning Analyst with NIA-Wide
  - Expected: Success ✓
- [ ] Create test Budget Planning Analyst with regions
  - Expected: Success ✓
- [ ] Edit existing assignment
  - Expected: Changes persist ✓
- [ ] View assignments
  - Expected: Region data displays ✓

### Functional Tests (Within 1 hour)
- [ ] Test complete workflow:
  1. Create analyst with MARIIS region
  2. Submit proposal from MARIIS
  3. Verify analyst sees it
  4. Test analyst from different region can't see it
- [ ] Test NIA-Wide:
  1. Create analyst with NIA-Wide
  2. Submit proposals from different regions
  3. Verify analyst sees all

### User Acceptance Testing (Within 24 hours)
- [ ] Admins can create assignments
- [ ] Admins can edit assignments
- [ ] UI is intuitive
- [ ] Region selection works smoothly
- [ ] No unexpected errors occur

---

## Rollback Plan

If critical issues are discovered:

### Immediate Rollback
```bash
# 1. Revert files to previous version
git revert [commit-hash]

# 2. Restart server
pm2 restart fmis-budget-server

# 3. Clear frontend cache
# (Force refresh or redeploy previous build)

# 4. Restore from backup if needed
mongorestore --db fmis_budget [backup-path]
```

### Partial Rollback
If issues only affect specific functionality:
```bash
# 1. Keep files but disable middleware in routes
# Comment out: budgetPlanningAnalystAccessControl in proposal routes

# 2. Set all analysts to NIA-Wide (temporary)
db.hierarchicaluserassignments.updateMany(
  { userRole: 'BUDGET_PLANNING_ANALYST' },
  { $set: { isNIAWide: true } }
)

# 3. Investigate and fix issues
```

### Rollback Trigger Criteria
- [ ] Define what constitutes critical issue
- [ ] Example: "More than 5 runtime errors per minute"
- [ ] Example: "Analysts can't see any proposals"
- [ ] Example: "API returning 500 errors"

---

## Monitoring Post-Deployment

### Logs to Monitor
```bash
# Backend errors
tail -f /var/log/fmis-budget-server.log | grep ERROR

# API performance
grep "budgetPlanningAnalystAccessControl" /var/log/fmis-budget-server.log

# Database queries
mongostat --interval 5
```

### Metrics to Track
- [ ] API response time for analyst endpoints
- [ ] Percentage of Budget Planning Analyst users
- [ ] Assignment creation/update frequency
- [ ] Error rates for new middleware
- [ ] User feedback and support tickets

### Alerts to Set Up
- [ ] High error rate (> 1% of requests)
- [ ] API response time degradation
- [ ] Database connection issues
- [ ] Region filtering returning wrong results

---

## Documentation Updates

### Admin Documentation
- [ ] Update user manual with new UI
- [ ] Add screenshots of region selection
- [ ] Create step-by-step guide for admins
- [ ] Document troubleshooting section

### Developer Documentation
- [ ] Update API documentation
- [ ] Add middleware usage examples
- [ ] Document database schema changes
- [ ] Create architecture diagrams if needed

### User Training
- [ ] Prepare training materials
- [ ] Record screen capture demo
- [ ] Schedule training sessions
- [ ] Gather feedback after training

---

## Sign-Off

### Technical Lead
- [ ] Code reviewed: [Name] __________
- [ ] Tests passed: [Date] __________
- [ ] Approved for deployment: [Yes/No] __________

### QA/Testing
- [ ] All tests passed: [Name] __________
- [ ] No critical issues: [Date] __________
- [ ] Approved for deployment: [Yes/No] __________

### Product Owner
- [ ] Requirements met: [Name] __________
- [ ] User experience acceptable: [Date] __________
- [ ] Approved for deployment: [Yes/No] __________

### Deployment Manager
- [ ] Pre-deployment checklist complete: [Name] __________
- [ ] All approvals obtained: [Date] __________
- [ ] Deployment scheduled: [Time/Date] __________
- [ ] Deployment completed: [Date/Time] __________

---

## Post-Deployment Review

### Within 24 Hours
- [ ] All users able to access system
- [ ] No critical issues reported
- [ ] Performance metrics normal
- [ ] Error rates acceptable

### Within 7 Days
- [ ] Gather user feedback
- [ ] Address any issues
- [ ] Monitor performance trends
- [ ] Plan follow-up fixes if needed

### Within 30 Days
- [ ] Comprehensive system review
- [ ] Optimization opportunities identified
- [ ] Plan for next iteration if needed

---

## Deployment Notes

**Deployment Date**: [To be filled in]  
**Deployed By**: [Name]  
**Environment**: [Development/Staging/Production]  
**Version**: 1.0  

**Notes**: 
[Space for additional notes]

---

**Status**: ✅ Ready for Deployment  
**Completion Date**: November 4, 2025
