const buildResponsibilityCenterId = (mapping, divisionIndex, mappingIndex = 0) => {
  const mappingId = mapping?._id || mapping?.departmentId || mappingIndex;
  const regionId = mapping?.regionId || 'all-regions';

  return `rc_${mappingId}_${regionId}_${divisionIndex}`;
};

module.exports = { buildResponsibilityCenterId };
