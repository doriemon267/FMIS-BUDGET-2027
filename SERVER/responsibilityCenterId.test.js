const { buildResponsibilityCenterId } = require('./utils/responsibilityCenterId');

describe('buildResponsibilityCenterId', () => {
  it('keeps responsibility center IDs unique for regions sharing one mapping', () => {
    const sharedMapping = { _id: 'mapping-1', departmentId: 'division-office' };
    const upriis = buildResponsibilityCenterId({ ...sharedMapping, regionId: 'upriis' }, 0);
    const mariis = buildResponsibilityCenterId({ ...sharedMapping, regionId: 'mariis' }, 0);

    expect(upriis).toBe('rc_mapping-1_upriis_0');
    expect(mariis).toBe('rc_mapping-1_mariis_0');
    expect(upriis).not.toBe(mariis);
  });

  it('remains stable for mappings without a region', () => {
    expect(buildResponsibilityCenterId({ _id: 'mapping-1' }, 2)).toBe(
      'rc_mapping-1_all-regions_2'
    );
  });
});
