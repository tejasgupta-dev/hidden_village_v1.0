"use client";

import Link from "next/link";

export default function Home() {
  const buttons = [
    { label: "Edit Level", href: "/edit-game" },
  ];

  return (
    <div className="absolute inset-0 flex items-center justify-center">
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
      </div>
    </div>
  );
}
