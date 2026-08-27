const {
  isWorkflowProgressionAction,
  isProposalInActiveCycle,
  assertProposalInActiveCycleForProgression,
} = require('../../utils/proposalActiveCycle');

const createSettingsModel = (activeSettings) => ({
  findOne: jest.fn(() => ({
    select: jest.fn(() => ({
      lean: jest.fn().mockResolvedValue(activeSettings),
    })),
  })),
});

describe('proposal active-cycle workflow guard', () => {
  test.each([
    'submit-to-reviewer',
    'submit-to-approver',
    'submit-to-analyst',
    'forward-to-officer',
    'forward-to-manager',
    'finalize',
  ])('recognizes %s as forward workflow progression', (action) => {
    expect(isWorkflowProgressionAction(action)).toBe(true);
  });

  test('keeps return actions outside active-cycle progression gating', () => {
    expect(isWorkflowProgressionAction('return-to-preparer')).toBe(false);
  });

  test('matches proposal model and fiscal year case-insensitively', () => {
    expect(
      isProposalInActiveCycle(
        { modelType: 'NEP', fiscalYear: 2027 },
        { budgetType: 'nep', fiscalYear: '2027' }
      )
    ).toBe(true);
  });

  test('blocks progression when the active budget type differs', async () => {
    const SettingsModel = createSettingsModel({ budgetType: 'Initial', fiscalYear: '2027' });

    await expect(
      assertProposalInActiveCycleForProgression(
        { modelType: 'NEP', fiscalYear: '2027' },
        'submit-to-reviewer',
        SettingsModel
      )
    ).rejects.toMatchObject({ statusCode: 409, code: 'INACTIVE_BUDGET_CYCLE' });
  });

  test('blocks progression when the active fiscal year differs', async () => {
    const SettingsModel = createSettingsModel({ budgetType: 'NEP', fiscalYear: '2028' });

    await expect(
      assertProposalInActiveCycleForProgression(
        { modelType: 'NEP', fiscalYear: '2027' },
        'forward-to-officer',
        SettingsModel
      )
    ).rejects.toMatchObject({ statusCode: 409, code: 'INACTIVE_BUDGET_CYCLE' });
  });

  test('allows matching progression and does not block return actions', async () => {
    const active = { budgetType: 'Initial', fiscalYear: '2027' };
    const SettingsModel = createSettingsModel(active);

    await expect(
      assertProposalInActiveCycleForProgression(
        { modelType: 'Initial', fiscalYear: '2027' },
        'submit-to-reviewer',
        SettingsModel
      )
    ).resolves.toBeUndefined();

    const unusedSettingsModel = createSettingsModel(null);
    await expect(
      assertProposalInActiveCycleForProgression(
        { modelType: 'Initial', fiscalYear: '2024' },
        'return-to-preparer',
        unusedSettingsModel
      )
    ).resolves.toBeUndefined();
    expect(unusedSettingsModel.findOne).not.toHaveBeenCalled();
  });
});
