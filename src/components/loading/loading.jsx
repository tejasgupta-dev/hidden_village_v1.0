const Loader = () => {
  const cells = [
    { delay: 0, color: "#d4aee0" },
    { delay: 100, color: "#8975b4" },
    { delay: 200, color: "#64518a" },
    { delay: 300, color: "#565190" },
    { delay: 100, color: "#44abac" },
    { delay: 200, color: "#2ca7d8" },
    { delay: 300, color: "#1482ce" },
    { delay: 400, color: "#05597c" },
    { delay: 200, color: "#b2dd57" },
    { delay: 300, color: "#57c443" },
    { delay: 400, color: "#05b853" },
    { delay: 500, color: "#19962e" },
    { delay: 300, color: "#fdc82e" },
    { delay: 400, color: "#fd9c2e" },
    { delay: 500, color: "#d5385a" },
    { delay: 600, color: "#911750" },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#2b2b2b] text-white">
      <h2 className="text-2xl font-light mb-6">Loading...</h2>

      <div className="grid grid-cols-4 gap-[1px]">
        {cells.map((cell, index) => (
          <div
            key={index}
            className="w-16 h-16 border animate-ripple"
            style={{
              borderColor: cell.color,
              animationDelay: `${cell.delay}ms`,
              "--cell-color": cell.color,
            }}
          />
        ))}
      </div>

      {/* Keyframes */}
      <style jsx>{`
        @keyframes ripple {
          0% {
            background-color: transparent;
          }
          30% {
            background-color: var(--cell-color);
          }
          60% {
            background-color: transparent;
          }
          100% {
            background-color: transparent;
          }
        }

        .animate-ripple {
          animation: ripple 1.5s ease infinite;
        }
      `}</style>
    </div>
  );
};

export default Loader;
