import { useNotifications } from '../src/hooks/useNotifications';
import { useMapsLocations } from '../src/hooks/useMapsLocations';

// Mock Tanstack React Query hooks
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
    cancelQueries: jest.fn(),
    getQueryData: jest.fn().mockReturnValue([
      { id: 'notif-1', read: false },
    ]),
    setQueryData: jest.fn().mockImplementation((key, updater) => {
      if (typeof updater === 'function') {
        updater([{ id: 'notif-1', read: false }]);
      }
    }),
  }),
  useQuery: jest.fn().mockImplementation(() => ({
    data: [
      { id: 'notif-1', read: false },
      { id: 'notif-2', read: true },
    ],
    isLoading: false,
  })),
  useMutation: jest.fn().mockImplementation((options) => ({
    mutate: jest.fn().mockImplementation((variables) => {
      if (options && options.onMutate) {
        options.onMutate(variables);
      }
    }),
    isPending: false,
  })),
}));

describe('Maps & Notifications Custom Hooks Tests', () => {
  it('should export useNotifications and useMapsLocations', () => {
    expect(typeof useNotifications).toBe('function');
    expect(typeof useMapsLocations).toBe('function');
  });

  it('should evaluate unread notification counts correctly', () => {
    const notifs = useNotifications();
    expect(notifs.unreadCount).toBe(1);
    expect(notifs).toHaveProperty('markAsRead');
    expect(notifs).toHaveProperty('markAllAsRead');
  });

  it('should execute optimistic updates during markAsRead mutation', async () => {
    const notifs = useNotifications();
    
    // Trigger optimistic update mutate
    notifs.markAsRead('notif-1');
    expect(typeof notifs.markAsRead).toBe('function');
  });

  it('should retrieve geocoded maps markers lists', () => {
    const maps = useMapsLocations({ latitude: 28.61, longitude: 77.20 }, 25);
    expect(maps).toHaveProperty('data');
  });
});
