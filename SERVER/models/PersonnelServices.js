// Rename this file to PersonnelServices.js (with capital P)
const mongoose = require("mongoose");
const personnelServicesSchema = new mongoose.Schema(
  {
    date_process: { type: Date, default: Date.now },
    department: String,
    region: String,
    fiscal_year: Number,
    budgetType: String,
    username_process: String,
    status: {
      type: String,
      enum: [
        "Draft",                    // Division working copy
        "Division Submitted",       // Division → Department
        "Department Verified",      // Department technical validation
        "Department Submitted",     // Department → Region  
        "Region Approved",         // Region administrative approval
        "Finalized",               // Ready for execution
        "Returned"                 // Rejected at any level
      ],
      default: "Draft"
    },
        enum: [
          "Draft",                    // Division working copy
          "Division Submitted",       // Division → Department
          "Department Verified",      // Department technical validation
          "Department Submitted",     // Department → Region  
          "Region Approved",         // Region administrative approval
          "Office Approved",         // Office/Budget Officer approval (preferred)
          "Finalized",               // Ready for execution
          "Returned"                 // Rejected at any level
        ],
    // Enhanced workflow tracking
    workflowLevel: {
      type: String,
      enum: ["DIVISION", "DEPARTMENT", "REGION", "FINALIZED"],
      default: "DIVISION"
    },
    lastActionBy: String,
    lastActionDate: { type: Date, default: Date.now },
    departmentVerifiedBy: String,
    departmentVerifiedDate: Date,
    regionApprovedBy: String,
    regionApprovedDate: Date,
    rejectionReason: String,
    submittedDate: { type: Date }, // Date when proposal was submitted
    processBy: {
      type: String,
      required: true,
    },
    processDate: {
      type: Date,
      required: true,
    },
    fiscalYear: {
      type: String,
    },
    itemNumber: {
      type: String,
    },
    positionTitle: {
      type: String,
      required: true,
    },
    gradelevel_SG: {
      type: String,
    },
    step: {
      type: String,
    },
    gradelevel_JG: {
      type: String,
    },
    employeeFullName: {
      type: String,
      required: true,
    },
     DateOfAppointment: {
      type: Date,
      required: true,
    },
    DateOfBirth: {
      type: Date,
      // Not required initially to avoid breaking existing data
      // TODO: Make this required after data migration
    },
    employeeStatus: { type: String, enum: ["Active", "Inactive"], required: true },
    employeeNumber: {
      type: String,
    },
    department: {
      type: String,
      required: true,
    },
    division: {
      type: String,
    },
    section: {
      type: String,
    },
    unit: {
      type: String,
    },
    statusOfAppointment: {
      type: String,
      required: true,
    },
    monthlySalary: {
      type: Number,
      required: true,
    },
    noOfDependent: {
      type: Number,
      required: true,
    },
    hazardPay: {
      type: Number,
      required: true,
    },
    additionalMedical:{
      type: Number,
      required: true,
    },
    subsistenceAllowance: {
      type: Number,
      required: true,
    },
    honoraria: {
      type: Number,
      required: true,
    },
    annualSalary: {
      type: Number,
      required: true,
    },
    RATA: {
      type: Number,
      required: true,
    },
    PERA: {
      type: Number,
      required: true,
    },
    uniformALLOWANCE: {
      type: Number,
      required: true,
    },
    productivityIncentive: {
      type: Number,
      required: true,
    },
    medical: {
      type: Number,
      required: true,
    },
    childrenAllowance: {
      type: Number,
      required: true,
    },
    midyearBonus: {
      type: Number,
      required: true,
    },
    cashGift: {
      type: Number,
      required: true,
    },
    subsistenceAllowanceMDS: {
      type: Number,
      required: true,
    },
    subsistenceAllowanceST: {
      type: Number,
      required: true,
    },
    yearEndBonus: {
      type: Number,
      required: true,
    },
    gsisPremium: {
      type: Number,
      required: true,
    },
    philhealthPremium: {
      type: Number,
      required: true,
    },
    pagibigPremium: {
      type: Number,
      required: true,
    },
    employeeCompensation: {
      type: Number,
      required: true,
    },
    loyaltyAward: {
      type: Number,
    },
    overtimePay: {
      type: Number,
    },
    earnedLeaves: {
      type: Number,
    },
    retirementBenefits: {
      type: Number,
    },
    terminalLeave: {
      type: Number,
    },
courtAppearance: {
      type: Number,
    },
    Total: {
      type: Number,
      required: true,
    },
    subsidyEligible: {
      type: Boolean,
      default: false,
      index: true,
    },
    subsidyAmount: {
      type: Number,
      default: 0,
    },
    subsidyNotes: {
      type: String,
      trim: true,
    },
    subsidyTaggedBy: {
      type: String,
    },
    subsidyTaggedAt: {
      type: Date,
    },
    // Charged to Income fields (for Permanent and Casual employees)
    chargedToIncomeEligible: {
      type: Boolean,
      default: false,
      index: true,
    },
    chargedToIncomeAmount: {
      type: Number,
      default: 0,
    },
    chargedToIncomeSubsidyAmount: {
      type: Number,
      default: 0,
    },
    chargedToIncomeNotes: {
      type: String,
      trim: true,
    },
    chargedToIncomeTaggedBy: {
      type: String,
    },
    chargedToIncomeTaggedAt: {
      type: Date,
    },
    // Workflow audit fields
    divisionApproved: {
      by: { type: String },
      at: { type: Date }
    },
    departmentConsolidated: {
      by: { type: String },
      at: { type: Date }
    },
    departmentSubmitted: {
      by: { type: String },
      at: { type: Date }
    },
    regionFinalVerified: {
      by: { type: String },
      at: { type: Date }
    },
    // Submission workflow tracking fields
    originalLevel: {
      type: String,
      enum: ['DIVISION', 'DEPARTMENT', 'REGION', 'FULL'],
      default: null
    },
    lastWorkflowTransition: {
      type: String,
      enum: ['DIVISION_TO_DEPARTMENT', 'DEPARTMENT_TO_REGION', 'REGION_FINAL_APPROVAL'],
      default: null
    },
    submittedToDepartmentAt: { type: Date },
    submittedToDepartmentBy: { type: String },
    submittedToRegionAt: { type: Date },
    submittedToRegionBy: { type: String },
    finalApprovedAt: { type: Date },
    finalApprovedBy: { type: String },
    submissionNote: { type: String },
    approvalNote: { type: String },
    finalNote: { type: String },
    
    // Link to specific proposal (CRITICAL for distinguishing between proposals)
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Proposal',
      index: true
    },
    workflowRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NewProposalWorkflow',
      index: true
    },
    createdBy: {
      type: String
    }
  },
  { timestamps: true }
);
// Add a pre-save hook to ensure meal is properly set and calculate total
personnelServicesSchema.pre('save', function(next) {
  // If meal is undefined or null, set it to 0
  if (this.meal === undefined || this.meal === null) {
    this.meal = 0;
  }
  // Ensure meal is a number
  this.meal = Number(this.meal);
  
  // Calculate total from all numeric fields (25 components per SUBTOTAL formula)
  const numericFields = [
    "annualSalary", "RATA", "PERA", "uniformALLOWANCE", "productivityIncentive",
    "medical", "childrenAllowance", "meal", "cashGift", 
    "subsistenceAllowance", "subsistenceAllowanceMDS", "subsistenceAllowanceST", "loyaltyAward", "overtimePay",
    "midyearBonus", "yearEndBonus", "gsisPremium", "philhealthPremium", "pagibigPremium", 
    "employeeCompensation", "courtAppearance", "earnedLeaves", "retirementBenefits", 
    "terminalLeave", "hazardPay", "honoraria"
  ];
  
  this.Total = numericFields.reduce(
    (acc, field) => acc + (Number(this[field]) || 0),
    0
  );
  
  next();
});
// Add a static method to reset meal allowance
personnelServicesSchema.statics.resetMealAllowance = async function(employeeNumber, fiscalYear) {
  try {
    const result = await this.updateOne(
      { employeeNumber, fiscalYear },
      { $set: { meal: 0 } }
    );
    // Recalculate total
    const doc = await this.findOne({ employeeNumber, fiscalYear });
    if (doc) {
      // Get all numeric fields (25 components per SUBTOTAL formula)
      const numericFields = [
        "annualSalary", "RATA", "PERA", "uniformALLOWANCE", "productivityIncentive",
        "medical", "childrenAllowance", "meal", "cashGift", 
        "subsistenceAllowance", "subsistenceAllowanceMDS", "subsistenceAllowanceST", "loyaltyAward", "overtimePay",
        "midyearBonus", "yearEndBonus", "gsisPremium", "philhealthPremium", "pagibigPremium", 
        "employeeCompensation", "courtAppearance", "earnedLeaves", "retirementBenefits", 
        "terminalLeave", "hazardPay", "honoraria"
      ];
      // Calculate new total
      doc.Total = numericFields.reduce(
        (acc, field) => acc + (Number(doc[field]) || 0),
        0
      );
      await doc.save();
    }
    return { success: true, result };
  } catch (error) {
    // Error resetting meal allowance
    return { success: false, error };
  }
};
const PersonnelServices = mongoose.models.PersonnelServices || mongoose.model("PersonnelServices", personnelServicesSchema);
module.exports = PersonnelServices;
