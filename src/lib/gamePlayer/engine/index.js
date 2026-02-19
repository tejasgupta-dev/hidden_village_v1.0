"use client";

import { getController, getNodeType, validateNode } from "./machine";

/**
 * Normalize controller return values:
 * controller methods may return:
 *  - session
 *  - { session, effects: [...] }
 *
 * We always return { session, effects }.
 */
function normalizeControllerResult(result, fallbackSession) {
  if (!result) return { session: fallbackSession, effects: [] };

  // returned an object containing session
  if (typeof result === "object" && result.session) {
    return {
      session: result.session,
      effects: Array.isArray(result.effects) ? result.effects : [],
    };
  }

  // returned session directly
  return { session: result, effects: [] };
}

function pushEffects(session, effects) {
  if (!effects || effects.length === 0) return session;
  return { ...session, effects: [...(session.effects ?? []), ...effects] };
}

export function getActiveNode(session) {
  return session?.node ?? session?.levelStateNodes?.[session?.nodeIndex] ?? null;
}

export function getActiveController(session) {
  const node = getActiveNode(session);
  return getController(node);
}

export function getActiveStateType(session) {
  const node = getActiveNode(session);
  return getNodeType(node);
}

/**
 * Validate the active node; returns { ok, error? }
 */
export function validateActiveNode(session) {
  const node = getActiveNode(session);
  return validateNode(node);
}

/**
 * Call controller.enter for the current active node.
 * Note: reducer typically already emits STATE_ENTER telemetry; controllers
 * can emit additional events or schedule node-specific stuff.
 */
export function enterActiveState(session) {
  const node = getActiveNode(session);
  const controller = getController(node);

  const res = controller.enter?.(session, node);
  const { session: nextSession, effects } = normalizeControllerResult(res, session);

  return pushEffects(nextSession, effects);
}

/**
 * Call controller.exit for the current active node.
 */
export function exitActiveState(session) {
  const node = getActiveNode(session);
  const controller = getController(node);

  const res = controller.exit?.(session, node);
  const { session: nextSession, effects } = normalizeControllerResult(res, session);

  return pushEffects(nextSession, effects);
}

/**
 * Call controller.update for the current active node.
 * tickInfo could be: { now, dt, elapsed }
 */
export function updateActiveState(session, tickInfo) {
  const node = getActiveNode(session);
  const controller = getController(node);

  const res = controller.update?.(session, node, tickInfo);
  const { session: nextSession, effects } = normalizeControllerResult(res, session);

  return pushEffects(nextSession, effects);
}

/**
 * Call controller.handleCommand for the current active node.
 * command shape: { name: string, payload?: any }
 */
export function handleActiveCommand(session, command) {
  const node = getActiveNode(session);
  const controller = getController(node);

  const res = controller.handleCommand?.(session, node, command);
  const { session: nextSession, effects } = normalizeControllerResult(res, session);

  return pushEffects(nextSession, effects);
}
