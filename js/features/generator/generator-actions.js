(function initGeneratorActions(global) {
    function normalizeAssignmentSelection(value, normalizeFn, fallbackValue) {
        const fallback = typeof fallbackValue === 'string' && fallbackValue ? fallbackValue : 'balanced';
        if (typeof normalizeFn === 'function') {
            return normalizeFn(value);
        }
        return value === 'aggressive' ? 'aggressive' : fallback;
    }

    function buildRoleLimits(overrides) {
        const source = overrides && typeof overrides === 'object' ? overrides : {};
        return {
            maxTotal: Number.isFinite(Number(source.maxTotal)) ? Number(source.maxTotal) : 30,
            maxStarters: Number.isFinite(Number(source.maxStarters)) ? Number(source.maxStarters) : 20,
            maxSubstitutes: Number.isFinite(Number(source.maxSubstitutes)) ? Number(source.maxSubstitutes) : 10,
        };
    }

    global.DSFeatureGeneratorActions = {
        normalizeAssignmentSelection: normalizeAssignmentSelection,
        buildRoleLimits: buildRoleLimits,
    };
})(window);
