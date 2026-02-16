(function initGeneratorTeamSelectionFeature(global) {
    const TEAM_A = 'teamA';
    const TEAM_B = 'teamB';
    const ROLE_STARTER = 'starter';
    const ROLE_SUBSTITUTE = 'substitute';

    function normalizeRole(value) {
        return value === ROLE_SUBSTITUTE ? ROLE_SUBSTITUTE : ROLE_STARTER;
    }

    function normalizeTeamKey(value) {
        if (value === 'A' || value === TEAM_A) {
            return TEAM_A;
        }
        if (value === 'B' || value === TEAM_B) {
            return TEAM_B;
        }
        return TEAM_A;
    }

    function toName(value) {
        return typeof value === 'string' ? value.trim() : '';
    }

    function cloneTeamPlayers(players) {
        const source = Array.isArray(players) ? players : [];
        return source
            .map(function mapSelection(selection) {
                const name = toName(selection && selection.name);
                if (!name) {
                    return null;
                }
                return {
                    name: name,
                    role: normalizeRole(selection && selection.role),
                };
            })
            .filter(Boolean);
    }

    function cloneSelections(selections) {
        const source = selections && typeof selections === 'object' ? selections : {};
        return {
            teamA: cloneTeamPlayers(source.teamA),
            teamB: cloneTeamPlayers(source.teamB),
        };
    }

    function countRole(players, role) {
        return players.reduce(function reducer(total, player) {
            return total + (player && player.role === role ? 1 : 0);
        }, 0);
    }

    function getStarterCount(selections, teamKey) {
        const cloned = cloneSelections(selections);
        const key = normalizeTeamKey(teamKey);
        return countRole(cloned[key], ROLE_STARTER);
    }

    function getSubstituteCount(selections, teamKey) {
        const cloned = cloneSelections(selections);
        const key = normalizeTeamKey(teamKey);
        return countRole(cloned[key], ROLE_SUBSTITUTE);
    }

    function getCurrentTeamCounts(selections) {
        return {
            teamAStarterCount: getStarterCount(selections, TEAM_A),
            teamASubCount: getSubstituteCount(selections, TEAM_A),
            teamBStarterCount: getStarterCount(selections, TEAM_B),
            teamBSubCount: getSubstituteCount(selections, TEAM_B),
        };
    }

    function buildTeamSelectionMaps(selections) {
        const cloned = cloneSelections(selections);
        return {
            teamA: new Map(cloned.teamA.map(function mapPlayer(item) { return [item.name, item]; })),
            teamB: new Map(cloned.teamB.map(function mapPlayer(item) { return [item.name, item]; })),
        };
    }

    function hasAnySelectedPlayers(selections) {
        const cloned = cloneSelections(selections);
        return cloned.teamA.length + cloned.teamB.length > 0;
    }

    function toggleTeamSelection(selections, playerName, team, limits) {
        const name = toName(playerName);
        if (!name) {
            return {
                changed: false,
                reason: 'invalid_player',
                teamA: [],
                teamB: [],
            };
        }

        const cloned = cloneSelections(selections);
        const options = limits && typeof limits === 'object' ? limits : {};
        const maxTotal = Number.isFinite(Number(options.maxTotal)) ? Number(options.maxTotal) : 30;
        const maxStarters = Number.isFinite(Number(options.maxStarters)) ? Number(options.maxStarters) : 20;
        const maxSubstitutes = Number.isFinite(Number(options.maxSubstitutes)) ? Number(options.maxSubstitutes) : 10;

        const teamKey = normalizeTeamKey(team);
        const otherTeamKey = teamKey === TEAM_A ? TEAM_B : TEAM_A;
        const currentTeam = cloned[teamKey];
        const otherTeam = cloned[otherTeamKey];

        const existingIndex = currentTeam.findIndex(function findPlayer(player) { return player.name === name; });
        if (existingIndex > -1) {
            currentTeam.splice(existingIndex, 1);
            return {
                changed: true,
                reason: 'removed',
                teamA: cloned.teamA,
                teamB: cloned.teamB,
            };
        }

        const otherIndex = otherTeam.findIndex(function findOther(player) { return player.name === name; });
        if (otherIndex > -1) {
            otherTeam.splice(otherIndex, 1);
        }

        if (currentTeam.length >= maxTotal) {
            return {
                changed: false,
                reason: 'team_full',
                teamA: cloned.teamA,
                teamB: cloned.teamB,
            };
        }

        const starterCount = countRole(currentTeam, ROLE_STARTER);
        const substituteCount = countRole(currentTeam, ROLE_SUBSTITUTE);

        let role = null;
        if (starterCount < maxStarters) {
            role = ROLE_STARTER;
        } else if (substituteCount < maxSubstitutes) {
            role = ROLE_SUBSTITUTE;
        }

        if (!role) {
            return {
                changed: false,
                reason: 'roles_full',
                teamA: cloned.teamA,
                teamB: cloned.teamB,
            };
        }

        currentTeam.push({ name: name, role: role });
        return {
            changed: true,
            reason: 'added',
            teamA: cloned.teamA,
            teamB: cloned.teamB,
        };
    }

    function setPlayerRole(selections, playerName, nextRole, limits) {
        const name = toName(playerName);
        if (!name) {
            return {
                changed: false,
                reason: 'invalid_player',
                teamA: [],
                teamB: [],
                teamKey: null,
            };
        }

        const cloned = cloneSelections(selections);
        const role = normalizeRole(nextRole);
        const options = limits && typeof limits === 'object' ? limits : {};
        const maxStarters = Number.isFinite(Number(options.maxStarters)) ? Number(options.maxStarters) : 20;
        const maxSubstitutes = Number.isFinite(Number(options.maxSubstitutes)) ? Number(options.maxSubstitutes) : 10;

        let teamKey = TEAM_A;
        let index = cloned.teamA.findIndex(function findA(player) { return player.name === name; });

        if (index === -1) {
            teamKey = TEAM_B;
            index = cloned.teamB.findIndex(function findB(player) { return player.name === name; });
        }

        if (index === -1) {
            return {
                changed: false,
                reason: 'not_found',
                teamA: cloned.teamA,
                teamB: cloned.teamB,
                teamKey: null,
            };
        }

        const teamPlayers = cloned[teamKey];
        const currentRole = normalizeRole(teamPlayers[index].role);
        if (currentRole === role) {
            return {
                changed: false,
                reason: 'unchanged',
                teamA: cloned.teamA,
                teamB: cloned.teamB,
                teamKey: teamKey,
            };
        }

        if (role === ROLE_STARTER && countRole(teamPlayers, ROLE_STARTER) >= maxStarters) {
            return {
                changed: false,
                reason: 'starters_full',
                teamA: cloned.teamA,
                teamB: cloned.teamB,
                teamKey: teamKey,
            };
        }

        if (role === ROLE_SUBSTITUTE && countRole(teamPlayers, ROLE_SUBSTITUTE) >= maxSubstitutes) {
            return {
                changed: false,
                reason: 'substitutes_full',
                teamA: cloned.teamA,
                teamB: cloned.teamB,
                teamKey: teamKey,
            };
        }

        teamPlayers[index].role = role;
        return {
            changed: true,
            reason: 'updated',
            teamA: cloned.teamA,
            teamB: cloned.teamB,
            teamKey: teamKey,
        };
    }

    function clearPlayerSelection(selections, playerName) {
        const name = toName(playerName);
        const cloned = cloneSelections(selections);
        if (!name) {
            return {
                changed: false,
                teamA: cloned.teamA,
                teamB: cloned.teamB,
            };
        }

        const beforeA = cloned.teamA.length;
        const beforeB = cloned.teamB.length;
        cloned.teamA = cloned.teamA.filter(function keepA(player) { return player.name !== name; });
        cloned.teamB = cloned.teamB.filter(function keepB(player) { return player.name !== name; });

        return {
            changed: beforeA !== cloned.teamA.length || beforeB !== cloned.teamB.length,
            teamA: cloned.teamA,
            teamB: cloned.teamB,
        };
    }

    function clearAllSelections() {
        return {
            changed: true,
            teamA: [],
            teamB: [],
        };
    }

    global.DSFeatureGeneratorTeamSelection = {
        getStarterCount: getStarterCount,
        getSubstituteCount: getSubstituteCount,
        getCurrentTeamCounts: getCurrentTeamCounts,
        buildTeamSelectionMaps: buildTeamSelectionMaps,
        hasAnySelectedPlayers: hasAnySelectedPlayers,
        toggleTeamSelection: toggleTeamSelection,
        setPlayerRole: setPlayerRole,
        clearPlayerSelection: clearPlayerSelection,
        clearAllSelections: clearAllSelections,
    };
})(window);