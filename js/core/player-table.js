(function initPlayerTableCore(global) {
    function normalizeString(value) {
        return typeof value === 'string' ? value : '';
    }

    function normalizeSortFilter(value) {
        switch (value) {
            case 'power-asc':
            case 'name-asc':
            case 'name-desc':
            case 'power-desc':
                return value;
            default:
                return 'power-desc';
        }
    }

    function filterAndSortPlayers(players, options) {
        const source = Array.isArray(players) ? players : [];
        const config = options && typeof options === 'object' ? options : {};

        const searchTerm = normalizeString(config.searchTerm).trim().toLowerCase();
        const troopsFilter = normalizeString(config.troopsFilter).trim();
        const sortFilter = normalizeSortFilter(config.sortFilter);

        let result = source.slice();

        if (searchTerm) {
            result = result.filter((player) => {
                const name = normalizeString(player && player.name).toLowerCase();
                return name.includes(searchTerm);
            });
        }

        if (troopsFilter) {
            result = result.filter((player) => normalizeString(player && player.troops) === troopsFilter);
        }

        switch (sortFilter) {
            case 'power-asc':
                result.sort((a, b) => Number(a && a.power) - Number(b && b.power));
                break;
            case 'name-asc':
                result.sort((a, b) => normalizeString(a && a.name).localeCompare(normalizeString(b && b.name)));
                break;
            case 'name-desc':
                result.sort((a, b) => normalizeString(b && b.name).localeCompare(normalizeString(a && a.name)));
                break;
            case 'power-desc':
            default:
                result.sort((a, b) => Number(b && b.power) - Number(a && a.power));
                break;
        }

        return result;
    }

    global.DSCorePlayerTable = {
        filterAndSortPlayers: filterAndSortPlayers,
    };
})(window);
