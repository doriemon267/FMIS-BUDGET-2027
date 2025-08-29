import React, { createContext, useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../config/api";
import { useNavigate } from "react-router-dom";

const NotificationContext = createContext({
  notifications: [],
  markNotificationAsRead: () => {},
});

export const NotificationProvider = ({ children }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch notifications using useQuery
  const { data: notifications = [], error } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const response = await api.get("/notifications");
      return response.data;
    },
  });

  // Mark notification as read using useMutation
  const { mutate: markNotificationAsRead } = useMutation({
    mutationFn: async (id) => {
      return await api.get(`/notifications/${id}`);
    },
    onSuccess: (res) => {
      navigate(`?_id=${res.data.contract_id}`, { replace: true });
      // Invalidate the query to refresh the data
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error) => {
      console.error("Failed to mark notification as read", error);
    },
  });

  return (
    <NotificationContext.Provider
      value={{
        notifications,
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
