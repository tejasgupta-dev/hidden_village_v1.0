"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/firebaseClient";

const AuthContext = createContext({
  user: null, // server-side user JSON
  firebaseUser: null, // actual Firebase User object
  loading: true,
  refreshUser: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Fetch server-side user info
  const fetchUser = async () => {
    try {
      const res = await fetch("/api/auth/me", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Not authenticated");
      const data = await res.json();
      setUser(data.user);
    } catch {
      setUser(null);
    }
  };

  // Sync Firebase Auth with server session
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setLoading(true);
      setFirebaseUser(fbUser || null);

      try {
        if (!fbUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        // Create server session cookie
        const token = await fbUser.getIdToken(true);
        await fetch("/api/auth/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        // Fetch server-side user info
        await fetchUser();
      } catch (err) {
        console.error("Auth sync error:", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Manual refresh
  const refreshUser = async () => {
    setLoading(true);
    await fetchUser();
    setLoading(false);
  };

  // Logout
  const signOut = async () => {
    try {
      // Delete session cookie first
      await fetch("/api/auth/signout", {
        method: "POST",
        credentials: "include",
      });

      // Then sign out Firebase
      await firebaseSignOut(auth);

      router.push("/");
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        setUser,
        refreshUser,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook
export function useAuth() {
  return useContext(AuthContext);
}
