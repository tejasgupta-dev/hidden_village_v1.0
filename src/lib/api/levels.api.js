import { apiClient } from "./apiClient";

/* ------------------ helpers ------------------ */
function buildQuery(params = {}) {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null
  );

  // URLSearchParams expects strings; stringify everything.
  const qp = new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)])
  ).toString();

  return qp ? `?${qp}` : "";
}

function buildPinHeaders(pin) {
  return pin ? { "x-level-pin": pin } : {};
}

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
    const query = buildQuery(params);
    return apiClient(`/api/levels${query}`, {
      credentials: options.credentials || "omit",
    });
  },

  listPublished(options = {}) {
    return apiClient(`/api/levels${buildQuery({ publishedOnly: true })}`, {
      credentials: options.credentials || "include",
    });
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
    const query = buildQuery(params);

    return apiClient(`/api/levels/${levelId}${query}`, {
      credentials,
      headers: buildPinHeaders(pin),
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
      headers: { "Content-Type": "application/json" },
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

    return apiClient(`/api/levels/${levelId}`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...buildPinHeaders(pin),
      },
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

    return apiClient(`/api/levels/${levelId}`, {
      method: "DELETE",
      credentials: "include",
      headers: buildPinHeaders(pin),
    });
  },
};

export default levelsApi;