"use client";

import { normalizeStateType, STATE_TYPES } from "@/lib/gamePlayer/states/_shared/stateTypes";
import IntroView from "./states/Views/IntroView";
import TweenView from "./states/Views/TweenView";
import PoseMatchView from "./states/Views/PoseMatchView";
import InsightView from "./states/Views/InsightView";
import OutroView from "./states/Views/OutroView";

export default function StateRenderer({ session, dispatch, poseDataRef }) {
  const node = session?.node;
  const type = normalizeStateType(node?.type ?? node?.state ?? null);

  switch (type) {
    case STATE_TYPES.INTRO:
      return <IntroView session={session} node={node} dispatch={dispatch} poseDataRef={poseDataRef} />;

    case STATE_TYPES.TWEEN:
      return <TweenView node={node} dispatch={dispatch} />;

    case STATE_TYPES.POSE_MATCH:
      return <PoseMatchView node={node} dispatch={dispatch} poseDataRef={poseDataRef} />;

    case STATE_TYPES.INSIGHT:
      return <InsightView node={node} dispatch={dispatch} poseDataRef={poseDataRef} />;

    case STATE_TYPES.OUTRO:
      return <OutroView node={node} dispatch={dispatch} poseDataRef={poseDataRef} />;  

    default:
      return null;
  }
}
