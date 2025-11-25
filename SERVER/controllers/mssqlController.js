const { sequelize, enableMssql } = require('../mssql');
const { Op } = require('sequelize');
const ExternalProposal = require('../mssql/models/ExternalProposal');
let NewProposalWorkflow = null;
try { NewProposalWorkflow = require('../models/NewProposalWorkflow'); } catch (e) { /* optional */ }

// Simple controller to interact with ExternalProposal table in MSSQL.
exports.list = async (req, res) => {
  if (!enableMssql || !ExternalProposal) return res.status(503).json({ success: false, message: 'MSSQL is not enabled or properly configured' });
  try {
    const q = (req.query.q || '').trim();
    const where = {};
    if (q) {
      where[Op.or] = [
        { title: { [Op.like]: `%${q}%` } },
        { externalId: { [Op.eq]: q } }
      ];
    }
    const rows = await ExternalProposal.findAll({ where, limit: Number(req.query.limit || 200), order: [['createdAt', 'DESC']] });
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('[MSSQL] list error:', err.message || err);
    res.status(500).json({ success: false, message: 'Server error', details: err.message });
  }
};

exports.getById = async (req, res) => {
  if (!enableMssql || !ExternalProposal) return res.status(503).json({ success: false, message: 'MSSQL is not enabled or properly configured' });
  try {
    const id = req.params.id;
    const row = await ExternalProposal.findByPk(id);
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[MSSQL] getById error:', err.message || err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  if (!enableMssql || !ExternalProposal) return res.status(503).json({ success: false, message: 'MSSQL is not enabled or properly configured' });
  try {
    const payload = req.body || {};
    const created = await ExternalProposal.create(payload);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('[MSSQL] create error:', err.message || err);
    res.status(500).json({ success: false, message: 'Server error', details: err.message });
  }
};

exports.update = async (req, res) => {
  if (!enableMssql || !ExternalProposal) return res.status(503).json({ success: false, message: 'MSSQL is not enabled or properly configured' });
  try {
    const id = req.params.id;
    const payload = req.body || {};
    const [affected] = await ExternalProposal.update(payload, { where: { id } });
    if (!affected) return res.status(404).json({ success: false, message: 'Not found' });
    const updated = await ExternalProposal.findByPk(id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[MSSQL] update error:', err.message || err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  if (!enableMssql || !ExternalProposal) return res.status(503).json({ success: false, message: 'MSSQL is not enabled or properly configured' });
  try {
    const id = req.params.id;
    const affected = await ExternalProposal.destroy({ where: { id } });
    if (!affected) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    console.error('[MSSQL] remove error:', err.message || err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Example endpoint: merge MSSQL rows with Mongo NewProposalWorkflow doc where possible
exports.listMerged = async (req, res) => {
  if (!enableMssql || !ExternalProposal) return res.status(503).json({ success: false, message: 'MSSQL is not enabled or properly configured' });
  try {
    const rows = await ExternalProposal.findAll({ limit: Number(req.query.limit || 200), order: [['createdAt', 'DESC']] });
    const data = [];
    for (const r of rows) {
      const obj = r.toJSON ? r.toJSON() : r;
      let mongoDoc = null;
      if (NewProposalWorkflow) {
        // Attempt to find matching document by externalId OR title + region
        try {
          mongoDoc = await NewProposalWorkflow.findOne({ $or: [{ externalId: obj.externalId }, { title: obj.title } ] }).lean();
        } catch (err) {
          // ignore
        }
      }
      data.push({ external: obj, workflow: mongoDoc });
    }
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('[MSSQL] listMerged error:', err.message || err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

