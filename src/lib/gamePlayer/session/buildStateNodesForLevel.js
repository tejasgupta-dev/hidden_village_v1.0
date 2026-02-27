"use client";

import { STATE_TYPES } from "@/lib/gamePlayer/states/_shared/stateTypes";

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

// Accept 0..1 or 0..100; output 0..100
function toPct(value) {
  const t = Number(value);
  if (!Number.isFinite(t)) return null;
  return t <= 1 ? t * 100 : t;
}

function clampPct(v, fallback = 60) {
  const n = toPct(v);
  if (!Number.isFinite(n)) return fallback;
  return clamp(n, 0, 100);
}

function normalizeDialogueLines(raw) {
  if (!raw) return [];
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.lines)
    ? raw.lines
    : Array.isArray(raw?.dialogues)
    ? raw.dialogues
    : [];

  return arr
    .map((x) => {
      if (typeof x === "string") return { text: x };

      if (x && typeof x === "object") {
        const text = String(x.text ?? "").trim();
        if (!text) return null;

        // NEW preferred field
        const speakerId =
          typeof x.speakerId === "string" && x.speakerId.trim()
            ? x.speakerId.trim()
            : null;

        // Legacy field support (some older content stored a speaker name string)
        const speaker =
          !speakerId && typeof x.speaker === "string" && x.speaker.trim()
            ? x.speaker.trim()
            : undefined;

        // Return both for compatibility:
        // - IntroView can prefer speakerId -> sprite map
        // - Legacy UI can still show speaker name if present
        const out = { text };
        if (speakerId) out.speakerId = speakerId;
        if (speaker) out.speaker = speaker;

        return out;
      }

      return null;
    })
    .filter(Boolean);
}

function normalizeOptions(raw) {
  if (!raw) return [];

  // Array: ["A","B"] or [{text:"A"}]
  if (Array.isArray(raw)) {
    return raw
      .map((x) => {
        if (typeof x === "string") return x.trim();
        if (x && typeof x === "object") return String(x.text ?? x.label ?? "").trim();
        return "";
      })
      .filter((s) => s.length > 0);
  }

  // RTDB object: {0:"A",1:"B"} or {a:"A"}
  if (isPlainObject(raw)) {
    return Object.values(raw)
      .map((v) => (typeof v === "string" ? v.trim() : String(v?.text ?? v?.label ?? "").trim()))
      .filter((s) => s.length > 0);
  }

  return [];
}

function getPoseIds(level) {
  const poses = level?.poses;
  if (!poses) return [];

  if (Array.isArray(poses)) {
    return poses.map((p) => p?.id ?? p?.poseId ?? p?.key ?? null).filter(Boolean);
  }

  if (typeof poses === "object") {
    return Object.keys(poses)
      .filter(Boolean)
      .sort((a, b) => {
        const ta = Number(String(a).split("_")[1] ?? 0);
        const tb = Number(String(b).split("_")[1] ?? 0);
        return ta - tb;
      });
  }

  return [];
}

function resolveCursorDelayMS({ storyLevel, level }, nodeType) {
  if (nodeType === STATE_TYPES.INTRO) {
    return (
      storyLevel?.introCursorDelayMS ??
      storyLevel?.cursorDelayMS ??
      level?.introCursorDelayMS ??
      level?.cursorDelayMS ??
      level?.settings?.cursor?.delayMS ??
      level?.cursor?.delayMS ??
      undefined
    );
  }

  if (nodeType === STATE_TYPES.OUTRO) {
    return (
      storyLevel?.outroCursorDelayMS ??
      storyLevel?.cursorDelayMS ??
      level?.outroCursorDelayMS ??
      level?.cursorDelayMS ??
      level?.settings?.cursor?.delayMS ??
      level?.cursor?.delayMS ??
      undefined
    );
  }

  return (
    storyLevel?.poseCursorDelayMS ??
    storyLevel?.cursorDelayMS ??
    level?.poseCursorDelayMS ??
    level?.cursorDelayMS ??
    level?.settings?.cursor?.delayMS ??
    level?.cursor?.delayMS ??
    undefined
  );
}

function resolveAutoAdvanceMS({ storyLevel, level }, nodeType) {
  if (nodeType === STATE_TYPES.INTRO) {
    return (
      storyLevel?.introAutoAdvanceMS ??
      storyLevel?.autoAdvanceMS ??
      level?.introAutoAdvanceMS ??
      level?.autoAdvanceMS ??
      undefined
    );
  }

  if (nodeType === STATE_TYPES.OUTRO) {
    return (
      storyLevel?.outroAutoAdvanceMS ??
      storyLevel?.autoAdvanceMS ??
      level?.outroAutoAdvanceMS ??
      level?.autoAdvanceMS ??
      undefined
    );
  }

  return storyLevel?.autoAdvanceMS ?? level?.autoAdvanceMS ?? undefined;
}

function resolveDefaultPoseTolerance({ storyLevel, level }) {
  return clampPct(level?.poseThreshold ?? storyLevel?.poseThreshold ?? 60, 60);
}

function resolvePoseTolerances({ storyLevel, level }, poseIds) {
  const defaultTol = resolveDefaultPoseTolerance({ storyLevel, level });

  const mapA = isPlainObject(level?.poseTolerancePctById) ? level.poseTolerancePctById : null;
  const mapB = isPlainObject(level?.poseTolerancesById) ? level.poseTolerancesById : null;

  return poseIds.map((poseId) => {
    const raw =
      (mapA && Object.prototype.hasOwnProperty.call(mapA, poseId) ? mapA[poseId] : undefined) ??
      (mapB && Object.prototype.hasOwnProperty.call(mapB, poseId) ? mapB[poseId] : undefined);

    if (raw === undefined || raw === null || raw === "") return defaultTol;
    return clampPct(raw, defaultTol);
  });
}

/**
 * Prefer merged session settings (passed in) over level.settings
 * so DEFAULT_SETTINGS.states.poseMatch=false actually works.
 */
function getStateEnabled({ level, settings }, key, fallback = true) {
  const flags =
    (settings?.states && isPlainObject(settings.states) ? settings.states : null) ??
    (level?.settings?.states && isPlainObject(level.settings.states) ? level.settings.states : null);

  if (!flags) return fallback;
  if (!Object.prototype.hasOwnProperty.call(flags, key)) return fallback;
  return flags[key] === true;
}

export function buildStateNodesForLevel({
  level: levelInput,
  story: gameInput,
  levelIndex = 0,
  settings = null, // <-- merged settings from createSession
}) {
  // RTDB: treat as plain objects
  const level = levelInput ?? null;
  const game = gameInput ?? null;

  const nodes = [];

  const storyLevel = Array.isArray(game?.storyline) ? game.storyline[levelIndex] ?? null : null;

  const levelId = level?.id ?? null;
  const gameId = game?.id ?? null;

  // eslint-disable-next-line no-console
  console.log("[builder] effective settings.states:", settings?.states ?? level?.settings?.states);

  /* ----------------------------- INTRO ----------------------------- */
  const introLines = normalizeDialogueLines(storyLevel?.intro);
  if (getStateEnabled({ level, settings }, "intro", true) && introLines.length > 0) {
    nodes.push({
      type: STATE_TYPES.INTRO,
      lines: introLines,
      cursorDelayMS: resolveCursorDelayMS({ storyLevel, level }, STATE_TYPES.INTRO),
      autoAdvanceMS: resolveAutoAdvanceMS({ storyLevel, level }, STATE_TYPES.INTRO),
      levelId,
      gameId,
    });
  }

  /* ---------------------- INTUITION / INSIGHT ---------------------- */
  const question = String(level?.question ?? "").trim();
  const hasQuestion = question.length > 0;

  // strict boolean only
  const trueFalseEnabled = level?.trueFalseEnabled === true;

  const optionsRaw = level?.options ?? null;
  const options = normalizeOptions(optionsRaw);
  const hasOptions = options.length >= 1;

  // eslint-disable-next-line no-console
  console.log("[builder] question:", question, "hasQuestion:", hasQuestion);
  // eslint-disable-next-line no-console
  console.log("[builder] trueFalseEnabled:", trueFalseEnabled);
  // eslint-disable-next-line no-console
  console.log("[builder] options.length:", options.length);

  // INTUITION only if enabled + question exists + trueFalseEnabled
  if (getStateEnabled({ level, settings }, "intuition", true) && hasQuestion && trueFalseEnabled) {
    nodes.push({
      type: STATE_TYPES.INTUITION,
      question,
      trueFalseEnabled: true,
      trueFalseAnswer: typeof level?.trueFalseAnswer === "boolean" ? level.trueFalseAnswer : null,
      cursorDelayMS: resolveCursorDelayMS({ storyLevel, level }, STATE_TYPES.POSE_MATCH),
      levelId,
      gameId,
    });
  }

  // INSIGHT only if enabled + question exists + options exist
  if (getStateEnabled({ level, settings }, "insight", true) && hasQuestion && hasOptions) {
    nodes.push({
      type: STATE_TYPES.INSIGHT,
      question,
      options,
      cursorDelayMS: resolveCursorDelayMS({ storyLevel, level }, STATE_TYPES.POSE_MATCH),
      levelId,
      gameId,
    });
  }

  /* ----------------------------- TWEEN / POSE_MATCH ----------------------------- */
  const poseIds = Array.from(new Set(getPoseIds(level))).filter(Boolean);
  const cursorDelayMS = resolveCursorDelayMS({ storyLevel, level }, STATE_TYPES.POSE_MATCH);

  if (getStateEnabled({ level, settings }, "tween", true) && poseIds.length >= 2) {
    nodes.push({
      type: STATE_TYPES.TWEEN,
      poseIds,
      stepDurationMS: level?.tweenDurationMS ?? storyLevel?.tweenDurationMS ?? 1000,
      easing: level?.tweenEasing ?? storyLevel?.tweenEasing ?? "easeInOut",
      cursorDelayMS,
      levelId,
      gameId,
    });
  }

  if (getStateEnabled({ level, settings }, "poseMatch", true) && poseIds.length >= 1) {
    const defaultTolerance = resolveDefaultPoseTolerance({ storyLevel, level });
    const poseTolerances = resolvePoseTolerances({ storyLevel, level }, poseIds);

    nodes.push({
      type: STATE_TYPES.POSE_MATCH,
      poseIds,
      threshold: defaultTolerance,
      defaultTolerance,
      poseTolerances,
      cursorDelayMS,
      stepDurationMS: level?.poseDurationMS ?? storyLevel?.poseDurationMS ?? undefined,
      levelId,
      gameId,
    });
  }

  /* ----------------------------- OUTRO ----------------------------- */
  const outroLines = normalizeDialogueLines(storyLevel?.outro);
  if (getStateEnabled({ level, settings }, "outro", true) && outroLines.length > 0) {
    nodes.push({
      type: STATE_TYPES.OUTRO,
      lines: outroLines,
      cursorDelayMS: resolveCursorDelayMS({ storyLevel, level }, STATE_TYPES.OUTRO),
      autoAdvanceMS: resolveAutoAdvanceMS({ storyLevel, level }, STATE_TYPES.OUTRO),
      levelId,
      gameId,
    });
  }

  // eslint-disable-next-line no-console
  console.log("[builder] STATE_NODES:", nodes.map((n) => n.type));
  return nodes;
}