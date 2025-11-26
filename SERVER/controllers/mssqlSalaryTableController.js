const { sequelize, enableMssql } = require('../mssql');
const { Op } = require('sequelize');
const SalaryTable = require('../mssql/models/SalaryTable');

exports.list = async (req, res) => {
  if (!enableMssql || !SalaryTable) return res.status(503).json({ success: false, message: 'MSSQL is not enabled or properly configured' });
  try {
    console.log('[MSSQL] salaryTable.list called', { query: req.query, params: req.params, user: req.user && { id: req.user.id, roles: req.user.Roles } });
    const q = (req.query.q || '').trim();
    const where = {};
    const { SG, JG, StatusOfAppointment, Source, EncodedBy } = req.query;
    const monthlyMin = req.query.MonthlyRate_min ? Number(req.query.MonthlyRate_min) : null;
    const monthlyMax = req.query.MonthlyRate_max ? Number(req.query.MonthlyRate_max) : null;
    const dailyMin = req.query.DailyRate_min ? Number(req.query.DailyRate_min) : null;
    const dailyMax = req.query.DailyRate_max ? Number(req.query.DailyRate_max) : null;
    const encodedDateFrom = req.query.EncodedDate_from ? new Date(req.query.EncodedDate_from) : null;
    const encodedDateTo = req.query.EncodedDate_to ? new Date(req.query.EncodedDate_to) : null;
    // Optional filters (safe, pluralization from client): SG, JG, StatusOfAppointment
    if (SG) where.SG = Number(SG);
    if (JG) where.JG = Number(JG);
    if (StatusOfAppointment) where.StatusOfAppointment = StatusOfAppointment;
    if (Source) where.Source = { [Op.like]: `%${Source}%` };
    if (EncodedBy) where.EncodedBy = { [Op.like]: `%${EncodedBy}%` };
    if (monthlyMin !== null || monthlyMax !== null) {
      where.MonthlyRate = {};
      if (monthlyMin !== null) where.MonthlyRate[Op.gte] = monthlyMin;
      if (monthlyMax !== null) where.MonthlyRate[Op.lte] = monthlyMax;
    }
    if (dailyMin !== null || dailyMax !== null) {
      where.DailyRate = {};
      if (dailyMin !== null) where.DailyRate[Op.gte] = dailyMin;
      if (dailyMax !== null) where.DailyRate[Op.lte] = dailyMax;
    }
    if (encodedDateFrom || encodedDateTo) {
      where.EncodedDate = {};
      if (encodedDateFrom) where.EncodedDate[Op.gte] = encodedDateFrom;
      if (encodedDateTo) where.EncodedDate[Op.lte] = encodedDateTo;
    }
    if (q) {
      // Search across multiple columns for convenience
      const like = { [Op.like]: `%${q}%` };
      const qNum = Number(q);
      const isNumeric = !Number.isNaN(qNum);
      const orArray = [
        { Source: like },
        { EncodedBy: like },
        { StatusOfAppointment: like },
        { Id: { [Op.like]: `%${q}%` } }
      ];
      if (isNumeric) {
        // If q is numeric, add numeric equality matches
        orArray.push({ SG: qNum });
        orArray.push({ JG: qNum });
        orArray.push({ SG_Step: qNum });
        orArray.push({ JG_Step: qNum });
        orArray.push({ MonthlyRate: qNum });
        orArray.push({ DailyRate: qNum });
      }
      where[Op.or] = orArray;
    }
    const limit = Math.min(1000, Number(req.query.limit || 200));
    const offset = Math.max(0, Number(req.query.offset || 0));
    // Use findAndCountAll to return total count for pagination UI
    // Default ordering: StatusOfAppointment, SG, JG, Source
    const sortField = req.query.sortField || null;
    const sortDirection = (req.query.sortDir || 'ASC').toUpperCase();
    let order = [
      ['StatusOfAppointment', 'ASC'],
      ['SG', 'ASC'],
      ['JG', 'ASC'],
      ['Source', 'ASC']
    ];
    if (sortField) {
      order = [[sortField, sortDirection === 'DESC' ? 'DESC' : 'ASC']];
    }
    const result = await SalaryTable.findAndCountAll({ where, limit, offset, order });
    // Normalize rows: convert Sequelize instances to plain objects and ensure numeric MonthlyRate/DailyRate
    const rows = result.rows.map((r) => {
      const plain = r.get ? r.get({ plain: true }) : r;
      // Try various property names and convert DECIMAL string to Number
      const monthlyRaw = plain.MonthlyRate ?? plain.monthlyRate ?? plain.Monthly ?? plain.monthly ?? plain.Monthly_Rate ?? plain.monthly_rate;
      const dailyRaw = plain.DailyRate ?? plain.dailyRate ?? plain.Daily ?? plain.daily ?? plain.Daily_Rate ?? plain.daily_rate;
      let monthly = monthlyRaw !== undefined && monthlyRaw !== null && monthlyRaw !== '' ? Number(monthlyRaw) : null;
      let daily = dailyRaw !== undefined && dailyRaw !== null && dailyRaw !== '' ? Number(dailyRaw) : null;
      // Compute daily from monthly if missing (assume 22 working days)
      if ((daily === null || Number.isNaN(daily)) && monthly !== null && !Number.isNaN(monthly)) {
        daily = monthly / 22;
      }
      // Compute monthly from daily if missing (assume 22 working days)
      if ((monthly === null || Number.isNaN(monthly)) && daily !== null && !Number.isNaN(daily)) {
        monthly = daily * 22;
      }
      return {
        ...plain,
        MonthlyRate: monthly,
        DailyRate: daily,
      };
    });
    const totalCount = Number(result.count || 0);
    // Debug: sample keys and values for debugging client behavior
    if (rows && rows.length > 0) {
      console.debug('[MSSQL] salaryTable sample keys:', Object.keys(rows[0]));
      console.debug('[MSSQL] salaryTable sample MonthlyRate/DailyRate:', rows[0]?.MonthlyRate, rows[0]?.DailyRate);
    }
    res.json({ success: true, count: totalCount, data: rows });
  } catch (err) {
    console.error('[MSSQL] salaryTable list error:', err.stack || err.message || err);
    console.error('Request details:', { query: req.query, params: req.params, body: req.body, headers: req.headers });
    res.status(500).json({ success: false, message: 'Server error', details: err.message });
  }
};

exports.getById = async (req, res) => {
  if (!enableMssql || !SalaryTable) return res.status(503).json({ success: false, message: 'MSSQL is not enabled or properly configured' });
  try {
    const id = req.params.id;
    const row = await SalaryTable.findByPk(id);
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[MSSQL] salaryTable getById error:', err.message || err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Optional: simple search by Id, plus count
exports.search = async (req, res) => {
  if (!enableMssql || !SalaryTable) return res.status(503).json({ success: false, message: 'MSSQL is not enabled or properly configured' });
  try {
    const q = (req.query.q || '').trim();
    const where = {};
    if (!q) return res.status(400).json({ success: false, message: 'q param required' });
    const like = { [Op.like]: `%${q}%` };
    const qNum = Number(q);
    const orArray = [{ Source: like }, { EncodedBy: like }, { Id: like }];
    if (!Number.isNaN(qNum)) {
      orArray.push({ Id: qNum });
    }
    where[Op.or] = orArray;
    const rows = await SalaryTable.findAll({ where, limit: 200 });
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('[MSSQL] salaryTable search error:', err.message || err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
