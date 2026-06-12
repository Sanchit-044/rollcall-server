const Attendance = require("../models/Attendance");
const Student = require("../models/Student");

// @desc    Get dashboard summary for logged-in teacher
// @route   GET /api/dashboard
// @access  Private
const getDashboard = async (req, res, next) => {
  try {
    const teacherId = req.teacher._id;

    // Total active students
    const totalStudents = await Student.countDocuments({
      teacher: teacherId,
      isActive: true,
    });

    // Today's date (UTC midnight)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Get today's attendance records
    const todayRecords = await Attendance.find({
      teacher: teacherId,
      date: today,
    });

    let presentToday = 0;
    let absentToday = 0;

    todayRecords.forEach((rec) => {
      rec.records.forEach((r) => {
        if (r.status === "present") presentToday++;
        else absentToday++;
      });
    });

    const totalMarkedToday = presentToday + absentToday;
    const attendancePercentageToday =
      totalMarkedToday > 0
        ? ((presentToday / totalMarkedToday) * 100).toFixed(2)
        : "0.00";

    // 7-day trend
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);

    const weekRecords = await Attendance.find({
      teacher: teacherId,
      date: { $gte: sevenDaysAgo, $lte: today },
    });

    // Build a map keyed by date string
    const trendMap = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setUTCDate(d.getUTCDate() + i);
      const key = d.toISOString().split("T")[0];
      trendMap[key] = { date: key, present: 0, absent: 0, percentage: "0.00" };
    }

    weekRecords.forEach((rec) => {
      const key = rec.date.toISOString().split("T")[0];
      if (trendMap[key]) {
        rec.records.forEach((r) => {
          if (r.status === "present") trendMap[key].present++;
          else trendMap[key].absent++;
        });
      }
    });

    // Calculate percentages for trend
    Object.values(trendMap).forEach((day) => {
      const total = day.present + day.absent;
      day.percentage = total > 0 ? ((day.present / total) * 100).toFixed(2) : "0.00";
    });

    res.status(200).json({
      success: true,
      dashboard: {
        totalStudents,
        presentToday,
        absentToday,
        attendancePercentageToday,
        sevenDayTrend: Object.values(trendMap),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboard };
