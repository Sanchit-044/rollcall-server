const Attendance = require("../models/Attendance");
const Student = require("../models/Student");

// Helper: normalize a date to UTC midnight
const normalizeDate = (dateStr) => {
  const d = new Date(dateStr);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

// @desc    Mark attendance for a class+section on a given date
// @route   POST /api/attendance
// @access  Private
const markAttendance = async (req, res, next) => {
  try {
    const { date, class: cls, section, records } = req.body;
    // records: [{ student: <id>, status: "present"|"absent" }]

    const normalizedDate = normalizeDate(date);

    // Check for duplicate attendance (same class/section/date/teacher)
    const existing = await Attendance.findOne({
      date: normalizedDate,
      class: cls,
      section: section.toUpperCase(),
      teacher: req.teacher._id,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Attendance already marked for this class/section on this date. Use PUT to edit.",
      });
    }

    // Verify all student IDs belong to this teacher
    const studentIds = records.map((r) => r.student);
    const students = await Student.find({
      _id: { $in: studentIds },
      teacher: req.teacher._id,
      isActive: true,
    });

    if (students.length !== studentIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more student IDs are invalid or do not belong to you.",
      });
    }

    const attendance = await Attendance.create({
      date: normalizedDate,
      class: cls,
      section: section.toUpperCase(),
      teacher: req.teacher._id,
      records,
    });

    const populated = await attendance.populate("records.student", "name rollNumber");
    res.status(201).json({ success: true, attendance: populated });
  } catch (error) {
    next(error);
  }
};

// @desc    Edit existing attendance
// @route   PUT /api/attendance/:id
// @access  Private
const editAttendance = async (req, res, next) => {
  try {
    const { records } = req.body;

    const attendance = await Attendance.findOne({
      _id: req.params.id,
      teacher: req.teacher._id,
    });

    if (!attendance) {
      return res.status(404).json({ success: false, message: "Attendance record not found" });
    }

    // Verify all student IDs
    const studentIds = records.map((r) => r.student);
    const students = await Student.find({
      _id: { $in: studentIds },
      teacher: req.teacher._id,
      isActive: true,
    });

    if (students.length !== studentIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more student IDs are invalid.",
      });
    }

    attendance.records = records;
    await attendance.save();

    const populated = await attendance.populate("records.student", "name rollNumber");
    res.status(200).json({ success: true, attendance: populated });
  } catch (error) {
    next(error);
  }
};

// @desc    Get attendance by date (and optionally class/section)
// @route   GET /api/attendance?date=&class=&section=
// @access  Private
const getAttendanceByDate = async (req, res, next) => {
  try {
    const { date, class: cls, section } = req.query;

    if (!date) {
      return res.status(400).json({ success: false, message: "Date query param is required" });
    }

    const filter = {
      date: normalizeDate(date),
      teacher: req.teacher._id,
    };
    if (cls) filter.class = cls;
    if (section) filter.section = section.toUpperCase();

    const records = await Attendance.find(filter).populate(
      "records.student",
      "name rollNumber class section"
    );

    res.status(200).json({ success: true, count: records.length, records });
  } catch (error) {
    next(error);
  }
};

// @desc    Daily attendance report for a class+section on a date
// @route   GET /api/attendance/report/daily?date=&class=&section=
// @access  Private
const dailyReport = async (req, res, next) => {
  try {
    const { date, class: cls, section } = req.query;

    if (!date || !cls || !section) {
      return res.status(400).json({
        success: false,
        message: "date, class and section query params are required",
      });
    }

    const record = await Attendance.findOne({
      date: normalizeDate(date),
      class: cls,
      section: section.toUpperCase(),
      teacher: req.teacher._id,
    }).populate("records.student", "name rollNumber");

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "No attendance found for this date/class/section",
      });
    }

    const presentList = record.records.filter((r) => r.status === "present");
    const absentList = record.records.filter((r) => r.status === "absent");

    res.status(200).json({
      success: true,
      report: {
        date: record.date,
        class: record.class,
        section: record.section,
        totalStudents: record.records.length,
        totalPresent: presentList.length,
        totalAbsent: absentList.length,
        attendancePercentage:
          record.records.length > 0
            ? ((presentList.length / record.records.length) * 100).toFixed(2)
            : "0.00",
        presentStudents: presentList.map((r) => r.student),
        absentStudents: absentList.map((r) => r.student),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Per-student attendance report (all time or date range)
// @route   GET /api/attendance/report/student/:studentId?from=&to=
// @access  Private
const studentReport = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { from, to } = req.query;

    const student = await Student.findOne({
      _id: studentId,
      teacher: req.teacher._id,
    });

    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const dateFilter = {};
    if (from) dateFilter.$gte = normalizeDate(from);
    if (to) dateFilter.$lte = normalizeDate(to);

    const query = {
      teacher: req.teacher._id,
      class: student.class,
      section: student.section,
      "records.student": studentId,
      ...(Object.keys(dateFilter).length && { date: dateFilter }),
    };

    const attendanceRecords = await Attendance.find(query).sort({ date: 1 });

    let totalPresent = 0;
    let totalAbsent = 0;
    const breakdown = [];

    attendanceRecords.forEach((rec) => {
      const entry = rec.records.find((r) => r.student.toString() === studentId);
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
        student: {
          id: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          class: student.class,
          section: student.section,
        },
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

module.exports = {
  markAttendance,
  editAttendance,
  getAttendanceByDate,
  dailyReport,
  studentReport,
};
