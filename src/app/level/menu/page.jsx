"use client";

import { useEffect, useState } from "react";
import { levelMenuApi } from "@/lib/api/levelMenuApi"; // Update path

export default function LevelMenu() {
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Modal state
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    async function fetchLevels() {
      try {
        setLoading(true);
        const response = await levelMenuApi.list();
        
        if (response.success) {
          setLevels(response.levels || []);
        } else {
          throw new Error("Failed to fetch levels");
        }
      } catch (err) {
        console.error(err);
        setError(err.message || "Error loading levels");
        setLevels([]);
      } finally {
        setLoading(false);
      }
    }

    fetchLevels();
  }, []);

  const handleLevelClick = async (level) => {
  console.log("Clicked level:", level.id);
  
  try {
    const response = await levelMenuApi.getPreview(level.id);
    
    console.log("Preview response:", response);
    
    if (response.success) {
      console.log("✅ Access granted, navigating...");
      window.location.href = `/level/${level.id}`;
    }
  } catch (err) {
    console.error("Error accessing level:", err);
    console.log("Error code:", err.code);
    console.log("Error status:", err.status);
    console.log("Error message:", err.message);
    console.log("Error data:", err.data);
    
    // Check the error code that we preserved in apiClient
    if (err.code === "PIN_REQUIRED") {
      console.log("🔒 PIN required, opening modal");
      setSelectedLevel(level);
      setPinInput("");
      setPinError("");
      return; // STOP HERE - don't redirect
    }
    
    if (err.code === "INVALID_PIN") {
      console.log("❌ Invalid PIN");
      setPinError("Incorrect PIN");
      return; // STOP HERE
    }
    
    if (err.status === 404) {
      console.log("❌ Level not found");
      alert("Level not found. It may have been deleted.");
      return; // STOP HERE
    }
    
    if (err.status === 401) {
      console.log("❌ Not authenticated");
      alert("Please log in to access levels");
      window.location.href = "/login";
      return; // STOP HERE
    }
    
    // Default error
    console.log("❌ Unknown error");
    alert(`Error accessing level: ${err.message || "Unknown error"}`);
    return; // STOP HERE
  }
};

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    setPinError("");
    setVerifying(true);
    
    try {
      const response = await levelMenuApi.getPreview(selectedLevel.id, {
        pin: pinInput,
      });

      console.log("PIN verification response:", response);

      if (response.success) {
        console.log("✅ PIN verified, navigating...");
        // PIN verified, navigate to level
        window.location.href = `/level/${selectedLevel.id}`;
      } else {
        setPinError("Incorrect PIN");
      }
    } catch (err) {
      console.error("PIN verification error:", err);
      const errorData = err.response || err;
      
      if (errorData.code === "INVALID_PIN" || errorData.message?.includes("Invalid PIN")) {
        setPinError("Incorrect PIN");
      } else {
        setPinError(errorData.message || "Error verifying PIN");
      }
    } finally {
      setVerifying(false);
    }
  };

  const closeModal = () => {
    setSelectedLevel(null);
    setPinInput("");
    setPinError("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading levels...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Level Menu</h1>

      {levels.length === 0 ? (
        <div className="text-gray-500">No levels found</div>
      ) : (
        <div className="space-y-2">
          {levels.map((level) => (
            <div
              key={level.id}
              onClick={() => handleLevelClick(level)}
              className="border p-4 rounded cursor-pointer hover:bg-gray-100 transition-colors"
            >
              <h2 className="font-semibold">{level.name}</h2>
              <p className="text-sm text-gray-600">by {level.author}</p>
              {level.keywords && (
                <p className="text-xs text-gray-500 mt-1">{level.keywords}</p>
              )}
              {!level.isPublished && (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded mt-2 inline-block">
                  Draft
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* PIN Modal */}
      {selectedLevel && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={closeModal}
        >
          <div
            className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-2">
              🔒 PIN Required
            </h2>
            <p className="text-gray-600 mb-4">
              Enter PIN for <strong>{selectedLevel.name}</strong>
            </p>

            <form onSubmit={handlePinSubmit}>
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Enter PIN"
                className="w-full px-4 py-2 border rounded mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                disabled={verifying}
              />

              {pinError && (
                <p className="text-red-500 text-sm mb-3">❌ {pinError}</p>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={verifying || !pinInput.trim()}
                  className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {verifying ? "Verifying..." : "Submit"}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={verifying}
                  className="flex-1 bg-gray-300 px-4 py-2 rounded hover:bg-gray-400 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}