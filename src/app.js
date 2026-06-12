const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const authRoutes = require("./routes/authRoutes");
const studentRoutes = require("./routes/studentRoutes");
const studentPortalRoutes = require("./routes/studentPortalRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "Attendance API is running" });
});

// ── Routes ────────────────────────────────────────────────────────────
// Shared auth (teacher + student login/register)
app.use("/api/auth", authRoutes);

// Teacher-only management routes
app.use("/api/students", studentRoutes);           // CRUD + credential reset
app.use("/api/attendance", attendanceRoutes);      // Mark, edit, reports
app.use("/api/dashboard", dashboardRoutes);        // Teacher dashboard

// Student portal routes
app.use("/api/student", studentPortalRoutes);      // Student's own data

// ── Catch-all ─────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

app.use(errorHandler);

module.exports = app;
