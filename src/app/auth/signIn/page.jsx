"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase/firebaseClient";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/contexts/AuthContext";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirectPath, setRedirectPath] = useState("/");

  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();

  useEffect(() => {
    const redirect = searchParams.get("redirect");
    if (redirect && redirect.startsWith("/")) {
      setRedirectPath(redirect);
    }
  }, [searchParams]);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      console.log("🔐 Signing in...");

      // Sign in with Firebase client SDK
      const userCred = await signInWithEmailAndPassword(auth, email, password);

      console.log("✅ Firebase sign-in successful");

      // Get ID token
      const token = await userCred.user.getIdToken();

      console.log("🔑 Got ID token, exchanging for session cookie...");

      // Exchange for secure httpOnly session cookie
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to establish session");
      }

      console.log("🍪 Session cookie set successfully");

      // Refresh global auth state
      await refreshUser();

      console.log("🚀 Redirecting to:", redirectPath);

      // Redirect safely
      router.push(redirectPath);

    } catch (err) {
      console.error("❌ Sign-in error:", err);
      
      let msg = "Failed to sign in";

      if (err.code === "auth/user-not-found")
        msg = "No account found with this email";
      else if (err.code === "auth/wrong-password")
        msg = "Incorrect password";
      else if (err.code === "auth/too-many-requests")
        msg = "Too many attempts, try again later";
      else if (err.message)
        msg = err.message;

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <form
        onSubmit={handleSignIn}
        className="bg-white p-8 rounded-lg shadow-md w-96 flex flex-col gap-4"
      >
        <h2 className="text-2xl font-bold text-center">Sign In</h2>

        <input
          type="email"
          placeholder="Email"
          className="border p-2 rounded"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="border p-2 rounded"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError("");
          }}
          required
        />

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`py-2 rounded text-white transition ${
            loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-500 hover:bg-blue-600"
          }`}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <p className="text-sm text-center mt-2">
          Don't have an account?{" "}
          <Link
            href={`/auth/signUp?redirect=${encodeURIComponent(
              redirectPath
            )}`}
            className="text-blue-500 hover:underline"
          >
            Sign Up
          </Link>
        </p>
      </form>
    </div>
  );
}