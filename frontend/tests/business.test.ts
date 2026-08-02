import { useInventory } from '../src/hooks/useInventory';
import { useBloodRequests } from '../src/hooks/useBloodRequests';
import { useDonations } from '../src/hooks/useDonations';
import { useCamps } from '../src/hooks/useCamps';
import { useEligibility } from '../src/hooks/useEligibility';
import { useAdminManagement } from '../src/hooks/useAdminManagement';

// Mock Tanstack React Query hooks
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
  }),
  useQuery: jest.fn().mockImplementation(() => ({
    data: [],
    isLoading: false,
  })),
  useMutation: jest.fn().mockImplementation(() => ({
    mutateAsync: jest.fn(),
    isPending: false,
  })),
}));

describe('Business Modules Custom Hooks Tests', () => {
  it('should export useInventory, useBloodRequests, useDonations, useCamps, useEligibility, useAdminManagement', () => {
    expect(typeof useInventory).toBe('function');
    expect(typeof useBloodRequests).toBe('function');
    expect(typeof useDonations).toBe('function');
    expect(typeof useCamps).toBe('function');
    expect(typeof useEligibility).toBe('function');
    expect(typeof useAdminManagement).toBe('function');
  });

  it('should resolve hook structures successfully', () => {
    const inv = useInventory();
    expect(inv).toHaveProperty('addStock');
    expect(inv).toHaveProperty('sweepExpiry');

    const reqs = useBloodRequests();
    expect(reqs).toHaveProperty('createRequest');
    expect(reqs).toHaveProperty('approveRequest');

    const dons = useDonations();
    expect(dons).toHaveProperty('bookAppointment');
    expect(dons).toHaveProperty('completeAppointment');

    const camps = useCamps();
    expect(camps).toHaveProperty('createCamp');
    expect(camps).toHaveProperty('registerDonor');

    const elig = useEligibility('donor-1');
    expect(elig).toHaveProperty('submitQuestionnaire');

    const admin = useAdminManagement();
    expect(admin).toHaveProperty('users');
    expect(admin).toHaveProperty('approveHospital');
  });
});
