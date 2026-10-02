const jwt = require("jsonwebtoken");
const DashboardUser = require("../models/DashboardUser");
const { unauthorized } = require("../functions/responses");

const authenticateDashboardUser = async (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  const accountId = payload?.data?.accountId;
  if (!accountId) return null;
  return DashboardUser.findById(accountId).select("-password");
};

const verifyDashboardUser = async (req, res, next) => {
  try {
    const account = await authenticateDashboardUser(req, res);
    if (!account || !account.isActive) {
      return unauthorized(res, "Dashboard account is disabled or unavailable", null);
    }
    req.dashboardUser = account;
    next();
  } catch (error) {
    return unauthorized(res, "Invalid or expired token", null);
  }
};

const verifyDashboardSuperAdmin = async (req, res, next) => {
  try {
    const account = await authenticateDashboardUser(req, res);
    if (!account || !account.isActive || account.role !== "super_admin") {
      return unauthorized(res, "Super admin access required", null);
    }

    req.dashboardUser = account;
    next();
  } catch (error) {
    return unauthorized(res, "Invalid or expired token", null);
  }
};

module.exports = { verifyDashboardUser, verifyDashboardSuperAdmin };
