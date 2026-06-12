const Attendance = require("../models/Attendance");
const Student = require("../models/Student");

// Helper: normalize a date to UTC midnight
const normalizeDate = (dateStr) => {
  const d = new Date(dateStr);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

// ─────────────────────────────────────────────
// STUDENT PORTAL — all routes use req.student (set by protect middleware)
// ─────────────────────────────────────────────

// @desc    Get student's own profile
// @route   GET /api/student/profile
// @access  Private (student)
const getProfile = async (req, res, next) => {
  try {
    const student = await Student.findById(req.student._id)
      .select("-password")
      .populate("teacher", "name email");

    res.status(200).json({ success: true, student });
  } catch (error) {
    next(error);
  }
};

// @desc    Update own profile (email or password only)
// @route   PATCH /api/student/profile
// @access  Private (student)
const updateProfile = async (req, res, next) => {
  try {
    const { email, currentPassword, newPassword } = req.body;
    const student = await Student.findById(req.student._id).select("+password");

    // Update email if provided
    if (email && email !== student.email) {
      const taken = await Student.findOne({ email: email.toLowerCase(), _id: { $ne: student._id } });
      if (taken) {
        return res.status(409).json({ success: false, message: "Email already in use" });
      }
      student.email = email;
    }

    // Update password if provided
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: "Current password is required to set a new password",
        });
      }
      const isMatch = await student.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: "Current password is incorrect" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "New password must be at least 6 characters",
        });
      }
      student.password = newPassword;
    }

    await student.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: student._id,
        name: student.name,
        email: student.email,
        rollNumber: student.rollNumber,
        class: student.class,
        section: student.section,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get student's own attendance summary (overall stats + date range filter)
// @route   GET /api/student/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD
// @access  Private (student)
const getMyAttendance = async (req, res, next) => {
  try {
    const student = req.student;
    const { from, to } = req.query;

    const dateFilter = {};
    if (from) dateFilter.$gte = normalizeDate(from);
    if (to) dateFilter.$lte = normalizeDate(to);

    const query = {
      teacher: student.teacher,
      class: student.class,
      section: student.section,
      "records.student": student._id,
      ...(Object.keys(dateFilter).length && { date: dateFilter }),
    };

    const attendanceRecords = await Attendance.find(query).sort({ date: 1 });

    let totalPresent = 0;
    let totalAbsent = 0;
    const breakdown = [];

    attendanceRecords.forEach((rec) => {
      const entry = rec.records.find((r) => r.student.toString() === student._id.toString());
      if (entry) {
        if (entry.status === "present") totalPresent++;
        else totalAbsent++;
        breakdown.push({ date: rec.date, status: entry.status });
      }
    });

    const totalDays = totalPresent + totalAbsent;

    res.status(200).json({
      success: true,
      report: {
        totalPresentDays: totalPresent,
        totalAbsentDays: totalAbsent,
        totalDays,
        attendancePercentage:
          totalDays > 0 ? ((totalPresent / totalDays) * 100).toFixed(2) : "0.00",
        breakdown,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get today's attendance status for the logged-in student
// @route   GET /api/student/attendance/today
// @access  Private (student)
const getMyAttendanceToday = async (req, res, next) => {
  try {
    const student = req.student;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const record = await Attendance.findOne({
      teacher: student.teacher,
      class: student.class,
      section: student.section,
      date: today,
      "records.student": student._id,
    });

    if (!record) {
      return res.status(200).json({
        success: true,
        date: today,
        status: "not_marked",
        message: "Attendance has not been marked yet for today",
      });
    }

    const entry = record.records.find((r) => r.student.toString() === student._id.toString());

    res.status(200).json({
      success: true,
      date: today,
      status: entry ? entry.status : "not_marked",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get student's 7-day attendance trend
// @route   GET /api/student/attendance/trend
// @access  Private (student)
const getMyTrend = async (req, res, next) => {
  try {
    const student = req.student;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);

    const records = await Attendance.find({
      teacher: student.teacher,
      class: student.class,
      section: student.section,
      date: { $gte: sevenDaysAgo, $lte: today },
      "records.student": student._id,
    }).sort({ date: 1 });

    // Pre-fill all 7 days
    const trendMap = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setUTCDate(d.getUTCDate() + i);
      const key = d.toISOString().split("T")[0];
      trendMap[key] = { date: key, status: "not_marked" };
    }

    records.forEach((rec) => {
      const key = rec.date.toISOString().split("T")[0];
      const entry = rec.records.find((r) => r.student.toString() === student._id.toString());
      if (entry && trendMap[key]) {
        trendMap[key].status = entry.status;
      }
    });

    res.status(200).json({
      success: true,
      trend: Object.values(trendMap),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get student's monthly attendance summary
// @route   GET /api/student/attendance/monthly?year=2024&month=6
// @access  Private (student)
const getMyMonthlyAttendance = async (req, res, next) => {
  try {
    const student = req.student;
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ success: false, message: "year and month query params are required" });
    }

    const y = parseInt(year);
    const m = parseInt(month) - 1; // 0-indexed
    const from = new Date(Date.UTC(y, m, 1));
    const to = new Date(Date.UTC(y, m + 1, 0)); // last day of month

    const records = await Attendance.find({
      teacher: student.teacher,
      class: student.class,
      section: student.section,
      date: { $gte: from, $lte: to },
      "records.student": student._id,
    }).sort({ date: 1 });

    let totalPresent = 0;
    let totalAbsent = 0;
    const days = [];

    records.forEach((rec) => {
      const entry = rec.records.find((r) => r.student.toString() === student._id.toString());
      if (entry) {
        if (entry.status === "present") totalPresent++;
        else totalAbsent++;
        days.push({ date: rec.date.toISOString().split("T")[0], status: entry.status });
      }
    });

    const totalDays = totalPresent + totalAbsent;

    res.status(200).json({
      success: true,
      month: `${y}-${String(parseInt(month)).padStart(2, "0")}`,
      summary: {
        totalPresentDays: totalPresent,
        totalAbsentDays: totalAbsent,
        totalDays,
        attendancePercentage:
          totalDays > 0 ? ((totalPresent / totalDays) * 100).toFixed(2) : "0.00",
      },
      days,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get classmates' attendance for a given date (own class/section only, no names of others)
//          Useful for student to see "how many were present today" without exposing others' data
// @route   GET /api/student/attendance/class-summary?date=YYYY-MM-DD
// @access  Private (student)
const getClassSummary = async (req, res, next) => {
  try {
    const student = req.student;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ success: false, message: "date query param is required" });
    }

    const record = await Attendance.findOne({
      teacher: student.teacher,
      class: student.class,
      section: student.section,
      date: normalizeDate(date),
    });

    if (!record) {
      return res.status(200).json({
        success: true,
        date: normalizeDate(date),
        message: "No attendance data for this date",
        summary: null,
      });
    }

    const totalStudents = record.records.length;
    const presentCount = record.records.filter((r) => r.status === "present").length;
    const absentCount = totalStudents - presentCount;

    // Find own status within this record
    const myEntry = record.records.find((r) => r.student.toString() === student._id.toString());

    res.status(200).json({
      success: true,
      date: record.date,
      class: record.class,
      section: record.section,
      myStatus: myEntry ? myEntry.status : "not_marked",
      summary: {
        totalStudents,
        presentCount,
        absentCount,
        attendancePercentage:
          totalStudents > 0 ? ((presentCount / totalStudents) * 100).toFixed(2) : "0.00",
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getMyAttendance,
  getMyAttendanceToday,
  getMyTrend,
  getMyMonthlyAttendance,
  getClassSummary,
};
