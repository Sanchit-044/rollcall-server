const express = require("express");
const { body } = require("express-validator");
const {
  markAttendance,
  editAttendance,
  getAttendanceByDate,
  dailyReport,
  studentReport,
} = require("../controllers/attendanceController");
const { protect, requireTeacher } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

const router = express.Router();

// All attendance management is teacher-only
router.use(protect, requireTeacher);

const markAttendanceValidation = [
  body("date").isISO8601().withMessage("Valid date is required (YYYY-MM-DD)"),
  body("class").trim().notEmpty().withMessage("Class is required"),
  body("section").trim().notEmpty().withMessage("Section is required"),
  body("records").isArray({ min: 1 }).withMessage("Records must be a non-empty array"),
  body("records.*.student").notEmpty().withMessage("Each record must have a student ID"),
  body("records.*.status")
    .isIn(["present", "absent"])
    .withMessage("Status must be 'present' or 'absent'"),
];

const editAttendanceValidation = [
  body("records").isArray({ min: 1 }).withMessage("Records must be a non-empty array"),
  body("records.*.student").notEmpty().withMessage("Each record must have a student ID"),
  body("records.*.status")
    .isIn(["present", "absent"])
    .withMessage("Status must be 'present' or 'absent'"),
];

// Report routes must come BEFORE /:id to avoid route conflicts
router.get("/report/daily", dailyReport);
router.get("/report/student/:studentId", studentReport);

router.route("/").get(getAttendanceByDate).post(markAttendanceValidation, validate, markAttendance);
router.route("/:id").put(editAttendanceValidation, validate, editAttendance);

module.exports = router;
