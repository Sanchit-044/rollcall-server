const express = require("express");
const { body, query } = require("express-validator");
const {
  getProfile,
  updateProfile,
  getMyAttendance,
  getMyAttendanceToday,
  getMyTrend,
  getMyMonthlyAttendance,
  getClassSummary,
} = require("../controllers/studentPortalController");
const { protect, requireStudent } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

const router = express.Router();

// All student portal routes require student auth
router.use(protect, requireStudent);

// Profile
router.get("/profile", getProfile);
router.patch(
  "/profile",
  [
    body("email").optional().isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("newPassword")
      .optional()
      .isLength({ min: 6 })
      .withMessage("New password must be at least 6 characters"),
  ],
  validate,
  updateProfile
);

// Attendance
router.get("/attendance", getMyAttendance);
router.get("/attendance/today", getMyAttendanceToday);
router.get("/attendance/trend", getMyTrend);
router.get(
  "/attendance/monthly",
  [
    query("year").notEmpty().isInt().withMessage("year is required"),
    query("month").notEmpty().isInt({ min: 1, max: 12 }).withMessage("month must be 1-12"),
  ],
  validate,
  getMyMonthlyAttendance
);
router.get("/attendance/class-summary", getClassSummary);

module.exports = router;
