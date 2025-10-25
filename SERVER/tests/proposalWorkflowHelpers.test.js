const { __private } = require('../controllers/proposalWorkflowController');

const {
  validateAndNormalizeComment,
  updateAssignment,
  recordWorkflowEvent
} = __private;

describe('proposalWorkflowController helpers', () => {
  describe('validateAndNormalizeComment', () => {
    test('trims whitespace and returns normalized comment', () => {
      expect(validateAndNormalizeComment('  Hello World  ')).toBe('Hello World');
    });

    test('throws error when comment missing for required action', () => {
      expect(() => validateAndNormalizeComment('', 'approve the proposal')).toThrow(
        /Comment is required to approve the proposal\./
      );
    });
  });

  describe('updateAssignment', () => {
    test('updates assignment fields when provided', () => {
      const proposal = {
        currentStep: 'ANALYST_DRAFT',
        currentAssigneeRole: 'BUDGET_PLANNING_ANALYST',
        pendingWithRoles: ['BUDGET_PLANNING_ANALYST']
      };

      updateAssignment(proposal, {
        step: 'REVIEWER_REVIEW',
        assigneeRole: 'APPROVER',
        pendingRoles: ['APPROVER']
      });

      expect(proposal.currentStep).toBe('REVIEWER_REVIEW');
      expect(proposal.currentAssigneeRole).toBe('APPROVER');
      expect(proposal.pendingWithRoles).toEqual(['APPROVER']);
    });

    test('leaves fields untouched when undefined', () => {
      const proposal = {
        currentStep: 'ANALYST_DRAFT',
        currentAssigneeRole: 'BUDGET_PLANNING_ANALYST',
        pendingWithRoles: ['BUDGET_PLANNING_ANALYST']
      };

      updateAssignment(proposal, {});

      expect(proposal.currentStep).toBe('ANALYST_DRAFT');
      expect(proposal.currentAssigneeRole).toBe('BUDGET_PLANNING_ANALYST');
      expect(proposal.pendingWithRoles).toEqual(['BUDGET_PLANNING_ANALYST']);
    });
  });

  describe('recordWorkflowEvent', () => {
    test('appends workflow history entry and updates last action metadata', () => {
      const proposal = {
        workflowHistory: [],
        lastActionBy: null,
        lastActionDate: null
      };

      const fixedDate = new Date('2025-01-01T00:00:00Z');
      jest.useFakeTimers().setSystemTime(fixedDate);

      try {
        recordWorkflowEvent(proposal, {
          action: 'APPROVE',
          comment: 'Approved with conditions',
          userId: '123',
          userName: 'Manager One',
          previousStatus: 'Office Submitted',
          newStatus: 'Finalized',
          targetRole: 'BUDGET_MANAGER',
          metadata: { foo: 'bar' }
        });

        expect(proposal.workflowHistory).toHaveLength(1);
        const entry = proposal.workflowHistory[0];
        expect(entry).toMatchObject({
          action: 'APPROVE',
          comment: 'Approved with conditions',
          userId: '123',
          userName: 'Manager One',
          previousStatus: 'Office Submitted',
          newStatus: 'Finalized',
          targetRole: 'BUDGET_MANAGER',
          metadata: { foo: 'bar' }
        });
        expect(entry.timestamp).toBeInstanceOf(Date);
        expect(entry.timestamp.getTime()).toBe(fixedDate.getTime());
        expect(proposal.lastActionBy).toBe('Manager One');
        expect(proposal.lastActionDate).toBeInstanceOf(Date);
        expect(proposal.lastActionDate.getTime()).toBe(fixedDate.getTime());
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
