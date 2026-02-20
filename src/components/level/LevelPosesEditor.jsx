"use client";

import React, { useMemo, useState } from "react";
import PoseCapture from "@/components/Pose/poseCapture";

/**
 * Pose capture section. Stores poses as a map of JSON strings.
 */
export default function LevelPosesEditor({
  poses = {},
  poseTolerancePctById = {},
  onPosesUpdate,
  onPoseToleranceUpdate,
  onRemovePose,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);

  const count = useMemo(() => {
    try {
      return poses ? Object.keys(poses).length : 0;
    } catch {
      return 0;
    }
  }, [poses]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Pose Capture</h3>
          <p className="text-sm text-gray-600">Captured poses: {count}</p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={disabled}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {open ? "Hide Pose Capture" : "Show Pose Capture"}
        </button>
      </div>

      {open && (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
          <PoseCapture
            poses={poses}
            onPosesUpdate={onPosesUpdate}
            poseTolerancePctById={poseTolerancePctById}
            onPoseToleranceUpdate={onPoseToleranceUpdate}
            disabled={disabled}
          />
        </div>
      )}

      {onRemovePose && poses && Object.keys(poses).length > 0 && (
        <div className="space-y-2">
          {Object.keys(poses).map((key) => (
            <div
              key={key}
              className="flex items-center justify-between gap-3 p-2 border border-gray-200 rounded-lg"
            >
              <span className="text-sm text-gray-700 truncate">{key}</span>
              <button
                type="button"
                onClick={() => onRemovePose(key)}
                disabled={disabled}
                className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-sm text-gray-500">
        These poses can be used for pose matching during gameplay.
      </p>
    </div>
  );
}
