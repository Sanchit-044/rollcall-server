const express = require("express");
const { body } = require("express-validator");
const {
  teacherRegister, teacherLogin, teacherMe,
  studentRegister, studentLogin, studentMe,
  // legacy
  register, login, getMe,
} = require("../controllers/authController");
const { protect, requireTeacher, requireStudent } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

const router = express.Router();

const emailPassword = [
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

// ── Teacher auth ──────────────────────────────
router.post(
  "/teacher/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    ...emailPassword,
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  ],
  validate,
  teacherRegister
);

router.post("/teacher/login", emailPassword, validate, teacherLogin);
router.get("/teacher/me", protect, requireTeacher, teacherMe);

// ── Student auth ──────────────────────────────
router.post(
  "/student/register",
  [
    body("rollNumber").trim().notEmpty().withMessage("Roll number is required"),
    body("class").trim().notEmpty().withMessage("Class is required"),
    body("section").trim().notEmpty().withMessage("Section is required"),
    body("teacherEmail").isEmail().withMessage("Valid teacher email is required").normalizeEmail(),
    body("email").isEmail().withMessage("Valid student email is required").normalizeEmail(),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  ],
  validate,
  studentRegister
);

router.post("/student/login", emailPassword, validate, studentLogin);
router.get("/student/me", protect, requireStudent, studentMe);

// ── Legacy aliases (backwards compat) ────────
router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    ...emailPassword,
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  ],
  validate,
  register
);
router.post("/login", emailPassword, validate, login);
router.get("/me", protect, requireTeacher, getMe);

module.exports = router;
