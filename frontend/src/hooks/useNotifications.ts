import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import toast from 'react-hot-toast';

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export const useNotifications = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/notifications');
        return (res?.data?.data || []) as NotificationItem[];
      } catch {
        return [] as NotificationItem[];
      }
    },
    refetchInterval: 10000, // Poll every 10s for real-time live updates
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/notifications/${id}/read`);
      return res.data;
    },
    // --- OPTIMISTIC UPDATES CACHE INJECTIONS ---
    onMutate: async (id: string) => {
      // Cancel ongoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ['notifications'] });

      // Snapshot the previous state values
      const previousNotifications = queryClient.getQueryData<NotificationItem[]>(['notifications']);

      // Optimistically update the list in cache
      queryClient.setQueryData<NotificationItem[]>(['notifications'], (old) => {
        return old ? old.map((n) => (n.id === id ? { ...n, read: true } : n)) : [];
      });

      // Return context containing previous snapshot
      return { previousNotifications };
    },
    onError: (_err, _id, context) => {
      // Rollback to previous state on failure
      if (context?.previousNotifications) {
        queryClient.setQueryData(['notifications'], context.previousNotifications);
      }
      toast.error('Failed to update notification status');
    },
    onSettled: () => {
      // Invalidate query to sync with server state
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/notifications/read-all');
      return res.data;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previousNotifications = queryClient.getQueryData<NotificationItem[]>(['notifications']);

      queryClient.setQueryData<NotificationItem[]>(['notifications'], (old) => {
        return old ? old.map((n) => ({ ...n, read: true })) : [];
      });

      return { previousNotifications };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(['notifications'], context.previousNotifications);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = (query.data || []).filter((n) => !n.read).length;

  return {
    ...query,
    unreadCount,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
  };
};
