const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
/**
 * Enforce organizational access for write operations (create/update/delete).
 * - Loads the user's hierarchical assignment
 * - If user has FULL access, allow
 * - Otherwise, ensures req.body.region/department/division are within the user's assigned units
 * - If a field is missing and the user has exactly one allowed value, auto-fill it
 * - If invalid, responds 403
 */
module.exports = async function enforceOrgAccess(req, res, next) {
  try {
    const userId = req.user?.id;
    const roles = req.user?.Roles || [];
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: missing user' });
    }
    // Full access roles can transact anywhere
    const hasFullRole = roles.includes('SUPER ADMIN') || roles.includes('BUDGET MANAGER');
    if (hasFullRole) return next();
  // Get assignment
    const assignment = await HierarchicalUserAssignment.getUserPermissions(userId);
    // OWN_ONLY or missing assignment -> deny transactional access
    if (!assignment || assignment.accessScope === 'OWN_ONLY') {
      return res.status(403).json({ message: 'Access denied. No organizational assignment.' });
    }
    // Build allowed sets (names for Region/Department, raw for division)
    const allowedRegionNames = (assignment.regions || [])
      .map(r => r.Region || r.regionName || r.name)
      .filter(Boolean);
    const allowedDeptNames = (assignment.departments || [])
      .map(d => d.Department || d.departmentName || d.name)
      .filter(Boolean);
    const allowedDivisions = assignment.divisions || [];
    // Helper to enforce one field
    const enforceField = (fieldName, allowedValues) => {
      if (!allowedValues || allowedValues.length === 0) return { ok: true };
      const current = req.body[fieldName];
      if (!current) {
        if (allowedValues.length === 1) {
          req.body[fieldName] = allowedValues[0];
          return { ok: true, autofilled: true };
        }
        return { ok: false, reason: `${fieldName} required for your access scope` };
      }
      // Normalize compare by uppercase trim for names
      const norm = String(current).trim().toUpperCase();
      const match = allowedValues.some(v => String(v).trim().toUpperCase() === norm);
      return match ? { ok: true } : { ok: false, reason: `${fieldName} "${current}" not allowed` };
    };
    // Special-case: prevent destructive bulk deletes for non-admins
    if (req.method === 'POST' && /deleteAllPersonnels/i.test(req.originalUrl || '')) {
      return res.status(403).json({ message: 'Bulk delete is restricted to administrators.' });
    }

    // Special-case: Allow saving Capital Outlay breakdown details by validating
    // the parent CapitalOutlay record's organizational ownership instead of
    // requiring region/department/division in the request body.
    // This catches routes like: POST /api/capital-outlay/:capitalOutlayId/details
    try {
      const url = (req.originalUrl || '').toLowerCase();
      const method = (req.method || 'GET').toUpperCase();
      // Match 24-hex ObjectId in the details route
      const detailsMatch = url.match(/\/api\/capital-outlay\/([a-f0-9]{24})\/details/);
      if (method === 'POST' && detailsMatch && detailsMatch[1]) {
        const capitalOutlayId = detailsMatch[1];
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(capitalOutlayId)) {
          return res.status(400).json({ message: 'Invalid capital outlay ID' });
        }
        const CapitalOutlay = require('../models/CapitalOutlay');
        const record = await CapitalOutlay.findById(capitalOutlayId).lean();
        if (!record) {
          return res.status(404).json({ message: 'Capital outlay not found' });
        }
        const recRegion = record.region;
        const recDept = record.department;
        const recDiv = record.division;
        const inAllowedRegion = !allowedRegionNames.length || (recRegion && allowedRegionNames.some(v => String(v).trim().toUpperCase() === String(recRegion).trim().toUpperCase()));
        const inAllowedDept = !allowedDeptNames.length || (recDept && allowedDeptNames.some(v => String(v).trim().toUpperCase() === String(recDept).trim().toUpperCase()));
        const inAllowedDiv = !allowedDivisions.length || (recDiv && allowedDivisions.some(v => String(v).trim().toUpperCase() === String(recDiv).trim().toUpperCase()));

        if (assignment.accessScope === 'REGION' && !inAllowedRegion) {
          return res.status(403).json({ message: 'You cannot modify records outside your Region.' });
        }
        if (assignment.accessScope === 'DEPARTMENT' && (!inAllowedRegion || !inAllowedDept)) {
          return res.status(403).json({ message: 'You cannot modify records outside your Department.' });
        }
        if (assignment.accessScope === 'DIVISION' && (!inAllowedRegion || !inAllowedDept || !inAllowedDiv)) {
          return res.status(403).json({ message: 'You cannot modify records outside your Division.' });
        }
        // Organizational access validated against existing record – allow without requiring org fields in body
        return next();
      }
    } catch (e) {
      // If this special-case validation fails unexpectedly, fall through to standard checks
    }
    // If updating a specific record and org fields are missing in body, try to validate against existing record
    if ((req.method === 'PUT' || req.method === 'PATCH') && req.params?.id) {
      try {
        // Attempt to infer model by route
        if ((req.originalUrl || '').includes('/personnelServices/')) {
          const PersonnelServices = require('../models/personnelServices');
          const existing = await PersonnelServices.findById(req.params.id).lean();
          if (!existing) {
            return res.status(404).json({ message: 'Target record not found' });
          }
          // Ensure existing record falls within user's allowed scope
          const recRegion = existing.region;
          const recDept = existing.department;
          const recDiv = existing.division;
          const inAllowedRegion = !allowedRegionNames.length || (recRegion && allowedRegionNames.some(v => String(v).trim().toUpperCase() === String(recRegion).trim().toUpperCase()));
          const inAllowedDept = !allowedDeptNames.length || (recDept && allowedDeptNames.some(v => String(v).trim().toUpperCase() === String(recDept).trim().toUpperCase()));
          const inAllowedDiv = !allowedDivisions.length || (recDiv && allowedDivisions.some(v => String(v).trim().toUpperCase() === String(recDiv).trim().toUpperCase()));
          if (assignment.accessScope === 'REGION' && !inAllowedRegion) {
            return res.status(403).json({ message: 'You cannot modify records outside your Region.' });
          }
          if (assignment.accessScope === 'DEPARTMENT' && (!inAllowedRegion || !inAllowedDept)) {
            return res.status(403).json({ message: 'You cannot modify records outside your Department.' });
          }
          if (assignment.accessScope === 'DIVISION' && (!inAllowedRegion || !inAllowedDept || !inAllowedDiv)) {
            return res.status(403).json({ message: 'You cannot modify records outside your Division.' });
          }
        }
      } catch (e) {
        // If validation fails unexpectedly, be safe: deny
        console.error('enforceOrgAccess update validation error:', e);
        return res.status(500).json({ message: 'Error validating organizational access for update' });
      }
    }
    // Enforce based on scope (enforce only fields relevant to scope)
    if (assignment.accessScope === 'REGION') {
      const r = enforceField('region', allowedRegionNames);
      if (!r.ok) return res.status(403).json({ message: r.reason });
      // department/division consolidate to region; no stricter check here
    } else if (assignment.accessScope === 'DEPARTMENT') {
      const r = enforceField('region', allowedRegionNames);
      if (!r.ok) return res.status(403).json({ message: r.reason });
      const d = enforceField('department', allowedDeptNames);
      if (!d.ok) return res.status(403).json({ message: d.reason });
    } else if (assignment.accessScope === 'DIVISION') {
      const r = enforceField('region', allowedRegionNames);
      if (!r.ok) return res.status(403).json({ message: r.reason });
      const d = enforceField('department', allowedDeptNames);
      if (!d.ok) return res.status(403).json({ message: d.reason });
      const v = enforceField('division', allowedDivisions);
      if (!v.ok) return res.status(403).json({ message: v.reason });
    }
    return next();
  } catch (error) {
    console.error('🚨 enforceOrgAccess error:', error);
    return res.status(500).json({ message: 'Server error validating organizational access' });
  }
};
