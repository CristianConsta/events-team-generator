(function initPlayersManagementCore(global) {
    const DEFAULT_SORT = 'power-desc';
    const SUPPORTED_SORTS = new Set(['power-desc', 'power-asc', 'name-asc', 'name-desc']);

    function toNumeric(value) {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : 0;
    }

    function normalizeTroops(value) {
        const troops = typeof value === 'string' ? value.trim() : '';
        return troops || 'Unknown';
    }

    function normalizePlayerRecordForUi(name, entry) {
        const raw = entry && typeof entry === 'object' ? entry : {};
        return {
            name: String(name || ''),
            power: toNumeric(raw.power),
            troops: normalizeTroops(raw.troops),
            thp: toNumeric(raw.thp),
        };
    }

    function buildRowsFromDatabase(playerDatabase) {
        const db = playerDatabase && typeof playerDatabase === 'object' ? playerDatabase : {};
        return Object.keys(db).map(function toRow(name) {
            return normalizePlayerRecordForUi(name, db[name]);
        });
    }

    function normalizeFilterState(filterState) {
        const source = filterState && typeof filterState === 'object' ? filterState : {};
        const searchTerm = String(source.searchTerm || '').trim();
        const troopsFilter = String(source.troopsFilter || '').trim();
        const nextSort = String(source.sortFilter || '').trim();
        const sortFilter = SUPPORTED_SORTS.has(nextSort) ? nextSort : DEFAULT_SORT;

        return {
            searchTerm: searchTerm,
            troopsFilter: troopsFilter,
            sortFilter: sortFilter,
        };
    }

    function hasActiveFilters(filterState) {
        const normalized = normalizeFilterState(filterState);
        return normalized.searchTerm.length > 0
            || normalized.troopsFilter !== ''
            || normalized.sortFilter !== DEFAULT_SORT;
    }

    function compareRows(a, b, sortFilter) {
        if (sortFilter === 'power-asc') {
            if (a.power !== b.power) {
                return a.power - b.power;
            }
            return a.name.localeCompare(b.name);
        }

        if (sortFilter === 'name-asc') {
            return a.name.localeCompare(b.name);
        }

        if (sortFilter === 'name-desc') {
            return b.name.localeCompare(a.name);
        }

        if (b.power !== a.power) {
            return b.power - a.power;
        }
        return a.name.localeCompare(b.name);
    }

    function applyFilters(rows, filterState) {
        const normalizedRows = Array.isArray(rows) ? rows.slice() : [];
        const normalizedFilters = normalizeFilterState(filterState);

        const termLower = normalizedFilters.searchTerm.toLowerCase();
        const termFiltered = normalizedFilters.searchTerm
            ? normalizedRows.filter(function byName(player) {
                return String(player && player.name || '').toLowerCase().includes(termLower);
            })
            : normalizedRows;

        const troopsFiltered = normalizedFilters.troopsFilter
            ? termFiltered.filter(function byTroops(player) {
                return String(player && player.troops || '').trim() === normalizedFilters.troopsFilter;
            })
            : termFiltered;

        troopsFiltered.sort(function sortRows(a, b) {
            return compareRows(a, b, normalizedFilters.sortFilter);
        });

        return troopsFiltered;
    }

    global.DSFeaturePlayersManagementCore = {
        DEFAULT_SORT: DEFAULT_SORT,
        normalizePlayerRecordForUi: normalizePlayerRecordForUi,
        buildRowsFromDatabase: buildRowsFromDatabase,
        normalizeFilterState: normalizeFilterState,
        hasActiveFilters: hasActiveFilters,
        applyFilters: applyFilters,
    };
})(window);
