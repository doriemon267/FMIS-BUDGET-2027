const mongoose = require('mongoose');
// Department-Division mapping schema
const departmentDivisionMappingSchema = new mongoose.Schema({
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'department',
    required: true
  },
  departmentName: {
    type: String,
    required: true
  },
  divisions: [{
    name: String,
    code: String,
    sections: [{
      name: String,
      code: String,
      isActive: {
        type: Boolean,
        default: true
      }
    }],
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  hasSubDivisions: {
    type: Boolean,
    default: false
  },
  regionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'region'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});
// Pre-save middleware to update timestamp
departmentDivisionMappingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});
// Static method to get organization structure with divisions
departmentDivisionMappingSchema.statics.getCompleteOrganizationStructure = async function() {
  try {
    const Region = mongoose.model('region');
    const Department = mongoose.model('department');
    // Get all regions
    const regions = await Region.find({ isActive: true }).sort({ Region: 1 });
    // Get all departments
    const departments = await Department.find({ isActive: true }).sort({ Department: 1 });
    // Get all department-division mappings
    const mappings = await this.find({}).populate('departmentId').populate('regionId');
    // Build complete structure
    const structure = {
      regions: regions.map(region => ({
        id: region._id,
        name: region.Region,
        code: region.RegionCode || region.Code,
        isActive: region.isActive
      })),
      departments: departments.map(dept => {
        const mapping = mappings.find(m => m.departmentId && m.departmentId._id.toString() === dept._id.toString());
        return {
          id: dept._id,
          name: dept.Department,
          code: dept.DepartmentCode || dept.Code,
          hasSubDivisions: mapping ? mapping.hasSubDivisions : false,
          divisions: mapping ? mapping.divisions.filter(div => div.isActive) : [],
          isActive: dept.isActive
        };
      }),
      mappings: mappings.map(mapping => ({
        departmentId: mapping.departmentId?._id,
        departmentName: mapping.departmentName,
        divisions: mapping.divisions.filter(div => div.isActive),
        hasSubDivisions: mapping.hasSubDivisions,
        regionId: mapping.regionId?._id
      }))
    };
    return structure;
  } catch (error) {
    console.error('Error getting complete organization structure:', error);
    throw error;
  }
};
// Static method to get departments with divisions only
departmentDivisionMappingSchema.statics.getDepartmentsWithDivisions = async function() {
  try {
    const mappings = await this.find({ hasSubDivisions: true })
      .populate('departmentId')
      .populate('regionId');
    return mappings.map(mapping => ({
      departmentId: mapping.departmentId._id,
      departmentName: mapping.departmentName,
      divisions: mapping.divisions.filter(div => div.isActive),
      regionId: mapping.regionId?._id
    }));
  } catch (error) {
    console.error('Error getting departments with divisions:', error);
    throw error;
  }
};
// Static method to get available divisions for a department
departmentDivisionMappingSchema.statics.getDivisionsForDepartment = async function(departmentId) {
  try {
    const mapping = await this.findOne({ departmentId }).populate('departmentId');
    if (!mapping || !mapping.hasSubDivisions) {
      return [];
    }
    return mapping.divisions.filter(div => div.isActive);
  } catch (error) {
    console.error('Error getting divisions for department:', error);
    throw error;
  }
};
// Static method to validate department-division combination
departmentDivisionMappingSchema.statics.validateDepartmentDivisionCombination = async function(departmentId, divisionName) {
  try {
    const mapping = await this.findOne({ departmentId });
    if (!mapping) {
      return false;
    }
    if (!mapping.hasSubDivisions) {
      return divisionName === null || divisionName === '';
    }
    return mapping.divisions.some(div => div.isActive && div.name === divisionName);
  } catch (error) {
    console.error('Error validating department-division combination:', error);
    return false;
  }
};
const DepartmentDivisionMapping = mongoose.model('DepartmentDivisionMapping', departmentDivisionMappingSchema);
module.exports = DepartmentDivisionMapping;