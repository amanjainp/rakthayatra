import React from 'react';
import { validateInput } from '../src/utils/validation';
import { z } from 'zod';

describe('Frontend Coverage Booster Tests', () => {
  describe('validation.ts utilities', () => {
    it('should validate zod configurations successfully', () => {
      const schema = z.object({
        email: z.string().email(),
      });

      const valid = validateInput(schema, { email: 'aman@donor.org' });
      expect(valid.success).toBe(true);

      const invalid = validateInput(schema, { email: 'invalid' });
      expect(invalid.success).toBe(false);
      expect(invalid.errors).toBeDefined();
    });
  });
});
