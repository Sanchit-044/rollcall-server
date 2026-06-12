const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");

const MONGO_URI =
  process.env.MONGO_TEST_URI || "mongodb://localhost:27017/attendance_test_students";

let token;
let studentId;

beforeAll(async () => {
  await mongoose.connect(MONGO_URI);
  // Register and login
  await request(app).post("/api/auth/register").send({
    name: "Teacher",
    email: "t@test.com",
    password: "password123",
  });
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "t@test.com", password: "password123" });
  token = res.body.token;
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

describe("Student Endpoints", () => {
  const student = {
    name: "Alice Kumar",
    rollNumber: "101",
    class: "10",
    section: "A",
  };

  it("POST /api/students - should create a student", async () => {
    const res = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${token}`)
      .send(student);
    expect(res.statusCode).toBe(201);
    expect(res.body.student.name).toBe(student.name);
    studentId = res.body.student._id;
  });

  it("GET /api/students - should list students", async () => {
    const res = await request(app)
      .get("/api/students")
      .set("Authorization", `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBeGreaterThan(0);
  });

  it("GET /api/students/:id - should get single student", async () => {
    const res = await request(app)
      .get(`/api/students/${studentId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.student._id).toBe(studentId);
  });

  it("PUT /api/students/:id - should update a student", async () => {
    const res = await request(app)
      .put(`/api/students/${studentId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...student, name: "Alice Updated" });
    expect(res.statusCode).toBe(200);
    expect(res.body.student.name).toBe("Alice Updated");
  });

  it("DELETE /api/students/:id - should soft delete a student", async () => {
    const res = await request(app)
      .delete(`/api/students/${studentId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
  });

  it("should not allow unauthenticated access", async () => {
    const res = await request(app).get("/api/students");
    expect(res.statusCode).toBe(401);
  });
});
