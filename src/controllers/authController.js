const Teacher = require("../models/Teacher");
const Student = require("../models/Student");
const { sendTeacherTokenResponse, sendStudentTokenResponse } = require("../utils/token");

// ─────────────────────────────────────────────
// TEACHER AUTH
// ─────────────────────────────────────────────

// @desc    Register a new teacher
// @route   POST /api/auth/teacher/register
// @access  Public
const teacherRegister = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existing = await Teacher.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: "Email already registered" });
    }

    const teacher = await Teacher.create({ name, email, password });
    sendTeacherTokenResponse(teacher, 201, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Login teacher
// @route   POST /api/auth/teacher/login
// @access  Public
const teacherLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const teacher = await Teacher.findOne({ email }).select("+password");
    if (!teacher || !(await teacher.comparePassword(password))) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    sendTeacherTokenResponse(teacher, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged-in teacher
// @route   GET /api/auth/teacher/me
// @access  Private (teacher)
const teacherMe = async (req, res) => {
  res.status(200).json({
    success: true,
    role: "teacher",
    user: {
      id: req.teacher._id,
      name: req.teacher.name,
      email: req.teacher.email,
    },
  });
};

// ─────────────────────────────────────────────
// STUDENT AUTH
// ─────────────────────────────────────────────

// @desc    Student self-registration
//          Student must provide rollNumber, class, section + teacher's email to be matched
//          to an existing Student record, then sets their own email+password.
// @route   POST /api/auth/student/register
// @access  Public
const studentRegister = async (req, res, next) => {
  try {
    const { rollNumber, class: cls, section, teacherEmail, email, password } = req.body;

    // Find teacher by email
    const teacher = await Teacher.findOne({ email: teacherEmail });
    if (!teacher) {
      return res.status(404).json({ success: false, message: "No teacher found with that email" });
    }

    // Find the matching student record created by that teacher
    const student = await Student.findOne({
      rollNumber,
      class: cls,
      section: section.toUpperCase(),
      teacher: teacher._id,
      isActive: true,
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "No student record found matching your roll number, class, section and teacher",
      });
    }

    if (student.isRegistered) {
      return res.status(409).json({
        success: false,
        message: "This student account is already registered. Please login instead.",
      });
    }

    // Check email not already taken by another student
    const emailTaken = await Student.findOne({ email: email.toLowerCase() });
    if (emailTaken) {
      return res.status(409).json({ success: false, message: "Email already in use" });
    }

    student.email = email;
    student.password = password;
    student.isRegistered = true;
    await student.save();

    sendStudentTokenResponse(student, 201, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Student login
// @route   POST /api/auth/student/login
// @access  Public
const studentLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const student = await Student.findOne({ email, isActive: true }).select("+password");

    if (!student || !student.isRegistered) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    if (!(await student.comparePassword(password))) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    sendStudentTokenResponse(student, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged-in student
// @route   GET /api/auth/student/me
// @access  Private (student)
const studentMe = async (req, res) => {
  const s = req.student;
  res.status(200).json({
    success: true,
    role: "student",
    user: {
      id: s._id,
      name: s.name,
      email: s.email,
      rollNumber: s.rollNumber,
      class: s.class,
      section: s.section,
    },
  });
};

// ─────────────────────────────────────────────
// LEGACY — keep /api/auth/register + /api/auth/login working as teacher routes
// ─────────────────────────────────────────────
const register = teacherRegister;
const login = teacherLogin;
const getMe = teacherMe;

module.exports = {
  teacherRegister, teacherLogin, teacherMe,
  studentRegister, studentLogin, studentMe,
  register, login, getMe, // legacy aliases
};
