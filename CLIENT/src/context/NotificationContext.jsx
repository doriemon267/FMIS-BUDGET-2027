import React, { createContext, useContext, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../config/api";

const NotificationContext = createContext({
  notifications: [],
  markNotificationAsRead: () => {},
});

export const NotificationProvider = ({ children }) => {
  const queryClient = useQueryClient();

  // Fetch notifications using useQuery
  const { data: response } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const response = await api.get("/notifications");
      return response.data;
    },
  });

  const normalizedNotifications = useMemo(() => {
    if (!response) return { contract: [] };

    const rawList = Array.isArray(response)
      ? response
      : Array.isArray(response.data)
        ? response.data
        : Array.isArray(response?.data?.data)
          ? response.data.data
          : Array.isArray(response?.contract)
            ? response.contract
            : [];

    const contract = rawList.map((item) => ({
      ...item,
      _id: item._id || item.id,
      isRead: String(item.status || "").toUpperCase() === "READ",
      message: item.message || item.title || "",
      payor: item.payor || item.title || "",
    }));

    return { contract };
  }, [response]);

  // Mark notification as read using useMutation
  const { mutate: markNotificationAsRead } = useMutation({
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

  return (
    <NotificationContext.Provider
      value={{
        notifications: normalizedNotifications,
        markNotificationAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  return useContext(NotificationContext);
};
