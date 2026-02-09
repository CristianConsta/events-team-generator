(function initBuildingsCore(global) {
    function clampPriority(value, fallback) {
        const number = Number(value);
        if (!Number.isFinite(number)) {
            return fallback;
        }
        return Math.max(1, Math.min(6, Math.round(number)));
    }

    function clampSlots(value, fallback, minSlots, maxSlots) {
        const number = Number(value);
        if (!Number.isFinite(number)) {
            return fallback;
        }
        return Math.max(minSlots, Math.min(maxSlots, Math.round(number)));
    }

    function getBuildingSlotsTotal(config) {
        if (!Array.isArray(config)) {
            return 0;
        }
        return config.reduce((sum, item) => {
            const slots = Number(item && item.slots);
            return sum + (Number.isFinite(slots) ? slots : 0);
        }, 0);
    }

    function normalizeLabel(value, fallback) {
        if (typeof value !== 'string') {
            return fallback;
        }
        const trimmed = value.trim();
        return trimmed || fallback;
    }

    function normalizeBuildingConfig(config, defaults, minSlots, maxSlots) {
        if (!Array.isArray(defaults)) {
            return [];
        }
        if (!Array.isArray(config)) {
            return defaults.map((item) => ({ ...item }));
        }

        return defaults.map((def) => {
            const stored = config.find((item) => item && item.name === def.name);
            const priority = clampPriority(stored && stored.priority, def.priority);
            const slots = clampSlots(stored && stored.slots, def.slots, minSlots, maxSlots);
            const defaultLabel = normalizeLabel(def && def.label, def.name);
            const label = normalizeLabel(stored && stored.label, defaultLabel);
            return { name: def.name, label: label, slots: slots, priority: priority };
        });
    }

    function normalizeBuildingPositions(positions, validNames) {
        const normalized = {};
        if (!positions || typeof positions !== 'object') {
            return normalized;
        }

        Object.keys(positions).forEach((name) => {
            if (validNames && !validNames.has(name)) {
                return;
            }
            const value = positions[name];
            if (!Array.isArray(value) || value.length !== 2) {
                return;
            }
            const x = Number(value[0]);
            const y = Number(value[1]);
            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                return;
            }
            normalized[name] = [Math.round(x), Math.round(y)];
        });

        return normalized;
    }

    global.DSCoreBuildings = {
        clampPriority: clampPriority,
        clampSlots: clampSlots,
        getBuildingSlotsTotal: getBuildingSlotsTotal,
        normalizeBuildingConfig: normalizeBuildingConfig,
        normalizeBuildingPositions: normalizeBuildingPositions,
    };
})(window);
