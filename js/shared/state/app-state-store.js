(function initAppStateStore(global) {
    const DEFAULT_STATE = {
        navigation: {
            currentView: 'generator',
        },
        generator: {
            assignmentAlgorithm: 'balanced',
            teamSelections: {
                teamA: [],
                teamB: [],
            },
        },
        playersManagement: {
            filters: {
                searchTerm: '',
                troopsFilter: '',
                sortFilter: 'power-desc',
            },
        },
    };

    function cloneDeep(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function createStore(initialState) {
        let state = cloneDeep(DEFAULT_STATE);
        if (initialState && typeof initialState === 'object') {
            state = mergeState(state, initialState);
        }
        const listeners = new Set();

        function notify(nextState, prevState) {
            listeners.forEach(function each(listener) {
                try {
                    listener(nextState, prevState);
                } catch (error) {
                    // Listener failures should not break state transitions.
                }
            });
        }

        return {
            getState: function getState() {
                return cloneDeep(state);
            },
            setState: function setState(updater) {
                const prev = state;
                const candidate = typeof updater === 'function' ? updater(cloneDeep(state)) : updater;
                if (!candidate || typeof candidate !== 'object') {
                    return cloneDeep(state);
                }
                state = mergeState(state, candidate);
                notify(cloneDeep(state), cloneDeep(prev));
                return cloneDeep(state);
            },
            subscribe: function subscribe(listener) {
                if (typeof listener !== 'function') {
                    return function noop() {};
                }
                listeners.add(listener);
                return function unsubscribe() {
                    listeners.delete(listener);
                };
            },
        };
    }

    function mergeState(base, patch) {
        const sourceBase = base && typeof base === 'object' ? base : {};
        const sourcePatch = patch && typeof patch === 'object' ? patch : {};
        const next = Array.isArray(sourceBase) ? sourceBase.slice() : { ...sourceBase };

        Object.keys(sourcePatch).forEach(function eachKey(key) {
            const patchValue = sourcePatch[key];
            const baseValue = sourceBase[key];
            if (
                patchValue
                && typeof patchValue === 'object'
                && !Array.isArray(patchValue)
                && baseValue
                && typeof baseValue === 'object'
                && !Array.isArray(baseValue)
            ) {
                next[key] = mergeState(baseValue, patchValue);
                return;
            }

            if (Array.isArray(patchValue)) {
                next[key] = patchValue.map(function cloneItem(item) {
                    if (item && typeof item === 'object') {
                        return cloneDeep(item);
                    }
                    return item;
                });
                return;
            }

            if (patchValue && typeof patchValue === 'object') {
                next[key] = cloneDeep(patchValue);
                return;
            }

            next[key] = patchValue;
        });

        return next;
    }

    const selectors = {
        selectNavigationView: function selectNavigationView(state) {
            return state && state.navigation && state.navigation.currentView
                ? state.navigation.currentView
                : 'generator';
        },
        selectAssignmentAlgorithm: function selectAssignmentAlgorithm(state) {
            return state && state.generator && state.generator.assignmentAlgorithm
                ? state.generator.assignmentAlgorithm
                : 'balanced';
        },
        selectTeamSelections: function selectTeamSelections(state, teamKey) {
            const safeState = state && state.generator && state.generator.teamSelections
                ? state.generator.teamSelections
                : { teamA: [], teamB: [] };
            if (teamKey === 'teamA' || teamKey === 'teamB') {
                return Array.isArray(safeState[teamKey]) ? safeState[teamKey] : [];
            }
            return {
                teamA: Array.isArray(safeState.teamA) ? safeState.teamA : [],
                teamB: Array.isArray(safeState.teamB) ? safeState.teamB : [],
            };
        },
        selectTeamCounts: function selectTeamCounts(state) {
            const teamA = selectors.selectTeamSelections(state, 'teamA');
            const teamB = selectors.selectTeamSelections(state, 'teamB');
            return {
                teamAStarterCount: teamA.filter(function byStarter(item) { return item && item.role === 'starter'; }).length,
                teamASubCount: teamA.filter(function bySub(item) { return item && item.role === 'substitute'; }).length,
                teamBStarterCount: teamB.filter(function byStarter(item) { return item && item.role === 'starter'; }).length,
                teamBSubCount: teamB.filter(function bySub(item) { return item && item.role === 'substitute'; }).length,
            };
        },
        selectPlayersManagementFilters: function selectPlayersManagementFilters(state) {
            const filters = state && state.playersManagement && state.playersManagement.filters
                ? state.playersManagement.filters
                : {};
            return {
                searchTerm: String(filters.searchTerm || '').trim(),
                troopsFilter: String(filters.troopsFilter || '').trim(),
                sortFilter: String(filters.sortFilter || 'power-desc').trim() || 'power-desc',
            };
        },
    };

    function createDefaultStore(initialState) {
        return createStore(initialState || DEFAULT_STATE);
    }

    global.DSAppStateStore = {
        DEFAULT_STATE: cloneDeep(DEFAULT_STATE),
        createStore: createStore,
        createDefaultStore: createDefaultStore,
        mergeState: mergeState,
        selectors: selectors,
    };
})(window);
