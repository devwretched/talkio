"use client";

import { useAuth } from "@/lib/auth";
import type { ApiError } from "@/types";

/**
 * Single fetch wrapper for the Go backend.
 * On a 401 from a protected route it retries once through the
 * refresh-token cookie (POST /api/auth/refresh), same origin via rewrites.
 */

let refreshPromise: Promise<string> | null = null;

async function executeRefresh(): Promise<string> {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("refresh failed");
    const data: { token?: string; user?: import("@/types").User } = await res.json();
    if (!data.token || !data.user) throw new Error("no token returned");
    useAuth.getState().login(data.user, data.token);
    return data.token;
  } catch (err) {
    useAuth.getState().clear();
    throw err;
  } finally {
    refreshPromise = null;
  }
}

function getFreshToken(): Promise<string> {
  if (!refreshPromise) refreshPromise = executeRefresh();
  return refreshPromise;
}

async function toError(res: Response): Promise<ApiError> {
  const error: ApiError = { message: "An unexpected error occurred", status: res.status };
  try {
    const data = await res.json();
    error.message = data.message || data.error || error.message;
    error.code = data.code;
  } catch {
    if (res.status === 401) error.message = "Please log in again.";
    else if (res.status === 403) error.message = "You do not have permission for this action.";
    else if (res.status === 404) error.message = "Not found.";
    else if (res.status >= 500) error.message = "Server error. Try again later.";
  }
  return error;
}

async function request<T>(endpoint: string, init: RequestInit, withAuth = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (withAuth) {
    const token = useAuth.getState().token;
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let res = await fetch(endpoint, { ...init, headers, credentials: "include" });

  if (res.status === 401 && withAuth && !endpoint.includes("/auth/refresh")) {
    const fresh = await getFreshToken();
    headers.set("Authorization", `Bearer ${fresh}`);
    res = await fetch(endpoint, { ...init, headers, credentials: "include" });
  }

  if (!res.ok) throw await toError(res);

  if (res.headers.get("content-type")?.includes("application/json")) return res.json();
  return res.text() as Promise<T>;
}

export const api = {
  get: <T>(endpoint: string, withAuth = true) =>
    request<T>(endpoint, { method: "GET" }, withAuth),

  post: <T>(endpoint: string, data?: unknown, withAuth = true) =>
    request<T>(
      endpoint,
      {
        method: "POST",
        body: data === undefined ? undefined : JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      },
      withAuth,
    ),

  put: <T>(endpoint: string, data?: unknown, withAuth = true) =>
    request<T>(
      endpoint,
      {
        method: "PUT",
        body: data === undefined ? undefined : JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      },
      withAuth,
    ),

  postForm: <T>(endpoint: string, formData: FormData, withAuth = true) =>
    request<T>(endpoint, { method: "POST", body: formData }, withAuth),

  delete: <T>(endpoint: string, withAuth = true) =>
    request<T>(endpoint, { method: "DELETE" }, withAuth),
};
