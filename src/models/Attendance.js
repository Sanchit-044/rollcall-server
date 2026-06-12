const mongoose = require("mongoose");

const attendanceRecordSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  },
  status: {
    type: String,
    enum: ["present", "absent"],
    required: true,
  },
});

const attendanceSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, "Date is required"],
    },
    class: {
      type: String,
      required: [true, "Class is required"],
      trim: true,
    },
    section: {
      type: String,
      required: [true, "Section is required"],
      trim: true,
      uppercase: true,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    records: [attendanceRecordSchema],
  },
  { timestamps: true }
);

// Prevent duplicate attendance for same class+section+date by same teacher
attendanceSchema.index(
  { date: 1, class: 1, section: 1, teacher: 1 },
  { unique: true }
);

// Normalize date to start of day before saving
attendanceSchema.pre("save", function (next) {
  const d = new Date(this.date);
  d.setUTCHours(0, 0, 0, 0);
  this.date = d;
  next();
});

module.exports = mongoose.model("Attendance", attendanceSchema);
