"use client";

import Link from "next/link";
import { useAuth } from "@/lib/contexts/AuthContext";

export default function Home() {
  const { user, loading, signOut } = useAuth();

  const buttons = [
    { label: "Edit Game", href: "/game/edit/menu" },
    { label: "New Game", href: "/game/new" },
    { label: "Play Game", href: "/game/play/menu" },
    { label: "Edit Level", href: "/level/menu" },
    { label: "New Level", href: "/level/new" },
  ];

  // Add Admin Dashboard button if user is admin
  if (user?.roles?.includes("admin")) {
    buttons.push({ label: "Admin Dashboard", href: "/admin" });
  }

  const authButton = user
    ? { label: "Sign Out", onClick: signOut, color: "red" }
    : { label: "Sign In", href: "/auth/signIn", color: "blue" };

  if (loading) return <p className="text-white text-center mt-10">Loading...</p>;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
      {/* Auth status */}
      <div className="text-white font-semibold mb-4">
        {user
          ? `Signed in as: ${user.email} (${user.roles?.join(", ") || "user"})`
          : "Not signed in"}
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap gap-6 justify-center">
        {buttons.map((btn) => (
          <Link
            key={btn.label}
            href={btn.href}
            className="
              w-32 h-32
              flex items-center justify-center
              text-center
              rounded-full
              bg-neutral-900
              text-white
              font-semibold
              shadow-lg
              transition-all duration-200
              hover:bg-neutral-700
              hover:scale-105
              active:scale-95
            "
          >
            {btn.label}
          </Link>
        ))}

        {/* Sign In / Sign Out button */}
        {authButton.href ? (
          <Link
            href={authButton.href}
            className={`
              w-32 h-32
              flex items-center justify-center
              text-center
              rounded-full
              text-white
              font-semibold
              shadow-lg
              transition-all duration-200
              hover:scale-105
              active:scale-95
              ${authButton.color === "blue" ? "bg-blue-500 hover:bg-blue-600" : ""}
            `}
          >
            {authButton.label}
          </Link>
        ) : (
          <button
            onClick={authButton.onClick}
            className={`
              w-32 h-32
              flex items-center justify-center
              text-center
              rounded-full
              text-white
              font-semibold
              shadow-lg
              transition-all duration-200
              hover:scale-105
              active:scale-95
              ${authButton.color === "red" ? "bg-red-500 hover:bg-red-600" : ""}
            `}
          >
            {authButton.label}
          </button>
        )}
      </div>
    </div>
  );
}
