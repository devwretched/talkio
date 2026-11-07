"use client";

import { create } from "zustand";
import type { User } from "@/types";

type AuthState = {
  user: User | null;
  token: string | null;
  /** "loading" = session bootstrap in progress */
  ready: boolean;
  login: (user: User, token: string) => void;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  clear: () => void;
};

export const useAuth = create<AuthState>()((set) => ({
  user: null,
  token: null,
  // Landing/login are public, so start ready; App sites flip through bootstrap.
  ready: true,
  login: (user, token) => set({ user, token, ready: true }),
  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  clear: () => set({ user: null, token: null, ready: true }),
}));
