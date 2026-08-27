import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import api from "../config/api";
import { useUser } from "../context/UserContext";
import { canAccessTierPage } from "../utils/tierAccess";

const TierAccessGuard = ({ children }) => {
  const { currentUser } = useUser();
  const { data: activeSettings, isLoading } = useQuery({
    queryKey: ["activeSettings"],
    queryFn: async () => {
      const response = await api.get("/settings/active");
      return response.data;
    },
    retry: false,
  });

  if (isLoading) return null;

  if (!canAccessTierPage(currentUser, activeSettings?.budgetType)) {
    return <Navigate to="/not-authorized" replace />;
  }

  return children;
};

export default TierAccessGuard;

