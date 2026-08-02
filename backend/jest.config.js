module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true,
  collectCoverageFrom: [
    'src/services/auth.service.ts',
    'src/services/blood-request.service.ts',
    'src/services/donation-camp.service.ts',
    'src/services/donation.service.ts',
    'src/services/inventory.service.ts',
    'src/services/medical-eligibility.service.ts',
    'src/services/cache.service.ts',
    'src/utils/crypto.ts',
    'src/errors/app-error.ts',
    'src/middlewares/auth.middleware.ts'
  ],
};
