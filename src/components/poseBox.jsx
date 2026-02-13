import React, { useState } from "react";
import { X } from "lucide-react";
import PoseDrawer from "../../Pose/PoseDrawer";

const PoseBox = ({
  width = 200,
  height = 150,
  name = "",
  currentPoseData = null,
  onPoseCapture = () => {},
}) => {
  const [capturedPose, setCapturedPose] = useState(null);

  const handleCapture = () => {
    setCapturedPose(currentPoseData);
    onPoseCapture(currentPoseData);
  };

  const handleClear = () => {
    setCapturedPose(null);
    onPoseCapture(null);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium text-sm text-gray-800">
          {name}
        </span>

        <button
          onClick={handleClear}
          className="text-gray-500 hover:text-red-500 transition-colors duration-200"
        >
          <X size={18} />
        </button>
      </div>

      {/* Pose Container */}
      <div
        className="border border-gray-200 rounded-lg overflow-hidden bg-gray-100 mb-3"
        style={{ height }}
      >
        {capturedPose ? (
          <PoseDrawer
            poseData={capturedPose}
            width={width}
            height={height}
            similarityScores={null}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            No pose captured
          </div>
        )}
      </div>

      {/* Capture Button */}
      <button
        onClick={handleCapture}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm py-2 px-4 rounded transition-colors duration-200"
      >
        {capturedPose ? "Update Pose" : "Capture Pose"}
      </button>
    </div>
  );
};

export default PoseBox;
