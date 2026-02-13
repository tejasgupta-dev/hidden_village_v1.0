"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/firebaseClient";

const AuthContext = createContext({
  user: null,
  loading: true,
  refreshUser: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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
    } finally {
      setLoading(false);
    }
  };

  // Sync Firebase auth with server session
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);

      try {
        // USER LOGGED OUT
        if (!firebaseUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        // USER LOGGED IN
        const token = await firebaseUser.getIdToken(true);

        await fetch("/api/auth/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        await fetchUser();
      } catch (err) {
        console.error("Auth sync error:", err);
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Manual refresh
  const refreshUser = async () => {
    setLoading(true);
    await fetchUser();
  };

  // Logout
  const signOut = async () => {
    try {
      // delete session cookie FIRST
      await fetch("/api/auth/signout", {
        method: "POST",
        credentials: "include",
      });

      // then logout firebase
      await firebaseSignOut(auth);

      // listener will update state automatically
      router.push("/");
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };
  // Context
  return (
    <AuthContext.Provider
      value={{
        user,
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
