import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  setupFiles: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
};

export default config;
