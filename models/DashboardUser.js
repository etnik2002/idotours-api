const mongoose = require("mongoose");

const dashboardUserSchema = mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    operator: { type: mongoose.Schema.Types.ObjectId, ref: "Operator", required: true },
    role: { type: String, enum: ["super_admin", "user"], default: "user" },
    permissions: [{ type: String, trim: true }],
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model("DashboardUser", dashboardUserSchema);
