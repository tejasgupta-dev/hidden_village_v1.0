import { apiClient } from "./apiClient";

/**
 * Low-level HTTP API for levels
 * Pure HTTP operations with no business logic
 */
export const levelsApi = {
  /**
   * List all levels
   * @param {Object} params - Query parameters
   * @param {Object} options - Request options
   * @returns {Promise<{success: boolean, levels: Array}>}
   */
  list(params = {}, options = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient(`/api/levels${query ? `?${query}` : ""}`, {
      credentials: options.credentials || "omit",
    });
  },

  listPublished(options = {}) {
    return this.list({ publishedOnly: "true" }, { credentials: options.credentials || "include" });
  },

  /**
   * Get a single level
   * @param {string} levelId - The level ID
   * @param {Object} options - Request options
   * @param {string} options.pin - PIN for protected levels (sent in header)
   * @param {Object} options.params - Query parameters
   * @param {string} options.credentials - Credentials mode
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  get(levelId, options = {}) {
    const { pin, params = {}, credentials = "omit" } = options;
    const query = new URLSearchParams(params).toString();

    const headers = {};
    if (pin) {
      headers["x-level-pin"] = pin;
    }

    return apiClient(`/api/levels/${levelId}${query ? `?${query}` : ""}`, {
      credentials,
      headers,
    });
  },

  /**
   * Create a new level
   * @param {Object} levelData - Level data
   * @returns {Promise<{success: boolean, id: string, level: Object}>}
   */
  create(levelData) {
    return apiClient("/api/levels", {
      method: "POST",
      credentials: "include",
      body: JSON.stringify(levelData),
    });
  },

  /**
   * Update a level
   * @param {string} levelId - The level ID
   * @param {Object} updates - Fields to update
   * @param {Object} options - Request options
   * @param {string} options.pin - PIN for protected levels (sent in header)
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  update(levelId, updates, options = {}) {
    const { pin } = options;

    const headers = {};
    if (pin) {
      headers["x-level-pin"] = pin;
    }

    return apiClient(`/api/levels/${levelId}`, {
      method: "PATCH",
      credentials: "include",
      headers,
      body: JSON.stringify(updates),
    });
  },

  /**
   * Delete a level
   * @param {string} levelId - The level ID
   * @param {Object} options - Request options
   * @param {string} options.pin - PIN for protected levels (sent in header)
   * @returns {Promise<{success: boolean, message: string}>}
   */
  remove(levelId, options = {}) {
    const { pin } = options;

    const headers = {};
    if (pin) {
      headers["x-level-pin"] = pin;
    }

    return apiClient(`/api/levels/${levelId}`, {
      method: "DELETE",
      credentials: "include",
      headers,
    });
  },
};

export default levelsApi;