const express = require("express");
const { body } = require("express-validator");
const {
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  resetStudentCredentials,
} = require("../controllers/studentController");
const { protect, requireTeacher } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

const router = express.Router();

// All routes below are teacher-only
router.use(protect, requireTeacher);

const studentValidation = [
  body("name").trim().notEmpty().withMessage("Student name is required"),
  body("rollNumber").trim().notEmpty().withMessage("Roll number is required"),
  body("class").trim().notEmpty().withMessage("Class is required"),
  body("section").trim().notEmpty().withMessage("Section is required"),
];

router.route("/").get(getStudents).post(studentValidation, validate, createStudent);
router.route("/:id").get(getStudent).put(studentValidation, validate, updateStudent).delete(deleteStudent);
router.patch("/:id/reset-credentials", resetStudentCredentials);

module.exports = router;
