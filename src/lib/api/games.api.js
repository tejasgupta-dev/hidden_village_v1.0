import { apiClient } from "./apiClient";

/**
 * Low-level HTTP API for games
 * Pure HTTP operations with no business logic
 */
export const gamesApi = {
  /**
   * List games with optional query parameters
   * @param {Object} params - Query parameters (mode, etc.)
   * @param {Object} options - Request options
   * @returns {Promise<{success: boolean, games: Array}>}
   */
  list(params = {}, options = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient(`/api/games${query ? `?${query}` : ""}`, {
      credentials: options.credentials || "omit",
    });
  },

  /**
   * Get a single game
   * @param {string} gameId - The game ID
   * @param {Object} options - Request options
   * @param {string} options.pin - PIN for protected games (sent in header)
   * @param {Object} options.params - Query parameters (mode, etc.)
   * @param {string} options.credentials - Credentials mode
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  get(gameId, options = {}) {
    const { pin, params = {}, credentials = "omit" } = options;
    const query = new URLSearchParams(params).toString();

    const headers = {};
    if (pin) {
      headers["x-game-pin"] = pin;
    }

    return apiClient(`/api/games/${gameId}${query ? `?${query}` : ""}`, {
      credentials,
      headers,
    });
  },

  /**
   * Create a new game
   * @param {Object} gameData - Game data
   * @returns {Promise<{success: boolean, id: string, game: Object}>}
   */
  create(gameData) {
    return apiClient("/api/games", {
      method: "POST",
      credentials: "include",
      body: JSON.stringify(gameData),
    });
  },

  /**
   * Update a game
   * @param {string} gameId - The game ID
   * @param {Object} updates - Fields to update
   * @param {Object} options - Request options
   * @param {string} options.pin - PIN for protected games (sent in header)
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  update(gameId, updates, options = {}) {
    const { pin } = options;

    const headers = {};
    if (pin) {
      headers["x-game-pin"] = pin;
    }

    return apiClient(`/api/games/${gameId}`, {
      method: "PATCH",
      credentials: "include",
      headers,
      body: JSON.stringify(updates),
    });
  },

  /**
   * Delete a game
   * @param {string} gameId - The game ID
   * @param {Object} options - Request options
   * @param {string} options.pin - PIN for protected games (sent in header)
   * @returns {Promise<{success: boolean, message: string}>}
   */
  remove(gameId, options = {}) {
    const { pin } = options;

    const headers = {};
    if (pin) {
      headers["x-game-pin"] = pin;
    }

    return apiClient(`/api/games/${gameId}`, {
      method: "DELETE",
      credentials: "include",
      headers,
    });
  },

  /**
   * Get all levels for a game
   * @param {string} gameId - The game ID
   * @returns {Promise<{success: boolean, levels: Array}>}
   */
  getLevels(gameId) {
    return apiClient(`/api/games/${gameId}/levels`);
  },

  /**
   * Get a specific level
   * @param {string} gameId - The game ID
   * @param {string} levelId - The level ID
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  getLevel(gameId, levelId) {
    return apiClient(`/api/games/${gameId}/levels/${levelId}`);
  },

  /**
   * Upload a game asset (image)
   * Route: POST /api/games/:id/uploads
   *
   * @param {string} gameId
   * @param {File} file
   * @param {Object} options
   * @param {string} options.pin - optional game PIN (sent in header)
   * @param {string} options.kind - optional folder grouping (e.g. "dialogue", "avatar", "background")
   * @returns {Promise<{success: boolean, path: string, url?: string}>}
   */
  uploadAsset(gameId, file, options = {}) {
    const { pin, kind = "misc" } = options;

    const headers = {};
    if (pin) headers["x-game-pin"] = pin;

    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);

    // NOTE: apiClient must support FormData bodies (i.e., don't force JSON headers)
    return apiClient(`/api/games/${gameId}/uploads`, {
      method: "POST",
      credentials: "include",
      headers,
      body: form,
    });
  },

};

export default gamesApi;