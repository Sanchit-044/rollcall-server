const jwt = require("jsonwebtoken");
const Teacher = require("../models/Teacher");
const Student = require("../models/Student");

/**
 * protect — verifies JWT and attaches req.user + req.role.
 * Works for both teachers and students.
 */
const protect = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. No token provided.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const role = decoded.role || "teacher"; // backwards-compat with old tokens

    if (role === "teacher") {
      const teacher = await Teacher.findById(decoded.id);
      if (!teacher) {
        return res.status(401).json({ success: false, message: "User no longer exists." });
      }
      req.user = teacher;
      req.teacher = teacher; // keep backwards compat for existing teacher controllers
      req.role = "teacher";
    } else if (role === "student") {
      const student = await Student.findById(decoded.id);
      if (!student || !student.isActive) {
        return res.status(401).json({ success: false, message: "User no longer exists." });
      }
      req.user = student;
      req.student = student;
      req.role = "student";
    } else {
      return res.status(401).json({ success: false, message: "Invalid token role." });
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token." });
  }
};

/**
 * requireTeacher — must be used AFTER protect.
 * Rejects students from teacher-only routes.
 */
const requireTeacher = (req, res, next) => {
  if (req.role !== "teacher") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Teachers only.",
    });
  }
  next();
};

/**
 * requireStudent — must be used AFTER protect.
 * Rejects teachers from student-only routes.
 */
const requireStudent = (req, res, next) => {
  if (req.role !== "student") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Students only.",
    });
  }
  next();
};

module.exports = { protect, requireTeacher, requireStudent };
