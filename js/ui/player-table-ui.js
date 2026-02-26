(function initPlayerTableUi(global) {
    function defaultTranslate(key) {
        return key;
    }

    function getTranslator(translate) {
        return typeof translate === 'function' ? translate : defaultTranslate;
    }

    function getFilteredAndSortedPlayers(options) {
        const config = options && typeof options === 'object' ? options : {};
        const allPlayers = Array.isArray(config.allPlayers) ? config.allPlayers : [];
        const searchTerm = String(config.searchTerm || '').toLowerCase();
        const troopsFilter = config.troopsFilter || '';
        const sortFilter = config.sortFilter || 'power-desc';

        if (global.DSCorePlayerTable && typeof global.DSCorePlayerTable.filterAndSortPlayers === 'function') {
            return global.DSCorePlayerTable.filterAndSortPlayers(allPlayers, {
                searchTerm: searchTerm,
                troopsFilter: troopsFilter,
                sortFilter: sortFilter,
            });
        }

        let filteredPlayers = allPlayers.filter((player) => player.name.toLowerCase().includes(searchTerm));

        if (troopsFilter) {
            filteredPlayers = filteredPlayers.filter((player) => player.troops === troopsFilter);
        }

        switch (sortFilter) {
            case 'power-asc':
                filteredPlayers.sort((a, b) => a.power - b.power);
                break;
            case 'name-asc':
                filteredPlayers.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'name-desc':
                filteredPlayers.sort((a, b) => b.name.localeCompare(a.name));
                break;
            case 'power-desc':
            default:
                filteredPlayers.sort((a, b) => b.power - a.power);
                break;
        }

        return filteredPlayers;
    }

    // SVG icon paths per reliability tier (16x16 viewBox)
    var RELIABILITY_ICONS = {
        excellent: '<path d="M8 1L2 4v4.5c0 3.5 2.5 6.5 6 7.5 3.5-1 6-4 6-7.5V4L8 1z" fill="none" stroke="currentColor" stroke-width="1.5"/><polyline points="5.5,8 7.5,10.5 11,6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
        good: '<circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/><polyline points="5,8 7.5,10.5 11,5.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
        fair: '<path d="M8 2L1.5 13h13L8 2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><line x1="8" y1="6" x2="8" y2="9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="11.5" r="0.8" fill="currentColor"/>',
        poor: '<circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="8" y1="4.5" x2="8" y2="8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="11" r="0.8" fill="currentColor"/>',
        critical: '<circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="5.5" y1="5.5" x2="10.5" y2="10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="10.5" y1="5.5" x2="5.5" y2="10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
        new: '<circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 6.5a2 2 0 0 1 3.9.5c0 1-1.9 1-1.9 2.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8" cy="12" r="0.8" fill="currentColor"/>',
    };

    function buildReliabilityIcon(playerName, playerStatsMap, translate) {
        var t = getTranslator(translate);
        var reliability = global.DSCoreReliability;
        if (!reliability) return null;

        var stats = playerStatsMap && playerStatsMap.get ? playerStatsMap.get(playerName) : null;
        var score = stats ? stats.reliabilityScore : null;
        var tierObj = reliability.getReliabilityTier(score);
        var iconPath = RELIABILITY_ICONS[tierObj.tier] || RELIABILITY_ICONS.new;
        var label = tierObj.labelKey ? t(tierObj.labelKey) : tierObj.label;
        var tooltip = score !== null && score !== undefined
            ? label + ' (' + score + '%)'
            : label;

        var span = document.createElement('span');
        span.className = 'reliability-icon ' + tierObj.cssClass;
        span.setAttribute('title', tooltip);
        span.setAttribute('aria-label', tooltip);
        span.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none">' + iconPath + '</svg>';
        return span;
    }

    function createPlayerRow(player, getTroopLabel, translate, playerStatsMap) {
        const t = getTranslator(translate);
        const row = document.createElement('tr');
        row.className = 'players-table-row';
        row.dataset.player = player.name;

        const nameCell = document.createElement('td');
        nameCell.className = 'players-table-name-cell';
        const nameStrong = document.createElement('strong');
        nameStrong.textContent = player.name;
        nameCell.appendChild(nameStrong);
        var icon = buildReliabilityIcon(player.name, playerStatsMap, translate);
        if (icon) nameCell.appendChild(icon);

        const powerCell = document.createElement('td');
        powerCell.className = 'player-power';
        powerCell.textContent = `${player.power}M`;

        const thpCell = document.createElement('td');
        thpCell.className = 'player-thp';
        thpCell.textContent = String(player.thp);

        const troopsCell = document.createElement('td');
        troopsCell.className = 'player-troops';
        troopsCell.textContent = getTroopLabel(player.troops);

        const actionsCell = document.createElement('td');
        actionsCell.className = 'players-table-actions-cell';
        const teamButtons = document.createElement('div');
        teamButtons.className = 'team-buttons team-buttons-group';
        actionsCell.appendChild(teamButtons);

        row.appendChild(nameCell);
        row.appendChild(powerCell);
        row.appendChild(thpCell);
        row.appendChild(troopsCell);
        row.appendChild(actionsCell);

        return row;
    }

    function updatePlayerRowStaticData(row, player, getTroopLabel, translate, playerStatsMap) {
        const t = getTranslator(translate);
        const nameCell = row.querySelector('.players-table-name-cell');
        const nameStrong = row.querySelector('td strong');
        if (nameStrong) {
            nameStrong.textContent = player.name;
        }
        // Refresh reliability icon
        if (nameCell) {
            var oldIcon = nameCell.querySelector('.reliability-icon');
            if (oldIcon) oldIcon.remove();
            var icon = buildReliabilityIcon(player.name, playerStatsMap, translate);
            if (icon) nameCell.appendChild(icon);
        }

        const powerCell = row.querySelector('.player-power');
        if (powerCell) {
            powerCell.textContent = `${player.power}M`;
        }

        const thpCell = row.querySelector('.player-thp');
        if (thpCell) {
            thpCell.textContent = String(player.thp);
        }

        const troopsCell = row.querySelector('.player-troops');
        if (troopsCell) {
            troopsCell.textContent = getTroopLabel(player.troops);
        }
    }

    function syncPlayerRowCache(rowCache, playersByName) {
        for (const cachedName of rowCache.keys()) {
            if (!playersByName.has(cachedName)) {
                rowCache.delete(cachedName);
            }
        }
    }

    function buildRoleBadge(role, translate) {
        var t = getTranslator(translate);
        var key = role === 'substitute' ? 'role_substitute_short' : 'role_starter';
        return '<span class="team-btn-role-badge team-btn-role-' + role + '">' + t(key) + '</span>';
    }

    function buildPlayerActionButtonsHtml(playerName, counts, selectionMaps, translate) {
        const t = getTranslator(translate);
        const selectionA = selectionMaps.teamA.get(playerName);
        const selectionB = selectionMaps.teamB.get(playerName);

        const teamAFullyDisabled = !selectionA && counts.teamAStarterCount >= 20 && counts.teamASubCount >= 10;
        const teamBFullyDisabled = !selectionB && counts.teamBStarterCount >= 20 && counts.teamBSubCount >= 10;

        const teamAActive = selectionA ? ' active' : '';
        const teamBActive = selectionB ? ' active' : '';
        const teamASub = selectionA && selectionA.role === 'substitute' ? ' is-substitute' : '';
        const teamBSub = selectionB && selectionB.role === 'substitute' ? ' is-substitute' : '';
        const teamABadge = selectionA ? buildRoleBadge(selectionA.role, translate) : '';
        const teamBBadge = selectionB ? buildRoleBadge(selectionB.role, translate) : '';

        let html = `
        <div class="team-select-group">
            <button type="button" class="team-btn team-a-btn${teamAActive}${teamASub}" ${teamAFullyDisabled ? 'disabled' : ''}>
                <span class="team-label-full">${t('team_a_button')}</span>
                <span class="team-label-short">${t('team_a_short')}</span>
                ${teamABadge}
            </button>
            <button type="button" class="team-btn team-b-btn${teamBActive}${teamBSub}" ${teamBFullyDisabled ? 'disabled' : ''}>
                <span class="team-label-full">${t('team_b_button')}</span>
                <span class="team-label-short">${t('team_b_short')}</span>
                ${teamBBadge}
            </button>
        </div>
    `;

        return html;
    }

    function applyPlayerRowSelectionState(row, player, counts, selectionMaps, translate) {
        const selectionA = selectionMaps.teamA.get(player.name);
        const selectionB = selectionMaps.teamB.get(player.name);
        row.classList.toggle('selected-a', !!selectionA);
        row.classList.toggle('selected-b', !!selectionB);
        const teamButtons = row.querySelector('.team-buttons');
        if (teamButtons) {
            teamButtons.innerHTML = buildPlayerActionButtonsHtml(player.name, counts, selectionMaps, translate);
        }
    }

    function refreshVisiblePlayerRows(options) {
        const config = options && typeof options === 'object' ? options : {};
        const tbody = config.tbody;
        if (!tbody) return;
        const allPlayers = Array.isArray(config.allPlayers) ? config.allPlayers : [];
        const counts = config.counts || {};
        const selectionMaps = config.selectionMaps || { teamA: new Map(), teamB: new Map() };
        const playersByName = new Map(allPlayers.map((player) => [player.name, player]));
        tbody.querySelectorAll('tr[data-player]').forEach((row) => {
            const playerName = row.dataset.player;
            const player = playersByName.get(playerName);
            if (!player) return;
            applyPlayerRowSelectionState(row, player, counts, selectionMaps, config.translate);
        });
    }

    function renderPlayersTable(options) {
        const config = options && typeof options === 'object' ? options : {};
        const tbody = config.tbody;
        if (!tbody) return;
        const allPlayers = Array.isArray(config.allPlayers) ? config.allPlayers : [];
        const rowCache = config.rowCache instanceof Map ? config.rowCache : new Map();
        const getTroopLabel = typeof config.getTroopLabel === 'function' ? config.getTroopLabel : (value) => value;
        const counts = config.counts || {};
        const selectionMaps = config.selectionMaps || { teamA: new Map(), teamB: new Map() };
        const displayPlayers = getFilteredAndSortedPlayers({
            allPlayers: allPlayers,
            searchTerm: config.searchTerm || '',
            troopsFilter: config.troopsFilter || '',
            sortFilter: config.sortFilter || 'power-desc',
        });
        const playersByName = new Map(allPlayers.map((player) => [player.name, player]));
        syncPlayerRowCache(rowCache, playersByName);
        const visibleNames = new Set(displayPlayers.map((player) => player.name));

        // Remove rows that are no longer part of the filtered result.
        tbody.querySelectorAll('tr[data-player]').forEach((row) => {
            const playerName = row.dataset.player;
            if (!visibleNames.has(playerName)) {
                row.remove();
            }
        });

        const playerStatsMap = config.playerStatsMap instanceof Map ? config.playerStatsMap : null;

        // Keep DOM updates incremental by reordering/inserting rows in place.
        displayPlayers.forEach((player, index) => {
            let row = rowCache.get(player.name);
            if (!row) {
                row = createPlayerRow(player, getTroopLabel, config.translate, playerStatsMap);
                rowCache.set(player.name, row);
            } else {
                updatePlayerRowStaticData(row, player, getTroopLabel, config.translate, playerStatsMap);
            }

            applyPlayerRowSelectionState(row, player, counts, selectionMaps, config.translate);

            const rowAtIndex = tbody.children[index] || null;
            if (rowAtIndex !== row) {
                tbody.insertBefore(row, rowAtIndex);
            }
        });
    }

    function renderLoadingState(tableBody, translate) {
        var t = getTranslator(translate);
        tableBody.innerHTML = '';
        var tr = document.createElement('tr');
        var td = document.createElement('td');
        td.setAttribute('colspan', '5');
        td.className = 'table-loading-state';
        var spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        td.appendChild(spinner);
        td.appendChild(document.createTextNode(t('loading_players')));
        tr.appendChild(td);
        tableBody.appendChild(tr);
    }

    function renderEmptyState(tableBody, translate) {
        var t = getTranslator(translate);
        tableBody.innerHTML = '';
        var tr = document.createElement('tr');
        var td = document.createElement('td');
        td.setAttribute('colspan', '5');
        td.className = 'table-empty-state';
        td.textContent = t('empty_state_no_players');
        tr.appendChild(td);
        tableBody.appendChild(tr);
    }

    global.DSPlayerTableUI = {
        getFilteredAndSortedPlayers: getFilteredAndSortedPlayers,
        refreshVisiblePlayerRows: refreshVisiblePlayerRows,
        renderPlayersTable: renderPlayersTable,
        renderLoadingState: renderLoadingState,
        renderEmptyState: renderEmptyState,
    };
})(window);
