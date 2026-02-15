"use client";

export default function IntuitionState({
  onComplete,
  storeEvent
}) {

  function next() {

    storeEvent("intuition_complete");

    onComplete();
  }

  return (

    <div className="flex items-center justify-center h-full">

      <button
        onClick={next}
        className="bg-purple-600 text-white px-6 py-3 rounded"
      >
        Continue Intuition
      </button>

    </div>

  );

}
