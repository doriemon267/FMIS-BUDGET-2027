import React, { createContext, useContext, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../config/api";

const NotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  markNotificationAsRead: () => {},
  markNotificationAsReadAsync: () => Promise.resolve(),
  refreshNotifications: () => Promise.resolve(),
});

export const NotificationProvider = ({ children }) => {
  const queryClient = useQueryClient();

  // Fetch notifications using useQuery
  const { data: response, isLoading, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const response = await api.get("/notifications");
      return response.data;
    },
  });

  const notifications = useMemo(() => {
    if (!response) return [];

    const rawList = Array.isArray(response)
      ? response
      : Array.isArray(response.data)
        ? response.data
        : Array.isArray(response?.data?.data)
          ? response.data.data
          : Array.isArray(response?.contract)
            ? response.contract
            : [];

    return rawList.map((item) => {
      const rawId = item._id || item.id;
      const createdAtDate = item.createdAt ? new Date(item.createdAt) : null;
      const isValidDate = createdAtDate instanceof Date && !Number.isNaN(createdAtDate.valueOf());

      return {
        ...item,
        id: rawId,
        _id: rawId,
        title: item.title || item.message || "Notification",
        message: item.message || item.title || "",
        type: item.type || (item.entity ? `${String(item.entity).toUpperCase()}_EVENT` : "INFO"),
        isRead: String(item.status || "").toUpperCase() === "READ",
        status: String(item.status || "UNREAD").toUpperCase(),
        relatedLink: item.relatedLink || null,
        relatedEntityId: item.relatedEntityId || (Array.isArray(item.recordIds) ? item.recordIds[0] : null),
        relatedEntityType: item.relatedEntityType || item.entity || null,
        metadata: item.metadata || {},
        createdAt: isValidDate ? createdAtDate : null,
      };
    });
  }, [response]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);

  // Mark notification as read using useMutation
  const { mutate: markNotificationAsReadMutate, mutateAsync: markNotificationAsReadAsync } = useMutation({
    mutationFn: async (id) => {
      await api.post("/notifications/mark-read", { ids: [id] });
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error) => {
      console.error("Failed to mark notification as read", error);
    },
  });

  const markNotificationAsRead = useCallback(
    (id, options = {}) => markNotificationAsReadMutate(id, options),
    [markNotificationAsReadMutate]
  );

  const refreshNotifications = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    return refetch();
  }, [queryClient, refetch]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        markNotificationAsRead,
        markNotificationAsReadAsync,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  return useContext(NotificationContext);
};
