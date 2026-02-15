"use client";

import { useState, useCallback } from "react";

export const GAME_STATES = {
  INTRO: "INTRO",
  TWEEN: "TWEEN",
  POSE_MATCH: "POSE_MATCH",
  INTUITION: "INTUITION",
  INSIGHT: "INSIGHT",
  OUTRO: "OUTRO",
  COMPLETE: "COMPLETE"
};

export function useGameState() {

  const [state, setState] = useState(GAME_STATES.INTRO);

  const next = useCallback(() => {

    setState(prev => {

      switch(prev) {

        case GAME_STATES.INTRO:
          return GAME_STATES.TWEEN;

        case GAME_STATES.TWEEN:
          return GAME_STATES.POSE_MATCH;

        case GAME_STATES.POSE_MATCH:
          return GAME_STATES.INTUITION;

        case GAME_STATES.INTUITION:
          return GAME_STATES.INSIGHT;

        case GAME_STATES.INSIGHT:
          return GAME_STATES.OUTRO;

        case GAME_STATES.OUTRO:
          return GAME_STATES.COMPLETE;

        default:
          return prev;
      }

    });

  }, []);

  return {
    state,
    setState,
    next
  };

}
