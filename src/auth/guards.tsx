import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import { UserLoadingScreen } from "../components/pageTransition";

export function RequireAuth() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <UserLoadingScreen variant="dashboard" routePath={location.pathname} />;
  }
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname, reason: "auth-required" }}
      />
    );
  }

  return <Outlet />;
}

export function GuestOnly() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <UserLoadingScreen variant="auth" routePath={location.pathname} />;
  if (user) return <Navigate to="/" replace />;

  return <Outlet />;
}

export function HomeGate({
  landing,
  dashboard,
}: {
  landing: React.ReactNode;
  dashboard: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <UserLoadingScreen variant="auth" routePath={location.pathname} />;

  // If guest tries to access protected dashboard URLs directly, force login first.
  if (!user && location.pathname !== "/") {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname, reason: "auth-required" }}
      />
    );
  }

  return user ? <>{dashboard}</> : <>{landing}</>;
}
