const jwt = require("jsonwebtoken");

/**
 * Generate a JWT for either a teacher or student.
 * Payload includes: { id, role }
 */
const generateToken = (id, role = "teacher") => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

const sendTeacherTokenResponse = (teacher, statusCode, res) => {
  const token = generateToken(teacher._id, "teacher");
  res.status(statusCode).json({
    success: true,
    token,
    role: "teacher",
    user: {
      id: teacher._id,
      name: teacher.name,
      email: teacher.email,
    },
  });
};

const sendStudentTokenResponse = (student, statusCode, res) => {
  const token = generateToken(student._id, "student");
  res.status(statusCode).json({
    success: true,
    token,
    role: "student",
    user: {
      id: student._id,
      name: student.name,
      email: student.email,
      rollNumber: student.rollNumber,
      class: student.class,
      section: student.section,
    },
  });
};

module.exports = { generateToken, sendTeacherTokenResponse, sendStudentTokenResponse };
