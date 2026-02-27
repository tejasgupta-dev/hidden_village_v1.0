import { apiClient } from "./apiClient";

/**
 * Low-level HTTP API for games
 * Pure HTTP operations with no business logic
 */
export const gamesApi = {
  list(params = {}, options = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient(`/api/games${query ? `?${query}` : ""}`, {
      credentials: options.credentials || "omit",
    });
  },

  get(gameId, options = {}) {
    const { pin, params = {}, credentials = "omit" } = options;
    const query = new URLSearchParams(params).toString();

    const headers = {};
    if (pin) headers["x-game-pin"] = pin;

    return apiClient(`/api/games/${gameId}${query ? `?${query}` : ""}`, {
      credentials,
      headers,
    });
  },

  create(gameData) {
    return apiClient("/api/games", {
      method: "POST",
      credentials: "include",
      body: JSON.stringify(gameData),
    });
  },

  update(gameId, updates, options = {}) {
    const { pin } = options;

    const headers = {};
    if (pin) headers["x-game-pin"] = pin;

    return apiClient(`/api/games/${gameId}`, {
      method: "PATCH",
      credentials: "include",
      headers,
      body: JSON.stringify(updates),
    });
  },

  remove(gameId, options = {}) {
    const { pin } = options;

    const headers = {};
    if (pin) headers["x-game-pin"] = pin;

    return apiClient(`/api/games/${gameId}`, {
      method: "DELETE",
      credentials: "include",
      headers,
    });
  },

  getLevels(gameId) {
    return apiClient(`/api/games/${gameId}/levels`);
  },

  getLevel(gameId, levelId) {
    return apiClient(`/api/games/${gameId}/levels/${levelId}`);
  },

  /**
   * Upload a game asset (image)
   * Route: POST /api/games/:id/uploads
   */
  uploadAsset(gameId, file, options = {}) {
    const { pin, kind = "misc" } = options;

    const headers = {};
    if (pin) headers["x-game-pin"] = pin;

    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);

    return apiClient(`/api/games/${gameId}/uploads`, {
      method: "POST",
      credentials: "include",
      headers,
      body: form,
    });
  },

  /**
   * ---- NEW: Sprites library ----
   * Route:
   *  GET  /api/games/:id/sprites
   *  POST /api/games/:id/sprites
   *  GET  /api/games/:id/sprites/:spriteId
   *  DELETE /api/games/:id/sprites/:spriteId
   */

  listSprites(gameId, options = {}) {
    const { pin, credentials = "include" } = options;

    const headers = {};
    if (pin) headers["x-game-pin"] = pin;

    return apiClient(`/api/games/${gameId}/sprites`, {
      method: "GET",
      credentials,
      headers,
    });
  },

  uploadSprite(gameId, file, options = {}) {
    const {
      pin,
      type = "other", // "speaker" | "background" | "other"
      name, // optional display name
      credentials = "include",
    } = options;

    const headers = {};
    if (pin) headers["x-game-pin"] = pin;

    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    if (name) form.append("name", name);

    return apiClient(`/api/games/${gameId}/sprites`, {
      method: "POST",
      credentials,
      headers,
      body: form,
    });
  },

  getSprite(gameId, spriteId, options = {}) {
    const { pin, credentials = "include" } = options;

    const headers = {};
    if (pin) headers["x-game-pin"] = pin;

    return apiClient(`/api/games/${gameId}/sprites/${spriteId}`, {
      method: "GET",
      credentials,
      headers,
    });
  },

  deleteSprite(gameId, spriteId, options = {}) {
    const { pin, credentials = "include" } = options;

    const headers = {};
    if (pin) headers["x-game-pin"] = pin;

    return apiClient(`/api/games/${gameId}/sprites/${spriteId}`, {
      method: "DELETE",
      credentials,
      headers,
    });
  },
};

export default gamesApi;