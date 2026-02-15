import { apiClient } from "./apiClient";

/* ===============================
   GAMES MENU API
   For browsing, listing, and selecting games
================================ */

export const gameMenuApi = {
  /* ===============================
     LIST GAMES
  ================================ */

  /**
   * List all published games (public, no auth required)
   * Returns minimal game info for menu display
   * @returns {Promise<{success: boolean, games: Array<{id, name, keywords}>}>}
   */
  async listPublic() {
    return apiClient("/api/games?mode=public");
  },

  /**
   * List all games for management (requires auth)
   * Returns all games with ownership info
   * @returns {Promise<{success: boolean, games: Array}>}
   */
  async listManage() {
    return apiClient("/api/games", {
      credentials: "include",
    });
  },

  /**
   * Get a game's basic info for menu/preview (public)
   * @param {string} gameId - The game ID
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async getGamePreview(gameId) {
    return apiClient(`/api/games/${gameId}?mode=play`);
  },
};

/* ===============================
   HELPER FUNCTIONS FOR MENU
================================ */

/**
 * Search games by keyword
 * @param {Array} games - Array of games
 * @param {string} searchTerm - Search term
 * @returns {Array} Filtered games
 */
export function searchGames(games, searchTerm) {
  if (!searchTerm || !searchTerm.trim()) {
    return games;
  }

  const term = searchTerm.toLowerCase().trim();

  return games.filter((game) => {
    const name = (game.name || "").toLowerCase();
    const keywords = (game.keywords || "").toLowerCase();
    const description = (game.description || "").toLowerCase();

    return (
      name.includes(term) ||
      keywords.includes(term) ||
      description.includes(term)
    );
  });
}

/**
 * Sort games by criteria
 * @param {Array} games - Array of games
 * @param {string} sortBy - Sort criteria ('name', 'date', 'updated', 'levels')
 * @param {string} order - Sort order ('asc' or 'desc')
 * @returns {Array} Sorted games
 */
export function sortGames(games, sortBy = "name", order = "asc") {
  const sorted = [...games];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "name":
        comparison = (a.name || "").localeCompare(b.name || "");
        break;
      case "date":
        comparison = (a.createdAt || 0) - (b.createdAt || 0);
        break;
      case "updated":
        comparison = (a.updatedAt || 0) - (b.updatedAt || 0);
        break;
      case "levels":
        comparison = (a.levelIds?.length || 0) - (b.levelIds?.length || 0);
        break;
      default:
        comparison = 0;
    }

    return order === "asc" ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Filter games by publish status
 * @param {Array} games - Array of games
 * @param {boolean} published - Filter for published games
 * @returns {Array} Filtered games
 */
export function filterGamesByStatus(games, published) {
  return games.filter((game) => game.isPublished === published);
}

/**
 * Get games by author
 * @param {Array} games - Array of games
 * @param {string} authorUid - Author UID
 * @returns {Array} Filtered games
 */
export function getGamesByAuthor(games, authorUid) {
  return games.filter((game) => game.authorUid === authorUid);
}

/**
 * Check if a game is published
 * @param {Object} game - Game object
 * @returns {boolean}
 */
export function isGamePublished(game) {
  return game?.isPublished === true;
}

/**
 * Check if a game has a PIN
 * @param {Object} game - Game object
 * @returns {boolean}
 */
export function isGameProtected(game) {
  return Boolean(game?.pin && game.pin.length > 0);
}

/**
 * Check if user is game owner
 * @param {Object} game - Game object
 * @param {string} userUid - User UID
 * @returns {boolean}
 */
export function isGameOwner(game, userUid) {
  return game?.authorUid === userUid;
}

/**
 * Format game for menu display
 * @param {Object} game - Game object
 * @returns {Object} Formatted game
 */
export function formatGameForMenu(game) {
  return {
    id: game.id,
    name: game.name || "Untitled Game",
    description: game.description || "",
    keywords: game.keywords || "",
    levelCount: game.levelIds?.length || 0,
    isPublished: game.isPublished || false,
    hasPin: isGameProtected(game),
    author: game.author || "Anonymous",
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
  };
}

export default gameMenuApi;