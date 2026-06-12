const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");

const MONGO_URI =
  process.env.MONGO_TEST_URI || "mongodb://localhost:27017/attendance_test_portal";

let teacherToken;
let studentToken;
let studentId;
let attendanceId;

const teacherData = { name: "Portal Teacher", email: "portalteacher@test.com", password: "pass1234" };
const studentBase = { name: "Bob Singh", rollNumber: "42", class: "9", section: "B" };

beforeAll(async () => {
  await mongoose.connect(MONGO_URI);

  // Register + login teacher
  await request(app).post("/api/auth/teacher/register").send(teacherData);
  const tRes = await request(app).post("/api/auth/teacher/login").send({
    email: teacherData.email, password: teacherData.password,
  });
  teacherToken = tRes.body.token;

  // Teacher creates a student record
  const sRes = await request(app)
    .post("/api/students")
    .set("Authorization", `Bearer ${teacherToken}`)
    .send(studentBase);
  studentId = sRes.body.student._id;

  // Student self-registers
  const regRes = await request(app).post("/api/auth/student/register").send({
    rollNumber: studentBase.rollNumber,
    class: studentBase.class,
    section: studentBase.section,
    teacherEmail: teacherData.email,
    email: "bob@student.com",
    password: "pass1234",
  });
  expect(regRes.statusCode).toBe(201);
  studentToken = regRes.body.token;

  // Teacher marks attendance for this student
  const attRes = await request(app)
    .post("/api/attendance")
    .set("Authorization", `Bearer ${teacherToken}`)
    .send({
      date: new Date().toISOString().split("T")[0],
      class: studentBase.class,
      section: studentBase.section,
      records: [{ student: studentId, status: "present" }],
    });
  attendanceId = attRes.body.attendance?._id;
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

describe("Student Auth", () => {
  it("should login student with correct credentials", async () => {
    const res = await request(app).post("/api/auth/student/login").send({
      email: "bob@student.com", password: "pass1234",
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.role).toBe("student");
    expect(res.body.token).toBeDefined();
  });

  it("should reject student login with wrong password", async () => {
    const res = await request(app).post("/api/auth/student/login").send({
      email: "bob@student.com", password: "wrongpass",
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/auth/student/me - should return student profile", async () => {
    const res = await request(app)
      .get("/api/auth/student/me")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.role).toBe("student");
    expect(res.body.user.rollNumber).toBe(studentBase.rollNumber);
  });
});

describe("Role Guards", () => {
  it("should reject student token on teacher-only route", async () => {
    const res = await request(app)
      .get("/api/students")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(403);
  });

  it("should reject teacher token on student-only route", async () => {
    const res = await request(app)
      .get("/api/student/profile")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.statusCode).toBe(403);
  });
});

describe("Student Portal — Profile", () => {
  it("GET /api/student/profile - should return own profile", async () => {
    const res = await request(app)
      .get("/api/student/profile")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.student.name).toBe(studentBase.name);
    expect(res.body.student.password).toBeUndefined();
  });

  it("PATCH /api/student/profile - should update email", async () => {
    const res = await request(app)
      .patch("/api/student/profile")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ email: "bob.updated@student.com" });
    expect(res.statusCode).toBe(200);
    expect(res.body.user.email).toBe("bob.updated@student.com");
    // restore original email for subsequent tests
    await request(app)
      .patch("/api/student/profile")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ email: "bob@student.com" });
  });

  it("PATCH /api/student/profile - should reject wrong current password", async () => {
    const res = await request(app)
      .patch("/api/student/profile")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ currentPassword: "wrongpass", newPassword: "newpass123" });
    expect(res.statusCode).toBe(401);
  });
});

describe("Student Portal — Attendance", () => {
  it("GET /api/student/attendance/today - should return today status", async () => {
    const res = await request(app)
      .get("/api/student/attendance/today")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(200);
    expect(["present", "absent", "not_marked"]).toContain(res.body.status);
  });

  it("GET /api/student/attendance - should return attendance summary", async () => {
    const res = await request(app)
      .get("/api/student/attendance")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.report).toHaveProperty("totalPresentDays");
    expect(res.body.report).toHaveProperty("attendancePercentage");
    expect(Array.isArray(res.body.report.breakdown)).toBe(true);
  });

  it("GET /api/student/attendance/trend - should return 7-day trend", async () => {
    const res = await request(app)
      .get("/api/student/attendance/trend")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.trend).toHaveLength(7);
    res.body.trend.forEach((day) => {
      expect(day).toHaveProperty("date");
      expect(["present", "absent", "not_marked"]).toContain(day.status);
    });
  });

  it("GET /api/student/attendance/monthly - should return monthly summary", async () => {
    const now = new Date();
    const res = await request(app)
      .get(`/api/student/attendance/monthly?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.summary).toHaveProperty("attendancePercentage");
    expect(Array.isArray(res.body.days)).toBe(true);
  });

  it("GET /api/student/attendance/class-summary - should return class stats for a date", async () => {
    const today = new Date().toISOString().split("T")[0];
    const res = await request(app)
      .get(`/api/student/attendance/class-summary?date=${today}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(200);
    if (res.body.summary) {
      expect(res.body.summary).toHaveProperty("presentCount");
      expect(res.body.summary).toHaveProperty("attendancePercentage");
    }
  });
});

describe("Teacher — Reset Student Credentials", () => {
  it("PATCH /api/students/:id/reset-credentials - teacher can reset student creds", async () => {
    const res = await request(app)
      .patch(`/api/students/${studentId}/reset-credentials`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/reset/i);
  });

  it("student login should fail after reset", async () => {
    const res = await request(app).post("/api/auth/student/login").send({
      email: "bob@student.com", password: "pass1234",
    });
    expect(res.statusCode).toBe(401);
  });
});
