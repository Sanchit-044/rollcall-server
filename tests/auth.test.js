const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");

const MONGO_URI =
  process.env.MONGO_TEST_URI || "mongodb://localhost:27017/attendance_test";

beforeAll(async () => {
  await mongoose.connect(MONGO_URI);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

describe("Auth Endpoints", () => {
  const teacher = {
    name: "Test Teacher",
    email: "teacher@test.com",
    password: "password123",
  };

  describe("POST /api/auth/register", () => {
    it("should register a new teacher", async () => {
      const res = await request(app).post("/api/auth/register").send(teacher);
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(teacher.email);
    });

    it("should not register with duplicate email", async () => {
      const res = await request(app).post("/api/auth/register").send(teacher);
      expect(res.statusCode).toBe(409);
    });

    it("should fail with invalid email", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ ...teacher, email: "not-an-email" });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login with correct credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: teacher.email, password: teacher.password });
      expect(res.statusCode).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it("should fail with wrong password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: teacher.email, password: "wrongpassword" });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return current teacher with valid token", async () => {
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: teacher.email, password: teacher.password });
      const token = loginRes.body.token;

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.user.email).toBe(teacher.email);
    });

    it("should fail without token", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.statusCode).toBe(401);
    });
  });
});
