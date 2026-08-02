module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  verbose: true,
  collectCoverageFrom: [
    'src/hooks/**/*.ts',
    'src/utils/**/*.ts',
    'src/contexts/**/*.tsx',
    'src/components/ui/**/*.tsx'
  ],
};
