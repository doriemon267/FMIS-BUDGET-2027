export const getFilteredDepartments = (regionId, organizationStructure) => {
  if (!organizationStructure?.availableUnits?.departments) {
    return [];
  }
  let depts = organizationStructure.availableUnits.departments;
  if (regionId) {
    const regionMappings =
      organizationStructure.mappings?.filter(
        (mapping) => mapping.regionId === regionId
      ) || [];
    const departmentIds = regionMappings.map((mapping) => mapping.departmentId);
    depts = depts.filter((dept) => departmentIds.includes(dept.id));
  }
  return depts;
};

/**
 * Get available divisions for a selected department
 * @param {string} departmentId - Selected department ID
 * @param {string} regionId - Selected region ID
 * @param {Object} organizationStructure - Organizational structure data
 * @returns {Array} Available divisions
 */
export const getAvailableDivisions = (
  departmentId,
  regionId,
  organizationStructure
) => {
  if (
    !departmentId ||
    !organizationStructure?.availableUnits?.departmentsWithDivisions
  ) {
    return [];
  }
  let deptsWithDivisions =
    organizationStructure.availableUnits.departmentsWithDivisions;
  if (regionId) {
    deptsWithDivisions = deptsWithDivisions.filter(
      (dept) => dept.regionId === regionId
    );
  }
  const department = deptsWithDivisions.find(
    (dept) => dept.departmentId === departmentId
  );
  return department ? department.divisions : [];
};

/**
 * Get departments that have divisions
 * @param {string} regionId - Selected region ID
 * @param {Object} organizationStructure - Organizational structure data
 * @returns {Array} Departments with divisions
 */
export const getDepartmentsWithDivisions = (
  regionId,
  organizationStructure
) => {
  if (!organizationStructure?.availableUnits?.departmentsWithDivisions) {
    return [];
  }
  let depts = organizationStructure.availableUnits.departmentsWithDivisions;
  if (regionId) {
    depts = depts.filter((dept) => dept.regionId === regionId);
  }
  return depts;
};

/**
 * Check if selected department has divisions
 * @param {string} departmentId - Selected department ID
 * @param {string} regionId - Selected region ID
 * @param {Object} organizationStructure - Organizational structure data
 * @returns {boolean} True if department has divisions
 */
export const selectedDepartmentHasDivisions = (
  departmentId,
  regionId,
  organizationStructure
) => {
  if (
    !departmentId ||
    !organizationStructure?.availableUnits?.departmentsWithDivisions
  ) {
    return false;
  }
  let deptsWithDivisions =
    organizationStructure.availableUnits.departmentsWithDivisions;
  if (regionId) {
    deptsWithDivisions = deptsWithDivisions.filter(
      (dept) => dept.regionId === regionId
    );
  }
  const department = deptsWithDivisions.find(
    (dept) => dept.departmentId === departmentId
  );
  return department
    ? department.divisions && department.divisions.length > 0
    : false;
};
