const mongoose = require("mongoose");
const discountSettingsSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true,
      default: "ISF_DISCOUNT" 
    },
    discountType: { 
      type: String, 
      enum: ["percentage", "fixed"],
      default: "percentage" 
    },
    discountValue: { 
      type: Number, 
      required: true,
      default: 10 
    },
    applyDiscount: { 
      type: Boolean, 
      default: true 
    },
    fiscalYear: { 
      type: String,
      required: true 
    },
    budgetType: { 
      type: String,
      required: true 
    },
    region: {
      type: String,
      required: true
    },
    processBy: { 
      type: String 
    },
    processDate: { 
      type: Date,
      default: Date.now 
    }
  },
  { timestamps: true }
);
module.exports = mongoose.model("DiscountSettings", discountSettingsSchema);