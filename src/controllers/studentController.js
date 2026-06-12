const Student = require("../models/Student");

// ─────────────────────────────────────────────
// TEACHER-FACING: full CRUD
// ─────────────────────────────────────────────

// @desc    Get all students for logged-in teacher
// @route   GET /api/students
// @access  Private (teacher)
const getStudents = async (req, res, next) => {
  try {
    const { class: cls, section, search } = req.query;
    const filter = { teacher: req.teacher._id, isActive: true };

    if (cls) filter.class = cls;
    if (section) filter.section = section.toUpperCase();
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { rollNumber: { $regex: search, $options: "i" } },
      ];
    }

    const students = await Student.find(filter)
      .select("-password")
      .sort({ class: 1, section: 1, rollNumber: 1 });

    res.status(200).json({ success: true, count: students.length, students });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single student by ID
// @route   GET /api/students/:id
// @access  Private (teacher)
const getStudent = async (req, res, next) => {
  try {
    const student = await Student.findOne({
      _id: req.params.id,
      teacher: req.teacher._id,
    }).select("-password");

    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    res.status(200).json({ success: true, student });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a student (teacher creates the record; student registers separately)
// @route   POST /api/students
// @access  Private (teacher)
const createStudent = async (req, res, next) => {
  try {
    const { name, rollNumber, class: cls, section } = req.body;

    const student = await Student.create({
      name,
      rollNumber,
      class: cls,
      section,
      teacher: req.teacher._id,
    });

    res.status(201).json({ success: true, student });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a student
// @route   PUT /api/students/:id
// @access  Private (teacher)
const updateStudent = async (req, res, next) => {
  try {
    const { name, rollNumber, class: cls, section } = req.body;

    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, teacher: req.teacher._id },
      { name, rollNumber, class: cls, section },
      { new: true, runValidators: true }
    ).select("-password");

    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    res.status(200).json({ success: true, student });
  } catch (error) {
    next(error);
  }
};

// @desc    Soft-delete a student
// @route   DELETE /api/students/:id
// @access  Private (teacher)
const deleteStudent = async (req, res, next) => {
  try {
    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, teacher: req.teacher._id },
      { isActive: false },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    res.status(200).json({ success: true, message: "Student deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// @desc    Teacher resets a student's login credentials
//          (useful if student forgets password or hasn't registered yet)
// @route   PATCH /api/students/:id/reset-credentials
// @access  Private (teacher)
const resetStudentCredentials = async (req, res, next) => {
  try {
    const student = await Student.findOne({
      _id: req.params.id,
      teacher: req.teacher._id,
      isActive: true,
    });

    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    // Clear credentials so student must re-register
    student.email = undefined;
    student.password = undefined;
    student.isRegistered = false;
    await student.save();

    res.status(200).json({
      success: true,
      message: "Student credentials reset. Student can now re-register.",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  resetStudentCredentials,
};
