(function initAssignmentCore(global) {
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
        let available = Array.isArray(players) ? [...players] : [];

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
                    assignments.push({
                        building: building.name,
                        priority: building.priority,
                        player: top.name,
                    });

                    const partner = findMixPartner(top, available);
                    if (partner) {
                        assignments.push({
                            building: building.name,
                            priority: building.priority,
                            player: partner.name,
                        });
                        available = available.filter((candidate) => candidate.name !== partner.name);
                    }
                });
            });

            activeGroup.forEach((building) => {
                const assignedCount = assignments.filter((assignment) => assignment.building === building.name).length;
                if (assignedCount < building.slots && available.length > 0) {
                    assignments.push({
                        building: building.name,
                        priority: building.priority,
                        player: available[0].name,
                    });
                    available = available.slice(1);
                }
            });
        });

        return assignments;
    }

    global.DSCoreAssignment = {
        assignTeamToBuildings: assignTeamToBuildings,
        findMixPartner: findMixPartner,
    };
})(window);
