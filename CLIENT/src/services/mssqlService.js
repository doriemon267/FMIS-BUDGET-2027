import api from '../config/api';

/**
 * MSSQL service for SalaryTable operations
 */
export const getSalaryTable = async ({ q = '', limit = 200, offset = 0, SG, JG, StatusOfAppointment, Source, EncodedBy, MonthlyRate_min, MonthlyRate_max, DailyRate_min, DailyRate_max, EncodedDate_from, EncodedDate_to, sortField, sortDir } = {}) => {
  const params = { q, limit, offset };
  if (SG) params.SG = SG;
  if (JG) params.JG = JG;
  if (StatusOfAppointment) params.StatusOfAppointment = StatusOfAppointment;
  if (Source) params.Source = Source;
  if (EncodedBy) params.EncodedBy = EncodedBy;
  if (MonthlyRate_min) params.MonthlyRate_min = MonthlyRate_min;
  if (MonthlyRate_max) params.MonthlyRate_max = MonthlyRate_max;
  if (DailyRate_min) params.DailyRate_min = DailyRate_min;
  if (DailyRate_max) params.DailyRate_max = DailyRate_max;
  if (EncodedDate_from) params.EncodedDate_from = EncodedDate_from?.toISOString?.() || EncodedDate_from;
  if (EncodedDate_to) params.EncodedDate_to = EncodedDate_to?.toISOString?.() || EncodedDate_to;
  if (sortField) params.sortField = sortField;
  if (sortDir) params.sortDir = sortDir;
  const res = await api.get('/api/mssql/salarytable', { params });
  return res.data;
};

export const getSalaryTableById = async (id) => {
  const res = await api.get(`/api/mssql/salarytable/${id}`);
  return res.data;
};
