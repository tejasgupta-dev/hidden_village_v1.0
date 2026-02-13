"use client";

export default function BackgroundGrid() {
  return (
    <div
      className="fixed left-0 w-full h-[45vh] -z-10 pointer-events-none"
      style={{ top: "55vh" }}
    >
      <svg
        className="w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <g stroke="#1E40AF" strokeWidth="0.5">
          {/* Horizontal lines */}
          {[0, 2.5, 5, 10, 20, 35, 60].map((y, i) => (
            <line key={`h-${i}`} x1="0" y1={y} x2="100" y2={y} />
          ))}

          {/* Lines to sides */}
          {[1.4, 2.5, 5, 11, 17.5, 25, 37.5, 60, 100].map((y, i) => (
            <g key={`s-${i}`}>
              <line x1="50" y1="0" x2="0" y2={y} />
              <line x1="50" y1="0" x2="100" y2={y} />
            </g>
          ))}

          {/* Lines to bottom */}
          {[37.5, 50, 62.5].map((x, i) => (
            <line key={`b-${i}`} x1="50" y1="0" x2={x} y2="100" />
          ))}
        </g>
      </svg>
    </div>
  );
}
