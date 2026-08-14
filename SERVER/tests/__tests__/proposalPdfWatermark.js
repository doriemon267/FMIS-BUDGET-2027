const {
  normalizeProposalStatus,
  isFinalizedProposalStatus,
  shouldShowDraftWatermark,
  resolveDraftWatermarkForRecords,
  drawMuhammaraDraftWatermark,
} = require('../../utils/proposalPdfWatermark');

describe('proposal PDF watermark rules', () => {
  test('normalizes proposal statuses and recognizes only FINALIZED', () => {
    expect(normalizeProposalStatus(' finalized ')).toBe('FINALIZED');
    expect(normalizeProposalStatus('Forwarded to Reviewer')).toBe('FORWARDED_TO_REVIEWER');
    expect(isFinalizedProposalStatus('Finalized')).toBe(true);
    expect(isFinalizedProposalStatus('Approver Approved')).toBe(false);
  });

  test('removes the watermark only when every included proposal is finalized', () => {
    expect(shouldShowDraftWatermark([{ status: 'Finalized' }, { status: 'FINALIZED' }])).toBe(false);
    expect(shouldShowDraftWatermark([{ status: 'Finalized' }, { status: 'Draft' }])).toBe(true);
    expect(shouldShowDraftWatermark([{ status: 'Forwarded to Budget Officer' }])).toBe(true);
    expect(shouldShowDraftWatermark([{ status: 'Returned to Preparer' }])).toBe(true);
  });

  test('uses DRAFT for missing or unverifiable status', () => {
    expect(shouldShowDraftWatermark()).toBe(true);
    expect(shouldShowDraftWatermark([])).toBe(true);
    expect(shouldShowDraftWatermark([{}])).toBe(true);
    expect(shouldShowDraftWatermark({ isFinalized: false })).toBe(true);
    expect(shouldShowDraftWatermark({ isFinalized: true })).toBe(false);
  });

  test('uses linked workflow status as the authoritative proposal status', async () => {
    const lean = jest.fn().mockResolvedValue([
      { _id: 'workflow-1', status: 'FINALIZED' },
      { _id: 'workflow-2', status: 'FINALIZED' },
    ]);
    const select = jest.fn(() => ({ lean }));
    const WorkflowModel = { find: jest.fn(() => ({ select })) };

    const showDraft = await resolveDraftWatermarkForRecords([
      { workflowRef: 'workflow-1', status: 'Draft' },
      { workflowRef: 'workflow-2', status: 'Forwarded to Approver' },
    ], WorkflowModel);

    expect(showDraft).toBe(false);
    expect(WorkflowModel.find).toHaveBeenCalledWith({
      _id: { $in: ['workflow-1', 'workflow-2'] },
    });
  });

  test('keeps DRAFT when any linked workflow is not finalized', async () => {
    const lean = jest.fn().mockResolvedValue([
      { _id: 'workflow-1', status: 'FINALIZED' },
      { _id: 'workflow-2', status: 'FORWARDED_TO_BRD_MANAGER' },
    ]);
    const WorkflowModel = {
      find: jest.fn(() => ({ select: () => ({ lean }) })),
    };

    await expect(resolveDraftWatermarkForRecords([
      { workflowRef: 'workflow-1' },
      { workflowRef: 'workflow-2' },
    ], WorkflowModel)).resolves.toBe(true);
  });

  test('draws only the DRAFT label when enabled', () => {
    const pdfContext = { text: jest.fn() };

    expect(drawMuhammaraDraftWatermark(pdfContext, {
      show: true,
      pageWidth: 842,
      pageHeight: 595,
    })).toBe(true);
    expect(pdfContext.text).toHaveBeenCalledTimes(1);
    expect(pdfContext.text.mock.calls[0][0]).toBe('DRAFT');

    pdfContext.text.mockClear();
    expect(drawMuhammaraDraftWatermark(pdfContext, {
      show: false,
      pageWidth: 842,
      pageHeight: 595,
    })).toBe(false);
    expect(pdfContext.text).not.toHaveBeenCalled();
  });
});
