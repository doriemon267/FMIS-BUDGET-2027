const mongoose = require("mongoose");

const TestSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: String,
    likes: {
      type: Number,
      default: 0,
    },
    isPublish: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Test = mongoose.model("Test", TestSchema);

module.exports = Test;
