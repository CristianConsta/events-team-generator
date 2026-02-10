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

    function sanitizeStoredEntry(item, fallback, minSlots, maxSlots) {
        if (!item || typeof item !== 'object') {
            return null;
        }
        const rawName = typeof item.name === 'string' ? item.name.trim() : '';
        const fallbackName = fallback && typeof fallback.name === 'string' ? fallback.name : '';
        const name = rawName || fallbackName;
        if (!name) {
            return null;
        }

        const fallbackPriority = fallback && Number.isFinite(Number(fallback.priority))
            ? Number(fallback.priority)
            : 1;
        const fallbackSlots = fallback && Number.isFinite(Number(fallback.slots))
            ? Number(fallback.slots)
            : 0;
        const fallbackLabel = normalizeLabel(fallback && fallback.label, name);
        const label = normalizeLabel(item.label, fallbackLabel);
        const priority = clampPriority(item.priority, fallbackPriority);
        const slots = clampSlots(item.slots, fallbackSlots, minSlots, maxSlots);
        const fallbackShowOnMap = fallback && Object.prototype.hasOwnProperty.call(fallback, 'showOnMap')
            ? fallback.showOnMap !== false
            : true;
        const showOnMap = Object.prototype.hasOwnProperty.call(item, 'showOnMap')
            ? item.showOnMap !== false
            : fallbackShowOnMap;
        return { name, label, slots, priority, showOnMap };
    }

    function normalizeBuildingConfig(config, defaults, minSlots, maxSlots) {
        if (!Array.isArray(defaults)) {
            return [];
        }
        if (!Array.isArray(config)) {
            return defaults.map((item) => sanitizeStoredEntry(item, item, minSlots, maxSlots)).filter(Boolean);
        }

        const defaultsByName = new Map();
        defaults.forEach((def) => {
            if (!def || typeof def !== 'object' || typeof def.name !== 'string' || !def.name.trim()) {
                return;
            }
            defaultsByName.set(def.name, def);
        });

        const configByName = new Map();
        const configOrder = [];
        config.forEach((item) => {
            if (!item || typeof item !== 'object') {
                return;
            }
            const storedName = typeof item.name === 'string' ? item.name.trim() : '';
            if (!storedName || configByName.has(storedName)) {
                return;
            }
            configByName.set(storedName, item);
            configOrder.push(storedName);
        });

        const normalized = [];
        defaults.forEach((def) => {
            if (!def || typeof def !== 'object' || typeof def.name !== 'string') {
                return;
            }
            const stored = configByName.get(def.name);
            if (!stored) {
                return;
            }
            const sanitized = sanitizeStoredEntry(stored, def, minSlots, maxSlots);
            if (sanitized) {
                normalized.push(sanitized);
            }
            configByName.delete(def.name);
        });

        configOrder.forEach((name) => {
            const stored = configByName.get(name);
            if (!stored) {
                return;
            }
            const fallback = { name: name, label: name, slots: 0, priority: 1 };
            const sanitized = sanitizeStoredEntry(stored, fallback, minSlots, maxSlots);
            if (sanitized) {
                normalized.push(sanitized);
            }
            configByName.delete(name);
        });

        if (normalized.length > 0) {
            return normalized;
        }

        return defaults.map((item) => sanitizeStoredEntry(item, item, minSlots, maxSlots)).filter(Boolean);
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
