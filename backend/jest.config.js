export default {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  setupFiles: ["<rootDir>/tests/setup-env.js"],
  testMatch: ["**/*.test.js"],
  testTimeout: 20000,
  collectCoverageFrom: ["src/**/*.js", "!src/server.js", "!src/database/migrations/**"],
};
