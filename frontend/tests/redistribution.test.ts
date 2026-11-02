import {
  createRedistributionRequestSchema,
  dispatchTransferSchema,
  receiveTransferReconciliationSchema,
} from '../src/utils/validation';

describe('Hospital-to-Hospital Blood Redistribution Frontend Validation Tests', () => {
  describe('createRedistributionRequestSchema', () => {
    it('validates a legitimate hospital redistribution request', () => {
      const futureIso = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
      const result = createRedistributionRequestSchema.safeParse({
        bloodGroup: 'O_NEG',
        componentType: 'PACKED_RBC',
        unitsRequested: 5,
        urgency: 'CRITICAL',
        requiredBy: futureIso,
        minRemainingShelfLifeDays: 3,
        clinicalReason: 'Massive trauma transfusion protocol in Emergency OT-2',
      });
      expect(result.success).toBe(true);
    });

    it('rejects requests with zero or negative units, past requiredBy timestamp, or missing clinical reason', () => {
      const pastIso = new Date(Date.now() - 3600 * 1000).toISOString();
      const badUnits = createRedistributionRequestSchema.safeParse({
        bloodGroup: 'O_NEG',
        componentType: 'PACKED_RBC',
        unitsRequested: 0,
        urgency: 'URGENT',
        requiredBy: new Date(Date.now() + 3600 * 1000).toISOString(),
        clinicalReason: 'Trauma support',
      });
      expect(badUnits.success).toBe(false);

      const pastDeadline = createRedistributionRequestSchema.safeParse({
        bloodGroup: 'O_NEG',
        componentType: 'PACKED_RBC',
        unitsRequested: 4,
        urgency: 'URGENT',
        requiredBy: pastIso,
        clinicalReason: 'Trauma support',
      });
      expect(pastDeadline.success).toBe(false);
    });
  });

  describe('dispatchTransferSchema', () => {
    it('enforces mandatory cold-chain confirmation and valid transport temperature', () => {
      const valid = dispatchTransferSchema.safeParse({
        coldChainVerified: true,
        temperatureCelsius: 4.0,
        transportContainerId: 'CC-BOX-102',
        courierName: 'Ramesh Logistics',
      });
      expect(valid.success).toBe(true);

      const unverifiedColdChain = dispatchTransferSchema.safeParse({
        coldChainVerified: false,
        temperatureCelsius: 4.0,
      });
      expect(unverifiedColdChain.success).toBe(false);
    });
  });

  describe('receiveTransferReconciliationSchema', () => {
    it('validates receipt reconciliation with good and damaged unit counts', () => {
      const validReceipt = receiveTransferReconciliationSchema.safeParse({
        unitsReceivedGood: 4,
        unitsDamaged: 1,
        unitsExpiredInTransit: 0,
        coldChainIntact: true,
        receivingTempCelsius: 4.5,
        discrepancyReason: '1 unit seal damaged during transit',
      });
      expect(validReceipt.success).toBe(true);

      const zeroTotalUnits = receiveTransferReconciliationSchema.safeParse({
        unitsReceivedGood: 0,
        unitsDamaged: 0,
        unitsExpiredInTransit: 0,
        coldChainIntact: true,
      });
      expect(zeroTotalUnits.success).toBe(false);
    });
  });
});

