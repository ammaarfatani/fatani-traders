import { defineConfig } from 'vitest/config';

// Tests must never inherit the application or Atlas connection.
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^mongodb:\/\/(127\.0\.0\.1|localhost):\d+\/fatani_test_[a-zA-Z0-9_]+(?:\?|$)/.test(url)) {
  throw new Error('Set TEST_DATABASE_URL to a dedicated local fatani_test_* database before running tests.');
}
process.env.DATABASE_URL = url;
export default defineConfig({ test: { fileParallelism: false, testTimeout: 60000, hookTimeout: 60000 } });
