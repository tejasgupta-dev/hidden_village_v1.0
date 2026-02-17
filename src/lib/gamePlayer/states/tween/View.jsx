"use client";

import { commands } from "@/lib/gamePlayer/session/commands";
import {Tween} from "@/lib/pose/tween";

/**
 * Expected node example:
 * { type:"tween", tween: {...} } OR { durationMS, fromPoseId, toPoseId, ... }
 * Adjust mapping to your level format.
 */
export default function TweenView({ node, dispatch }) {
  const tween = node?.tween ?? node; // flexible: allow node itself to be tween config

  return (
    <div className="absolute inset-0 z-20 pointer-events-auto">
      <Tween
        tween={tween}
        onComplete={() => {
          dispatch({ type: "COMMAND", name: "TWEEN_FINISHED" });
          dispatch(commands.next());
        }}
      />
    </div>
  );
}
