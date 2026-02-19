const mongoose = require("mongoose");

/**
 * Settings for which appointment types use which salary source.
 *
 * PERMANENT at CASUAL: Magkasama sa isang salary table (SalarySelection).
 *   - CPCS 1: lookup by Job Grade + Step
 *   - CPCS 2: lookup by Salary Grade + Step
 *
 * COS: Hiwalay na table (CPCS II Rate / SSL4, Fourth-Tranche SSL Law Jan 1 2019).
 *   Hindi kasama sa CPCS 1 o CPCS 2.
 */
const CPCSSalarySettingsSchema = new mongoose.Schema({
  // If true, COS employees use SSL4 table (Fourth Tranche); otherwise manual rate
  useCPCSForEmployeeAdd: { type: Boolean, default: false },
  // Appointment types using CPCS 1 (Job Grade + Step) — shared salary table
  cpcs1AppointmentTypes: [{ type: String }], // e.g. ["CASUAL"]
  // Appointment types using CPCS 2 (Salary Grade + Step) — shared salary table
  cpcs2AppointmentTypes: [{ type: String }], // e.g. ["PERMANENT"]
  // COS uses SSL4 table (hiwalay); COS hindi kasama sa CPCS 1 o 2
  cosUsesCPCSIIRate: { type: Boolean, default: true },
  // When employee Status is Inactive and appointment uses CPCS 1, use CPCS 1 for rate
  inactiveUsesCPCS1: { type: Boolean, default: true },
}, { timestamps: true });

// Single-document settings (we use findOne and update)
module.exports = mongoose.model("CPCSSalarySettings", CPCSSalarySettingsSchema);
