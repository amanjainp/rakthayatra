import toast from 'react-hot-toast';
import { useEmergencyBroadcast } from '../src/hooks/useRealtimeLogistics';

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock @tanstack/react-query
let capturedMutationOptions: any = null;
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
  }),
  useQuery: jest.fn(),
  useMutation: jest.fn().mockImplementation((options) => {
    capturedMutationOptions = options;
    return {
      mutate: jest.fn(),
      mutateAsync: jest.fn(),
      isPending: false,
    };
  }),
}));

// Mock apiClient
jest.mock('../src/services/api', () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
  },
}));

describe('useEmergencyBroadcast Regression Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedMutationOptions = null;
  });

  it('should initialize useEmergencyBroadcast and capture options', () => {
    useEmergencyBroadcast();
    expect(capturedMutationOptions).toBeDefined();
    expect(typeof capturedMutationOptions.onError).toBe('function');
    expect(typeof capturedMutationOptions.onSuccess).toBe('function');
  });

  it('should extract string message and never pass an object to toast.error when API returns error object with code and message', () => {
    useEmergencyBroadcast();

    const apiErrorResponse = {
      response: {
        data: {
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected database or server error occurred.',
          },
        },
      },
    };

    capturedMutationOptions.onError(apiErrorResponse);

    expect(toast.error).toHaveBeenCalledTimes(1);
    const toastArg = (toast.error as jest.Mock).mock.calls[0][0];

    // Must be a string, NEVER an object
    expect(typeof toastArg).toBe('string');
    expect(toastArg).toBe('An unexpected database or server error occurred.');
    expect(toastArg).not.toEqual(expect.objectContaining({ code: expect.anything() }));
  });

  it('should handle validation error objects correctly', () => {
    useEmergencyBroadcast();

    const validationError = {
      response: {
        data: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'bloodGroup and unitsRequired are required.',
          },
        },
      },
    };

    capturedMutationOptions.onError(validationError);

    expect(toast.error).toHaveBeenCalledWith('bloodGroup and unitsRequired are required.');
  });

  it('should handle generic error strings and fallback cleanly', () => {
    useEmergencyBroadcast();

    // String error
    capturedMutationOptions.onError({
      response: { data: { error: 'Direct string error' } },
    });
    expect(toast.error).toHaveBeenCalledWith('Direct string error');

    // Network error
    capturedMutationOptions.onError(new Error('Network timeout'));
    expect(toast.error).toHaveBeenCalledWith('Network timeout');

    // Empty error fallback
    capturedMutationOptions.onError({});
    expect(toast.error).toHaveBeenCalledWith('Failed to broadcast emergency alert');
  });

  it('should display success toast with alerted donor count on success', () => {
    useEmergencyBroadcast();

    capturedMutationOptions.onSuccess({
      data: {
        alertedDonorsCount: 3,
      },
    });

    expect(toast.success).toHaveBeenCalledWith(
      '🚨 Emergency alert dispatched to 3 active donors!',
      { duration: 5000 }
    );
  });
});
