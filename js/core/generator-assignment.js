(function initGeneratorAssignmentCore(global) {
    const ASSIGNMENT_ALGO_BALANCED = 'balanced';
    const ASSIGNMENT_ALGO_AGGRESSIVE = 'aggressive';
    const ASSIGNMENT_POWER_SIMILARITY_THRESHOLD = 1000000;

    function toNumeric(value) {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : 0;
    }

    function comparePlayersForAssignment(a, b) {
        if (global.DSCoreAssignment && typeof global.DSCoreAssignment.comparePlayersForAssignment === 'function') {
            return global.DSCoreAssignment.comparePlayersForAssignment(a, b);
        }

        const powerA = toNumeric(a && a.power);
        const powerB = toNumeric(b && b.power);
        const powerDiff = powerB - powerA;
        if (Math.abs(powerDiff) > ASSIGNMENT_POWER_SIMILARITY_THRESHOLD) {
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

    function normalizeAssignmentAlgorithm(value) {
        if (value === ASSIGNMENT_ALGO_AGGRESSIVE) {
            return ASSIGNMENT_ALGO_AGGRESSIVE;
        }
        return ASSIGNMENT_ALGO_BALANCED;
    }

    function mapSelectionsToPlayers(selections, playerDatabase) {
        const sourceSelections = Array.isArray(selections) ? selections : [];
        const sourcePlayerDb = playerDatabase && typeof playerDatabase === 'object' ? playerDatabase : {};

        const starters = [];
        const substitutes = [];

        sourceSelections.forEach((selection) => {
            const name = selection && typeof selection.name === 'string' ? selection.name : '';
            const role = selection && selection.role === 'substitute' ? 'substitute' : 'starter';
            if (!name || !Object.prototype.hasOwnProperty.call(sourcePlayerDb, name)) {
                return;
            }

            const record = sourcePlayerDb[name] && typeof sourcePlayerDb[name] === 'object' ? sourcePlayerDb[name] : {};
            const normalizedPlayer = {
                name: name,
                power: toNumeric(record.power),
                troops: record.troops,
                thp: toNumeric(record.thp),
            };

            if (role === 'substitute') {
                substitutes.push(normalizedPlayer);
            } else {
                starters.push(normalizedPlayer);
            }
        });

        return { starters, substitutes };
    }

    function preparePlayersForAssignment(selections, playerDatabase) {
        const mapped = mapSelectionsToPlayers(selections, playerDatabase);
        return {
            starters: mapped.starters.slice().sort(comparePlayersForAssignment),
            substitutes: mapped.substitutes.slice().sort(comparePlayersForAssignment),
        };
    }

    global.DSCoreGeneratorAssignment = {
        normalizeAssignmentAlgorithm: normalizeAssignmentAlgorithm,
        comparePlayersForAssignment: comparePlayersForAssignment,
        mapSelectionsToPlayers: mapSelectionsToPlayers,
        preparePlayersForAssignment: preparePlayersForAssignment,
    };
})(window);
