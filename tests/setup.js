// Ensure stable defaults for local and CI test runs.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";