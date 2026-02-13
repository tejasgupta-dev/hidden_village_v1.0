"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase/firebaseClient";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/contexts/AuthContext";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirectPath, setRedirectPath] = useState("/");

  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();

  // ✅ Prevent open redirect vulnerability
  useEffect(() => {
    const redirect = searchParams.get("redirect");
    if (redirect && redirect.startsWith("/")) {
      setRedirectPath(redirect);
    }
  }, [searchParams]);

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      // 1️⃣ Create user account
      const userCred = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // 2️⃣ Send verification email
      await sendEmailVerification(userCred.user);

      // 3️⃣ Get ID token
      const token = await userCred.user.getIdToken();

      // 4️⃣ Exchange for session cookie
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to establish session");
      }

      // 5️⃣ Update AuthContext
      await refreshUser();

      setMessage("Account created! Please check your email to verify. Redirecting...");

      // 6️⃣ Redirect after a short delay
      setTimeout(() => {
        router.push(redirectPath);
      }, 1500);

    } catch (err) {
      console.error("Sign-up error:", err);
      
      let msg = "Failed to create account";

      if (err.code === "auth/email-already-in-use") {
        msg = "This email is already registered";
      } else if (err.code === "auth/weak-password") {
        msg = "Password should be at least 6 characters";
      } else if (err.code === "auth/invalid-email") {
        msg = "Invalid email address";
      } else if (err.message) {
        msg = err.message;
      }

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <form
        onSubmit={handleSignUp}
        className="bg-white p-8 rounded-lg shadow-md w-96 flex flex-col gap-4"
      >
        <h2 className="text-2xl font-bold text-center">Sign Up</h2>

        <input
          type="email"
          placeholder="Email"
          className="border p-2 rounded"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
          disabled={loading}
          required
        />

        <input
          type="password"
          placeholder="Password (min 6 characters)"
          className="border p-2 rounded"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError("");
          }}
          disabled={loading}
          required
          minLength={6}
        />

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        {message && <p className="text-green-600 text-sm text-center">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className={`py-2 rounded text-white transition ${
            loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-green-500 hover:bg-green-600"
          }`}
        >
          {loading ? "Creating account..." : "Sign Up"}
        </button>

        <p className="text-sm text-center mt-2">
          Already have an account?{" "}
          <Link
            href={`/auth/signIn?redirect=${encodeURIComponent(redirectPath)}`}
            className="text-blue-500 hover:underline"
          >
            Sign In
          </Link>
        </p>
      </form>
    </div>
  );
}