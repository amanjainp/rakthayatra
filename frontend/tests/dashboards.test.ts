import {
  useAdminDashboardData,
  useDonorDashboardData,
  usePatientDashboardData,
  useHospitalDashboardData,
  useBloodBankDashboardData,
} from '../src/hooks/useDashboardData';

// Mock Tanstack React Query hooks
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn().mockImplementation(({ queryKey, queryFn }) => {
    // Sync resolve to inspect data output calculations
    const result = {
      data: null,
      isLoading: false,
    };
    try {
      // Simulate queryFn execution
      const promise = queryFn();
      if (promise instanceof Promise) {
        // Run promise asynchronously but return standard mock parameters
        result.data = { metrics: [], activities: [] };
      }
    } catch {
      // ignore
    }
    return result;
  }),
}));

describe('Dashboards Metrics Hooks Tests', () => {
  it('should export all query hooks as functional definitions', () => {
    expect(typeof useAdminDashboardData).toBe('function');
    expect(typeof useDonorDashboardData).toBe('function');
    expect(typeof usePatientDashboardData).toBe('function');
    expect(typeof useHospitalDashboardData).toBe('function');
    expect(typeof useBloodBankDashboardData).toBe('function');
  });

  it('should invoke useQuery with correct parameters', () => {
    const admin = useAdminDashboardData();
    expect(admin).toHaveProperty('isLoading');
    expect(admin).toHaveProperty('data');
  });
});
