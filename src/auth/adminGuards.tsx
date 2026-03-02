import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAdminAuth } from "./AdminAuthProvider";

export function RequireAdmin() {
  const { admin, isLoading } = useAdminAuth();
  const loc = useLocation();

  if (isLoading) return null;

  if (!admin) {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: loc.pathname, reason: "auth-required" }}
      />
    );
  }

  return <Outlet />;
}

export function AdminGuestOnly() {
  const { admin, isLoading } = useAdminAuth();

  if (isLoading) return null;

  if (admin) return <Navigate to="/admin" replace />;

  return <Outlet />;
}
