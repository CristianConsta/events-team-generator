(function initAssignmentRegistry(global) {
    const DEFAULT_ASSIGNMENT_ALGORITHM_ID = 'balanced_round_robin';

    const ASSIGNMENT_REGISTRY = {
        balanced_round_robin: {
            id: 'balanced_round_robin',
            name: 'Balanced Round Robin',
            description: 'Current default assignment strategy.',
            enabled: true,
        },
    };

    function cloneDeep(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function normalizeAlgorithmId(value) {
        if (typeof value !== 'string') {
            return '';
        }
        return value.trim().toLowerCase();
    }

    function listAllAlgorithms() {
        return Object.keys(ASSIGNMENT_REGISTRY).map((algorithmId) => cloneDeep(ASSIGNMENT_REGISTRY[algorithmId]));
    }

    function getAlgorithm(algorithmId) {
        const normalizedId = normalizeAlgorithmId(algorithmId);
        if (!normalizedId || !Object.prototype.hasOwnProperty.call(ASSIGNMENT_REGISTRY, normalizedId)) {
            return null;
        }
        return cloneDeep(ASSIGNMENT_REGISTRY[normalizedId]);
    }

    function resolveGameAlgorithmIds(gameId) {
        if (!global.DSCoreGames || typeof global.DSCoreGames.getGame !== 'function') {
            return [DEFAULT_ASSIGNMENT_ALGORITHM_ID];
        }
        const game = global.DSCoreGames.getGame(gameId);
        if (!game || !Array.isArray(game.assignmentAlgorithmIds) || game.assignmentAlgorithmIds.length === 0) {
            return [DEFAULT_ASSIGNMENT_ALGORITHM_ID];
        }
        return game.assignmentAlgorithmIds.map((id) => normalizeAlgorithmId(id)).filter(Boolean);
    }

    function listAlgorithmsForGame(gameId) {
        const algorithmIds = resolveGameAlgorithmIds(gameId);
        return algorithmIds
            .map((algorithmId) => getAlgorithm(algorithmId))
            .filter(Boolean);
    }

    function resolveAlgorithmForEvent(gameId, assignmentAlgorithmId) {
        const selection = resolveAlgorithmSelection(gameId, assignmentAlgorithmId);
        return selection.success ? selection.algorithm : null;
    }

    function resolveAlgorithmSelection(gameId, assignmentAlgorithmId) {
        const requestedId = normalizeAlgorithmId(assignmentAlgorithmId) || DEFAULT_ASSIGNMENT_ALGORITHM_ID;
        const gameAlgorithmIds = resolveGameAlgorithmIds(gameId);
        if (!gameAlgorithmIds.includes(requestedId)) {
            return {
                success: false,
                error: 'unknown-assignment-algorithm',
                algorithmId: requestedId,
                gameId: typeof gameId === 'string' ? gameId : '',
            };
        }
        const algorithm = getAlgorithm(requestedId);
        if (!algorithm) {
            return {
                success: false,
                error: 'unknown-assignment-algorithm',
                algorithmId: requestedId,
                gameId: typeof gameId === 'string' ? gameId : '',
            };
        }
        return {
            success: true,
            algorithmId: requestedId,
            gameId: typeof gameId === 'string' ? gameId : '',
            algorithm: algorithm,
        };
    }

    global.DSAssignmentRegistry = {
        DEFAULT_ASSIGNMENT_ALGORITHM_ID: DEFAULT_ASSIGNMENT_ALGORITHM_ID,
        ASSIGNMENT_REGISTRY: ASSIGNMENT_REGISTRY,
        getAlgorithm: getAlgorithm,
        listAllAlgorithms: listAllAlgorithms,
        listAlgorithmsForGame: listAlgorithmsForGame,
        resolveAlgorithmForEvent: resolveAlgorithmForEvent,
        resolveAlgorithmSelection: resolveAlgorithmSelection,
    };
})(window);
