"use client";

import { Tween } from "@/lib/pose/tween";

export default function TweenState({
  tween,
  onComplete,
  storeEvent
}) {

  function complete() {

    storeEvent("tween_complete");

    onComplete();
  }

  return (
    <Tween
      tween={tween}
      onComplete={complete}
    />
  );

}
