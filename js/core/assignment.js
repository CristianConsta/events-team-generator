(function initAssignmentCore(global) {
    const POWER_SIMILARITY_THRESHOLD = 1000000;

    function toNumeric(value) {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : 0;
    }

    function comparePlayersForAssignment(a, b) {
        const powerA = toNumeric(a && a.power);
        const powerB = toNumeric(b && b.power);
        const powerDiff = powerB - powerA;

        if (Math.abs(powerDiff) > POWER_SIMILARITY_THRESHOLD) {
            return powerDiff;
        }

        const thpA = toNumeric(a && a.thp);
        const thpB = toNumeric(b && b.thp);
        if (thpB !== thpA) {
            return thpB - thpA;
        }

        if (powerDiff !== 0) {
            return powerDiff;
        }

        const nameA = (a && a.name ? String(a.name) : '').toLowerCase();
        const nameB = (b && b.name ? String(b.name) : '').toLowerCase();
        return nameA.localeCompare(nameB);
    }

    function buildAssignment(building, player) {
        return {
            building: building.label || building.name,
            buildingKey: building.name,
            priority: building.priority,
            player: player.name,
            troops: player.troops,
            power: player.power,
            thp: Number.isFinite(Number(player.thp)) ? Number(player.thp) : 0,
        };
    }

    function findMixPartner(player, available) {
        if (!Array.isArray(available) || available.length === 0) {
            return null;
        }
        const candidates = available.slice(0, 3);
        const mixIndex = candidates.findIndex((candidate) => candidate.troops !== player.troops);
        return mixIndex !== -1 ? candidates[mixIndex] : available[0];
    }

    function assignTeamToBuildings(players, buildingConfig) {
        const assignments = [];
        let available = Array.isArray(players) ? [...players].sort(comparePlayersForAssignment) : [];

        const sortedBuildings = (Array.isArray(buildingConfig) ? [...buildingConfig] : []).sort((a, b) => {
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }
            return a.name.localeCompare(b.name);
        });

        const groups = [];
        sortedBuildings.forEach((building) => {
            const last = groups[groups.length - 1];
            if (last && last[0].priority === building.priority) {
                last.push(building);
            } else {
                groups.push([building]);
            }
        });

        groups.forEach((group) => {
            const activeGroup = group.filter((building) => building.slots > 0);
            if (activeGroup.length === 0) {
                return;
            }

            const pairsNeeded = activeGroup.map((building) => Math.floor(building.slots / 2));
            const maxPairs = Math.max(...pairsNeeded, 0);
            const topPicks = new Map();
            activeGroup.forEach((building) => topPicks.set(building.name, []));

            for (let round = 0; round < maxPairs; round += 1) {
                activeGroup.forEach((building, index) => {
                    if (topPicks.get(building.name).length < pairsNeeded[index] && available.length > 0) {
                        topPicks.get(building.name).push(available[0]);
                        available = available.slice(1);
                    }
                });
            }

            activeGroup.forEach((building) => {
                topPicks.get(building.name).forEach((top) => {
                    assignments.push(buildAssignment(building, top));

                    const partner = findMixPartner(top, available);
                    if (partner) {
                        assignments.push(buildAssignment(building, partner));
                        available = available.filter((candidate) => candidate.name !== partner.name);
                    }
                });
            });

            activeGroup.forEach((building) => {
                const assignedCount = assignments.filter((assignment) => (assignment.buildingKey || assignment.building) === building.name).length;
                if (assignedCount < building.slots && available.length > 0) {
                    assignments.push(buildAssignment(building, available[0]));
                    available = available.slice(1);
                }
            });
        });

        return assignments;
    }

    function sortBuildingsByPriority(buildingConfig) {
        return (Array.isArray(buildingConfig) ? [...buildingConfig] : []).sort((a, b) => {
            const aPriority = Number.isFinite(Number(a && a.priority)) ? Number(a.priority) : 1;
            const bPriority = Number.isFinite(Number(b && b.priority)) ? Number(b.priority) : 1;
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            const aName = a && typeof a.name === 'string' ? a.name : '';
            const bName = b && typeof b.name === 'string' ? b.name : '';
            return aName.localeCompare(bName);
        });
    }

    function assignPlayersSequentially(buildings, available, assignments) {
        buildings.forEach((building) => {
            const slots = Number.isFinite(Number(building && building.slots))
                ? Math.max(0, Math.round(Number(building.slots)))
                : 0;
            for (let index = 0; index < slots && available.length > 0; index += 1) {
                assignments.push(buildAssignment(building, available[0]));
                available.splice(0, 1);
            }
        });
    }

    // Aggressive strategy:
    // 1) Fill Team-designated buildings first (showOnMap=false) with top players.
    // 2) Fill map buildings by ascending priority with remaining players.
    // Troop mix is intentionally ignored.
    function assignTeamToBuildingsAggressive(players, buildingConfig) {
        const assignments = [];
        const available = Array.isArray(players) ? [...players].sort(comparePlayersForAssignment) : [];
        const sortedBuildings = sortBuildingsByPriority(buildingConfig);
        const teamBuildings = sortedBuildings.filter((building) => building && building.slots > 0 && building.showOnMap === false);
        const mapBuildings = sortedBuildings.filter((building) => building && building.slots > 0 && building.showOnMap !== false);

        assignPlayersSequentially(teamBuildings, available, assignments);
        assignPlayersSequentially(mapBuildings, available, assignments);

        return assignments;
    }

    global.DSCoreAssignment = {
        assignTeamToBuildings: assignTeamToBuildings,
        assignTeamToBuildingsAggressive: assignTeamToBuildingsAggressive,
        findMixPartner: findMixPartner,
        comparePlayersForAssignment: comparePlayersForAssignment,
    };
})(window);
