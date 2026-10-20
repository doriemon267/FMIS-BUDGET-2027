const mongoose = require('mongoose');

jest.mock('../../models/COSPersonnel', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  bulkWrite: jest.fn(),
  insertMany: jest.fn(),
  deleteOne: jest.fn(),
  countDocuments: jest.fn(),
}));
jest.mock('../../models/EmployeeList', () => ({ find: jest.fn() }));
jest.mock('../../models/Settings', () => ({ findOne: jest.fn() }));
jest.mock('../../models/NewProposalWorkflow', () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));
jest.mock('../../models/mooeProposals', () => ({ updateMany: jest.fn() }));
jest.mock('../../utils/recalculateProposalTotals', () => ({
  recalculateAndSaveProposalTotals: jest.fn().mockResolvedValue({}),
}));

const COSPersonnel = require('../../models/COSPersonnel');
const EmployeeMaster = require('../../models/EmployeeList');
const Settings = require('../../models/Settings');
const NewProposalWorkflow = require('../../models/NewProposalWorkflow');
const MOOE = require('../../models/mooeProposals');
const {
  bulkAddCOSPersonnel,
  deleteCOSPersonnel,
  getGrandTotalCOS,
  updateCOSPersonnel,
  updateCOSPremiumSettings,
} = require('../../controllers/cosPersonnelController');

const createResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const proposalA = new mongoose.Types.ObjectId();
const proposalB = new mongoose.Types.ObjectId();

const createRequest = (overrides = {}) => ({
  user: { id: 'user-1', FirstName: 'Test', LastName: 'Owner', Roles: [] },
  headers: { 'x-workflow-ref': proposalA.toHexString() },
  get: jest.fn(() => proposalA.toHexString()),
  body: {},
  params: {},
  ...overrides,
});

const workflow = {
  _id: proposalA,
  createdBy: 'user-1',
  isLocked: false,
  cosJoPremium: { enabled: true, percentage: 10 },
};

describe('COS premium controller contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    NewProposalWorkflow.findById.mockResolvedValue(workflow);
    MOOE.updateMany.mockResolvedValue({ modifiedCount: 1 });
  });

  test('settings update reapplies only the target proposal rows', async () => {
    const row = {
      _id: new mongoose.Types.ObjectId(),
      workflowRef: proposalA,
      monthlySalary: 10000,
      annualSalary: 120000,
      fiscalYear: '2026',
      toObject: () => ({
        _id: row._id,
        workflowRef: proposalA,
        monthlySalary: 10000,
        annualSalary: 120000,
        fiscalYear: '2026',
      }),
    };
    NewProposalWorkflow.findByIdAndUpdate.mockResolvedValue({
      ...workflow,
      cosJoPremium: { enabled: true, percentage: 12.5, updatedAt: new Date() },
    });
    COSPersonnel.find.mockReturnValue({ session: jest.fn().mockResolvedValue([row]) });
    COSPersonnel.bulkWrite.mockResolvedValue({ modifiedCount: 1 });

    const req = createRequest({
      params: { proposalId: proposalA.toHexString() },
      body: { enabled: true, percentage: 12.5 },
    });
    const res = createResponse();
    await updateCOSPremiumSettings(req, res);

    expect(COSPersonnel.find).toHaveBeenCalledWith({ workflowRef: proposalA });
    expect(COSPersonnel.bulkWrite).toHaveBeenCalledWith([
      expect.objectContaining({
        updateOne: expect.objectContaining({
          filter: { _id: row._id, workflowRef: proposalA },
          update: {
            $set: expect.objectContaining({
              premiumRate: 12.5,
              premiumAmount: 15000,
              Total: 135000,
            }),
          },
        }),
      }),
    ], undefined);
    expect(MOOE.updateMany.mock.calls[0][0]).toEqual({
      workflowRef: proposalA,
      uacsCode: '5-02-99-990-3',
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('row update ignores client totals and derives annual salary from monthly edit', async () => {
    const existing = {
      _id: new mongoose.Types.ObjectId(),
      workflowRef: proposalA,
      monthlySalary: 10000,
      annualSalary: 120000,
      fiscalYear: '2026',
      toObject() { return { ...this }; },
    };
    COSPersonnel.findOne.mockResolvedValue(existing);
    COSPersonnel.findOneAndUpdate.mockImplementation(async (_filter, update) => ({
      ...existing,
      ...update.$set,
    }));
    COSPersonnel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { annualSalary: 144000, premiumAmount: 14400, Total: 158400 },
      ]),
    });

    const req = createRequest({
      params: { id: existing._id.toHexString() },
      body: {
        monthlySalary: 12000,
        annualSalary: 1,
        premiumAmount: 999999,
        Total: 999999,
      },
      hierarchicalFilters: {},
    });
    const res = createResponse();
    await updateCOSPersonnel(req, res);

    const update = COSPersonnel.findOneAndUpdate.mock.calls[0][1].$set;
    expect(update).toMatchObject({
      monthlySalary: 12000,
      annualSalary: 144000,
      baseAnnualAmount: 144000,
      premiumAmount: 14400,
      Total: 158400,
    });
    expect(update.Total).not.toBe(req.body.Total);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('bulk add collapses duplicate VACANT master rows before insertMany', async () => {
    const vacant = {
      EmployeeFullName: 'TO-BE-FILLED',
      ItemNumber: 'COS-007',
      PositionTitle: 'ENGINEER',
      Department: 'OFFICE A',
      Division: 'DIVISION A',
      Region: 'REGION A',
      SG: 10,
      Rate: 10000,
      StatusOfAppointment: 'COS',
    };
    Settings.findOne.mockResolvedValue({ fiscalYear: '2027', budgetType: 'INITIAL' });
    EmployeeMaster.find.mockResolvedValue([vacant, { ...vacant }]);
    COSPersonnel.find
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
      })
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue([]) });
    COSPersonnel.insertMany.mockImplementation(async (rows) => rows);

    const req = createRequest({
      user: { id: 'user-1', FirstName: 'Test', LastName: 'Owner', Roles: ['SUPER_ADMIN'] },
      body: {
        proposalId: proposalA.toHexString(),
        region: 'REGION A',
        processBy: 'Test Owner',
        statusOfAppointment: 'COS',
      },
    });
    const res = createResponse();
    await bulkAddCOSPersonnel(req, res);

    expect(COSPersonnel.insertMany).toHaveBeenCalledTimes(1);
    expect(COSPersonnel.insertMany.mock.calls[0][0]).toHaveLength(1);
    expect(COSPersonnel.insertMany.mock.calls[0][0][0]).toMatchObject({
      employeeNumber: 'VACANT-COS-007',
      workflowRef: proposalA,
      fiscalYear: '2027',
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('bulk row stays ObjectId-scoped through reapply, edit, totals, and delete across two proposals', async () => {
    const workflows = new Map([
      [proposalA.toHexString(), { ...workflow, _id: proposalA, cosJoPremium: { enabled: false, percentage: 10 } }],
      [proposalB.toHexString(), { ...workflow, _id: proposalB, cosJoPremium: { enabled: false, percentage: 10 } }],
    ]);
    const store = [];
    const sameId = (left, right) => String(left) === String(right);
    const matches = (row, query = {}) => Object.entries(query).every(([key, value]) => {
      if (key === 'workflowRef' || key === '_id') return sameId(row[key], value);
      if (key === 'fiscalYear' && value?.$in) return value.$in.map(String).includes(String(row[key]));
      if (value instanceof RegExp) return value.test(String(row[key] || ''));
      if (value?.$regex instanceof RegExp) return value.$regex.test(String(row[key] || ''));
      return String(row[key]) === String(value);
    });
    const rowsFor = (query) => store.filter((row) => matches(row, query));
    const findChain = (query) => ({
      select: () => ({ lean: async () => rowsFor(query) }),
      lean: async () => rowsFor(query),
      session: async () => rowsFor(query),
    });

    NewProposalWorkflow.findById.mockImplementation(async (id) => workflows.get(String(id)) || null);
    NewProposalWorkflow.findByIdAndUpdate.mockImplementation(async (id, update) => {
      const current = workflows.get(String(id));
      const updated = { ...current, cosJoPremium: update.$set.cosJoPremium };
      workflows.set(String(id), updated);
      return updated;
    });
    const activeSettings = { fiscalYear: '2026', budgetType: 'INITIAL' };
    Settings.findOne.mockReturnValue({
      lean: async () => activeSettings,
      then: (resolve) => Promise.resolve(resolve(activeSettings)),
    });
    EmployeeMaster.find.mockResolvedValue([{
      EmployeeID: 'EMP-001',
      EmployeeFullName: 'SAMPLE EMPLOYEE',
      PositionTitle: 'CONSULTANT',
      Department: 'OFFICE A',
      Division: 'DIVISION A',
      Region: 'REGION A',
      SG: 10,
      Rate: 10000,
      StatusOfAppointment: 'COS',
    }]);
    COSPersonnel.find.mockImplementation(findChain);
    COSPersonnel.insertMany.mockImplementation(async (rows) => rows.map((row) => {
      const document = {
        ...row,
        _id: new mongoose.Types.ObjectId(),
        toObject() {
          const plain = { ...this };
          delete plain.toObject;
          return plain;
        },
      };
      store.push(document);
      return document;
    }));
    COSPersonnel.bulkWrite.mockImplementation(async (operations) => {
      operations.forEach(({ updateOne }) => {
        const row = store.find((candidate) => matches(candidate, updateOne.filter));
        if (row) Object.assign(row, updateOne.update.$set);
      });
      return { modifiedCount: operations.length };
    });
    COSPersonnel.findOne.mockImplementation(async (query) => store.find((row) => matches(row, query)) || null);
    COSPersonnel.findOneAndUpdate.mockImplementation(async (query, update) => {
      const row = store.find((candidate) => matches(candidate, query));
      if (!row) return null;
      Object.assign(row, update.$set);
      return row;
    });
    COSPersonnel.deleteOne.mockImplementation(async (query) => {
      const index = store.findIndex((row) => matches(row, query));
      if (index >= 0) store.splice(index, 1);
      return { deletedCount: index >= 0 ? 1 : 0 };
    });

    const bulkRequest = (proposalId) => createRequest({
      user: { id: 'user-1', FirstName: 'Test', LastName: 'Owner', Roles: ['SUPER_ADMIN'] },
      headers: { 'x-workflow-ref': proposalId.toHexString() },
      get: jest.fn(() => proposalId.toHexString()),
      body: {
        proposalId: proposalId.toHexString(),
        region: 'REGION A',
        processBy: 'Test Owner',
        statusOfAppointment: 'COS',
      },
    });
    await bulkAddCOSPersonnel(bulkRequest(proposalA), createResponse());
    await bulkAddCOSPersonnel(bulkRequest(proposalB), createResponse());

    expect(store).toHaveLength(2);
    expect(store.every((row) => row.workflowRef instanceof mongoose.Types.ObjectId)).toBe(true);
    expect(store.map((row) => String(row.workflowRef))).toEqual(expect.arrayContaining([
      proposalA.toHexString(), proposalB.toHexString(),
    ]));

    await updateCOSPremiumSettings(createRequest({
      params: { proposalId: proposalA.toHexString() },
      body: { enabled: true, percentage: 10 },
    }), createResponse());
    const rowA = store.find((row) => sameId(row.workflowRef, proposalA));
    const rowB = store.find((row) => sameId(row.workflowRef, proposalB));
    expect(rowA).toMatchObject({ premiumAmount: 12000, Total: 132000 });
    expect(rowB).toMatchObject({ premiumAmount: 0, Total: 120000 });

    await updateCOSPersonnel(createRequest({
      params: { id: rowA._id.toHexString() },
      body: { monthlySalary: 11000, Total: 1, premiumAmount: 1 },
      hierarchicalFilters: {},
    }), createResponse());
    expect(rowA).toMatchObject({ annualSalary: 132000, premiumAmount: 13200, Total: 145200 });
    expect(rowB).toMatchObject({ annualSalary: 120000, premiumAmount: 0, Total: 120000 });

    const totalResponseA = createResponse();
    await getGrandTotalCOS(createRequest({
      query: { proposalId: proposalA.toHexString(), fiscalYear: '2026' },
      hierarchicalFilters: {},
    }), totalResponseA);
    expect(totalResponseA.json).toHaveBeenCalledWith(expect.objectContaining({ grandTotal: 145200 }));

    const totalResponseB = createResponse();
    await getGrandTotalCOS(createRequest({
      query: { proposalId: proposalB.toHexString(), fiscalYear: '2026' },
      hierarchicalFilters: {},
    }), totalResponseB);
    expect(totalResponseB.json).toHaveBeenCalledWith(expect.objectContaining({ grandTotal: 120000 }));

    await deleteCOSPersonnel(createRequest({
      params: { id: rowA._id.toHexString() },
      hierarchicalFilters: {},
    }), createResponse());
    expect(store).toHaveLength(1);
    expect(store[0].workflowRef.equals(proposalB)).toBe(true);
  });
});
