import React from 'react';

// Setup React mock for node environment testing
let capturedSetState: Record<string, any> = {};
jest.mock('react', () => {
  const originalReact = jest.requireActual('react');
  return {
    ...originalReact,
    useState: jest.fn().mockImplementation((init: any) => {
      const val = typeof init === 'function' ? init() : init;
      const setter = jest.fn();
      return [val, setter];
    }),
    useEffect: jest.fn().mockImplementation((cb: any) => {
      const cleanup = cb();
      if (typeof cleanup === 'function') cleanup();
    }),
    useCallback: jest.fn().mockImplementation((fn: any) => fn),
    useRef: jest.fn().mockImplementation((init: any) => ({ current: init })),
  };
});

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    loading: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock useMapsLocations hook
jest.mock('../src/hooks/useMapsLocations', () => ({
  useMapsLocations: jest.fn().mockReturnValue({
    data: [],
    isLoading: false,
  }),
}));

// Mock apiClient
jest.mock('../src/services/api', () => ({
  apiClient: {
    get: jest.fn().mockResolvedValue({
      data: {
        data: {
          address: 'Test City Center',
        },
      },
    }),
  },
}));

import EmergencyMap from '../src/pages/EmergencyMap';
import toast from 'react-hot-toast';

describe('EmergencyMap Geolocation & Fallback Tests', () => {
  let mockGetCurrentPosition: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentPosition = jest.fn();

    // Setup mock navigator.geolocation in Node environment
    (global as any).navigator = {
      geolocation: {
        getCurrentPosition: mockGetCurrentPosition,
      },
    };
  });

  it('should export EmergencyMap as a functional React component', () => {
    expect(typeof EmergencyMap).toBe('function');
  });

  it('should trigger initial geolocation request with robust options (10s timeout, 60s maxAge)', () => {
    EmergencyMap();

    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1);
    const options = mockGetCurrentPosition.mock.calls[0][2];

    expect(options).toEqual({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    });
  });

  it('should fallback to standard accuracy if high accuracy geolocation times out', () => {
    EmergencyMap();

    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1);
    const errorCallback = mockGetCurrentPosition.mock.calls[0][1];

    // Simulate TIMEOUT (code 3)
    const timeoutError = {
      code: 3,
      message: 'Timeout expired',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    };

    errorCallback(timeoutError);

    // Fallback should be triggered with standard accuracy (low power, network/Wi-Fi)
    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(2);
    const fallbackOptions = mockGetCurrentPosition.mock.calls[1][2];

    expect(fallbackOptions).toEqual({
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000,
    });
  });

  it('should show user-friendly guidance when location permission is denied', () => {
    EmergencyMap();

    const errorCallback = mockGetCurrentPosition.mock.calls[0][1];
    const permissionError = {
      code: 1,
      message: 'User denied Geolocation',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    };

    errorCallback(permissionError);

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('Location access denied. Please enable location permissions in your browser settings.'),
      expect.objectContaining({ id: 'geo' })
    );
  });

  it('should show clear error when device position is unavailable', () => {
    EmergencyMap();

    const errorCallback = mockGetCurrentPosition.mock.calls[0][1];
    const unavailableError = {
      code: 2,
      message: 'Position unavailable',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    };

    errorCallback(unavailableError);

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('Location unavailable. Unable to determine device position.'),
      expect.objectContaining({ id: 'geo' })
    );
  });

  it('should update coordinates and display success toast on successful detection', () => {
    EmergencyMap();

    const successCallback = mockGetCurrentPosition.mock.calls[0][0];
    const position = {
      coords: {
        latitude: 12.9716,
        longitude: 77.5946,
      },
    };

    successCallback(position);

    expect(toast.success).toHaveBeenCalledWith(
      'Location updated successfully',
      expect.objectContaining({ id: 'geo' })
    );
  });
});
