/* ===============================
   USAGE EXAMPLES FOR ALL GAME APIs
================================ */

import { gamesMenuApi, searchGames, sortGames } from '@/lib/api/gamesMenuApi';
import { gameEditorApi, validateGameName, hasUnsavedChanges } from '@/lib/api/gameEditorApi';
import { gamePlayApi, getLevelNavigation, getGameMetadata } from '@/lib/api/gamePlayApi';

/* ===============================
   1. GAMES MENU API EXAMPLES
   (Browsing and selecting games)
================================ */

// Example: Public Games List Component
function PublicGamesListComponent() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGames() {
      try {
        const { success, games: data } = await gamesMenuApi.listPublic();
        if (success) {
          setGames(data);
        }
      } catch (error) {
        console.error('Failed to load games:', error);
      } finally {
        setLoading(false);
      }
    }
    loadGames();
  }, []);

  return (
    <div>
      <h1>Available Games</h1>
      {games.map((game) => (
        <div key={game.id}>
          <h3>{game.name}</h3>
          <p>{game.keywords}</p>
          <button onClick={() => window.location.href = `/play/${game.id}`}>
            Play
          </button>
        </div>
      ))}
    </div>
  );
}

// Example: Management Dashboard
function ManagementDashboard() {
  const [games, setGames] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all', 'published', 'drafts'
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadGames() {
      const { success, games: data } = await gamesMenuApi.listManage();
      if (success) {
        setGames(data);
      }
    }
    loadGames();
  }, []);

  const filteredGames = useMemo(() => {
    let filtered = games;

    // Apply search
    if (searchTerm) {
      filtered = searchGames(filtered, searchTerm);
    }

    // Apply status filter
    if (filter === 'published') {
      filtered = filtered.filter(g => g.isPublished);
    } else if (filter === 'drafts') {
      filtered = filtered.filter(g => !g.isPublished);
    }

    // Sort by name
    return sortGames(filtered, 'name', 'asc');
  }, [games, searchTerm, filter]);

  return (
    <div>
      <input
        type="text"
        placeholder="Search games..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <select value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="all">All Games</option>
        <option value="published">Published</option>
        <option value="drafts">Drafts</option>
      </select>

      {filteredGames.map((game) => (
        <div key={game.id}>
          <h3>{game.name}</h3>
          <span>{game.isPublished ? '✅ Published' : '📝 Draft'}</span>
          <button onClick={() => window.location.href = `/edit/${game.id}`}>
            Edit
          </button>
        </div>
      ))}
    </div>
  );
}

/* ===============================
   2. GAME EDITOR API EXAMPLES
   (Creating and editing games)
================================ */

// Example: Game Editor Component
function GameEditorComponent({ gameId }) {
  const [game, setGame] = useState(null);
  const [originalGame, setOriginalGame] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Load game
  useEffect(() => {
    async function loadGame() {
      try {
        const { success, game: data } = await gameEditorApi.load(gameId);
        if (success) {
          setGame(data);
          setOriginalGame(data);
        }
      } catch (error) {
        console.error('Failed to load game:', error);
      }
    }
    loadGame();
  }, [gameId]);

  // Check for unsaved changes
  useEffect(() => {
    if (game && originalGame) {
      setIsDirty(hasUnsavedChanges(originalGame, game));
    }
  }, [game, originalGame]);

  // Save game
  const handleSave = async () => {
    try {
      setSaving(true);

      const { success, game: updated } = await gameEditorApi.save(gameId, {
        name: game.name,
        description: game.description,
        keywords: game.keywords,
        levelIds: game.levelIds,
        storyline: game.storyline,
        settings: game.settings,
      });

      if (success) {
        setGame(updated);
        setOriginalGame(updated);
        alert('Game saved!');
      }
    } catch (error) {
      alert('Failed to save: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Update name with validation
  const handleNameChange = (newName) => {
    const validation = validateGameName(newName);
    if (validation.valid) {
      setGame({ ...game, name: newName });
    } else {
      alert(validation.error);
    }
  };

  // Publish game
  const handlePublish = async () => {
    try {
      const { success } = await gameEditorApi.publish(gameId);
      if (success) {
        alert('Game published!');
        const { game: updated } = await gameEditorApi.load(gameId);
        setGame(updated);
        setOriginalGame(updated);
      }
    } catch (error) {
      alert('Failed to publish: ' + error.message);
    }
  };

  // Delete game
  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this game?')) {
      try {
        await gameEditorApi.delete(gameId);
        window.location.href = '/games';
      } catch (error) {
        alert('Failed to delete: ' + error.message);
      }
    }
  };

  if (!game) return <div>Loading...</div>;

  return (
    <div>
      <h1>Edit Game</h1>

      <input
        type="text"
        value={game.name}
        onChange={(e) => handleNameChange(e.target.value)}
      />

      <textarea
        value={game.description}
        onChange={(e) => setGame({ ...game, description: e.target.value })}
      />

      <button onClick={handleSave} disabled={saving || !isDirty}>
        {saving ? 'Saving...' : isDirty ? 'Save Changes' : 'No Changes'}
      </button>

      <button onClick={handlePublish}>
        {game.isPublished ? 'Unpublish' : 'Publish'}
      </button>

      <button onClick={handleDelete}>Delete Game</button>
    </div>
  );
}

// Example: Create New Game
async function createNewGame(name) {
  try {
    const { success, id, game } = await gameEditorApi.create({
      name,
      description: '',
      keywords: '',
      levelIds: [],
      storyline: [],
      settings: {},
      pin: '',
      isPublished: false,
    });

    if (success) {
      console.log('Game created:', id);
      return { id, game };
    }
  } catch (error) {
    console.error('Failed to create game:', error);
    throw error;
  }
}

// Example: Quick Update Methods
async function quickUpdates(gameId) {
  // Update just the name
  await gameEditorApi.updateName(gameId, 'New Game Name');

  // Update just the description
  await gameEditorApi.updateDescription(gameId, 'New description');

  // Add a level
  const currentLevels = ['level1', 'level2'];
  await gameEditorApi.addLevel(gameId, 'level3', currentLevels);

  // Remove a level
  await gameEditorApi.removeLevel(gameId, 'level2', currentLevels);

  // Set PIN protection
  await gameEditorApi.setPin(gameId, '1234');

  // Remove PIN
  await gameEditorApi.removePin(gameId);

  // Toggle publish status
  const isCurrentlyPublished = true;
  await gameEditorApi.togglePublish(gameId, isCurrentlyPublished);
}

/* ===============================
   3. GAME PLAY API EXAMPLES
   (Playing games)
================================ */

// Example: Game Player Component
function GamePlayerComponent({ gameId }) {
  const [game, setGame] = useState(null);
  const [currentLevelId, setCurrentLevelId] = useState(null);
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load game and levels
  useEffect(() => {
    async function loadGameData() {
      try {
        // Load game
        const { success, game: gameData } = await gamePlayApi.load(gameId);
        if (success) {
          setGame(gameData);

          // Set first level as current
          if (gameData.levelIds && gameData.levelIds.length > 0) {
            setCurrentLevelId(gameData.levelIds[0]);
          }

          // Load all levels
          const { success: levelsSuccess, levels: levelsData } = 
            await gamePlayApi.getLevels(gameId);
          if (levelsSuccess) {
            setLevels(levelsData);
          }
        }
      } catch (error) {
        console.error('Failed to load game:', error);
      } finally {
        setLoading(false);
      }
    }
    loadGameData();
  }, [gameId]);

  // Get navigation info
  const navigation = useMemo(() => {
    if (!game || !currentLevelId) return null;
    return getLevelNavigation(game, currentLevelId);
  }, [game, currentLevelId]);

  // Navigate to next level
  const handleNext = () => {
    if (navigation?.nextLevelId) {
      setCurrentLevelId(navigation.nextLevelId);
    }
  };

  // Navigate to previous level
  const handlePrevious = () => {
    if (navigation?.previousLevelId) {
      setCurrentLevelId(navigation.previousLevelId);
    }
  };

  if (loading) return <div>Loading game...</div>;
  if (!game) return <div>Game not found</div>;

  return (
    <div>
      <h1>{game.name}</h1>
      <p>{game.description}</p>

      {/* Progress bar */}
      <div>
        Progress: {navigation?.progress}%
        ({navigation?.currentIndex + 1} / {navigation?.totalLevels})
      </div>

      {/* Current level */}
      <div>
        <h2>Level {navigation?.currentIndex + 1}</h2>
        {/* Render level content here */}
      </div>

      {/* Navigation */}
      <div>
        <button 
          onClick={handlePrevious} 
          disabled={!navigation?.hasPrevious}
        >
          Previous
        </button>

        <button 
          onClick={handleNext} 
          disabled={!navigation?.hasNext}
        >
          {navigation?.isLast ? 'Complete Game' : 'Next'}
        </button>
      </div>
    </div>
  );
}

// Example: Level Navigation Helper
function useLevelNavigation(game, currentLevelId) {
  const [navigation, setNavigation] = useState(null);

  useEffect(() => {
    if (game && currentLevelId) {
      const nav = getLevelNavigation(game, currentLevelId);
      setNavigation(nav);
    }
  }, [game, currentLevelId]);

  const goToNext = useCallback(() => {
    if (navigation?.nextLevelId) {
      return navigation.nextLevelId;
    }
    return null;
  }, [navigation]);

  const goToPrevious = useCallback(() => {
    if (navigation?.previousLevelId) {
      return navigation.previousLevelId;
    }
    return null;
  }, [navigation]);

  const goToLevel = useCallback((index) => {
    if (game && index >= 0 && index < game.levelIds.length) {
      return game.levelIds[index];
    }
    return null;
  }, [game]);

  return {
    navigation,
    goToNext,
    goToPrevious,
    goToLevel,
  };
}

// Example: Game Progress Tracker
function useGameProgress(gameId) {
  const [progress, setProgress] = useState(() => {
    // Load from localStorage
    const saved = localStorage.getItem(`game_progress_${gameId}`);
    return saved ? JSON.parse(saved) : null;
  });

  const saveProgress = useCallback((levelId, additionalData = {}) => {
    const newProgress = {
      gameId,
      currentLevelId: levelId,
      lastPlayed: Date.now(),
      ...additionalData,
    };
    setProgress(newProgress);
    localStorage.setItem(`game_progress_${gameId}`, JSON.stringify(newProgress));
  }, [gameId]);

  const clearProgress = useCallback(() => {
    setProgress(null);
    localStorage.removeItem(`game_progress_${gameId}`);
  }, [gameId]);

  return {
    progress,
    saveProgress,
    clearProgress,
  };
}

// Example: Complete Game Flow
function CompleteGameFlow({ gameId }) {
  const [game, setGame] = useState(null);
  const [currentLevelId, setCurrentLevelId] = useState(null);
  const { progress, saveProgress } = useGameProgress(gameId);

  useEffect(() => {
    async function init() {
      // Load game
      const { success, game: gameData } = await gamePlayApi.load(gameId);
      if (success) {
        setGame(gameData);

        // Resume from saved progress or start from beginning
        if (progress?.currentLevelId) {
          setCurrentLevelId(progress.currentLevelId);
        } else if (gameData.levelIds && gameData.levelIds.length > 0) {
          setCurrentLevelId(gameData.levelIds[0]);
        }
      }
    }
    init();
  }, [gameId, progress]);

  const handleLevelComplete = () => {
    const nav = getLevelNavigation(game, currentLevelId);
    
    if (nav.hasNext) {
      // Move to next level
      setCurrentLevelId(nav.nextLevelId);
      saveProgress(nav.nextLevelId);
    } else {
      // Game complete!
      alert('Congratulations! You completed the game!');
    }
  };

  const metadata = game ? getGameMetadata(game) : null;

  return (
    <div>
      {metadata && (
        <>
          <h1>{metadata.name}</h1>
          <p>{metadata.description}</p>
        </>
      )}
      {/* Render current level */}
      <button onClick={handleLevelComplete}>Complete Level</button>
    </div>
  );
}

/* ===============================
   4. COMBINED USAGE EXAMPLES
================================ */

// Example: Clone Game (Menu → Editor)
async function cloneGame(originalGameId) {
  try {
    // Load original game using play API (gets public data)
    const { success, game: original } = await gamePlayApi.load(originalGameId);
    
    if (success) {
      // Create new game with copied data
      const { id: newGameId } = await gameEditorApi.create({
        name: `${original.name} (Copy)`,
        description: original.description,
        keywords: original.keywords,
        levelIds: [...original.levelIds],
        storyline: [...original.storyline],
        settings: { ...original.settings },
        pin: '',
        isPublished: false,
      });

      return newGameId;
    }
  } catch (error) {
    console.error('Failed to clone game:', error);
    throw error;
  }
}

// Example: Play from Editor
function EditAndPlayButton({ gameId }) {
  const [game, setGame] = useState(null);

  useEffect(() => {
    async function load() {
      const { success, game: data } = await gameEditorApi.load(gameId);
      if (success) setGame(data);
    }
    load();
  }, [gameId]);

  const handlePlay = () => {
    if (game?.isPublished) {
      // Play published game
      window.open(`/play/${gameId}`, '_blank');
    } else {
      alert('Please publish the game first');
    }
  };

  return (
    <button onClick={handlePlay}>
      {game?.isPublished ? 'Play Game' : 'Publish to Play'}
    </button>
  );
}

export {
  PublicGamesListComponent,
  ManagementDashboard,
  GameEditorComponent,
  GamePlayerComponent,
  createNewGame,
  cloneGame,
};