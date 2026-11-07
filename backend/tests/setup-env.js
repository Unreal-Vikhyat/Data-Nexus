process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "postgresql://nexus_app:test@127.0.0.1:5432/data_nexus_test";
process.env.DATABASE_MIGRATION_URL = process.env.TEST_MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-that-is-at-least-thirty-two-characters-long";
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
