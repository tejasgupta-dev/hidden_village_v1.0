"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/firebaseClient";

/**
 * AuthContext provides authentication state and helpers to the entire app.
 *
 * It keeps two separate user states:
 * - firebaseUser → actual Firebase Auth user object (client-side identity)
 * - user → server-side user JSON from your backend (trusted session identity)
 *
 * The server-side user is the authoritative identity for permissions and roles.
 */
const AuthContext = createContext({
  user: null, // Trusted server-side user JSON (roles, permissions, etc.)
  firebaseUser: null, // Firebase Auth user object (client identity)
  loading: true, // Indicates auth state is being resolved
  refreshUser: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }) {
  // Trusted backend user (roles, permissions, profile, etc.)
  const [user, setUser] = useState(null);
  // Firebase authentication user (client-side identity)
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  /**
   * Fetch trusted server-side user from backend session cookie.
   *
   * Why this exists:
   * Firebase authentication alone is NOT trusted for authorization.
   * The backend verifies Firebase ID token and creates a secure session cookie.
   * This function retrieves the verified user from that backend session.
   */
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

  /**
   * Synchronize Firebase authentication with backend session.
   *
   * Flow:
   * 1. Firebase detects login/logout
   * 2. If logged in:
   *    - Get Firebase ID token
   *    - Send token to backend to create secure session cookie
   *    - Fetch trusted server user
   * 3. If logged out:
   *    - Clear user state
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setLoading(true);

      // Store Firebase user (client identity)
      setFirebaseUser(fbUser || null);

      try {
        if (!fbUser) {
          setUser(null);
          setLoading(false);
          return;
        }

         /**
         * Force refresh Firebase ID token.
         *
         * This ensures:
         * - Token is valid
         * - Token is not expired
         * - Backend receives fresh authentication proof
         */
        const token = await fbUser.getIdToken(true);
        await fetch("/api/auth/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        // Fetch trusted backend user associated with session
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

  /**
   * Manually refresh trusted backend user.
   *
   * Useful after:
   * - profile updates
   * - role changes
   * - account updates
   */
  const refreshUser = async () => {
    setLoading(true);
    await fetchUser();
    setLoading(false);
  };

  /**
   * Logout flow.
   *
   * 1. Delete backend session cookie
   *    prevents further authenticated requests
   *
   * 2. Sign out Firebase client
   *    removes Firebase identity from client
   *
   * 3. Redirect to homepage
   */
  const signOut = async () => {
    try {
      // Delete session cookie first
      await fetch("/api/auth/signout", {
        method: "POST",
        credentials: "include",
      });

      // Then sign out Firebase
      await firebaseSignOut(auth);

      // Redirect to home page
      router.push("/");
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,         // trusted backend user
        firebaseUser, // Firebase identity
        loading,      // auth initialization state
        setUser,      // optional direct user setter
        refreshUser,  // manual refresh
        signOut,      // logout function
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth Hook
 *
 * Usage:
 * const { user, loading, signOut } = useAuth();
 */
export function useAuth() {
  return useContext(AuthContext);
}
