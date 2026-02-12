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

    function createPlayerRow(player, getTroopLabel) {
        const row = document.createElement('tr');
        row.dataset.player = player.name;

        const nameCell = document.createElement('td');
        const nameStrong = document.createElement('strong');
        nameStrong.textContent = player.name;
        nameCell.appendChild(nameStrong);

        const powerCell = document.createElement('td');
        powerCell.className = 'player-power';
        powerCell.textContent = `${player.power}M`;

        const troopsCell = document.createElement('td');
        troopsCell.className = 'player-troops';
        troopsCell.textContent = getTroopLabel(player.troops);

        const actionsCell = document.createElement('td');
        const teamButtons = document.createElement('div');
        teamButtons.className = 'team-buttons';
        actionsCell.appendChild(teamButtons);

        row.appendChild(nameCell);
        row.appendChild(powerCell);
        row.appendChild(troopsCell);
        row.appendChild(actionsCell);

        return row;
    }

    function updatePlayerRowStaticData(row, player, getTroopLabel) {
        const nameStrong = row.querySelector('td strong');
        if (nameStrong) {
            nameStrong.textContent = player.name;
        }

        const powerCell = row.querySelector('.player-power');
        if (powerCell) {
            powerCell.textContent = `${player.power}M`;
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

    function buildPlayerActionButtonsHtml(playerName, counts, selectionMaps, translate) {
        const t = getTranslator(translate);
        const selectionA = selectionMaps.teamA.get(playerName);
        const selectionB = selectionMaps.teamB.get(playerName);

        if (selectionA) {
            const role = selectionA.role;
            const starterDisabled = role === 'substitute' && counts.teamAStarterCount >= 20;
            const subDisabled = role === 'starter' && counts.teamASubCount >= 10;
            return `
            <div class="role-toggle team-a-selected">
                <button class="role-btn starter ${role === 'starter' ? 'active' : ''}"
                        ${starterDisabled ? 'disabled' : ''}
                        data-role="starter">${t('role_starter')}</button>
                <button class="role-btn substitute ${role === 'substitute' ? 'active' : ''}"
                        ${subDisabled ? 'disabled' : ''}
                        data-role="substitute">${t('role_substitute')}</button>
            </div>
            <button class="clear-btn">${t('clear_button')}</button>
        `;
        }

        if (selectionB) {
            const role = selectionB.role;
            const starterDisabled = role === 'substitute' && counts.teamBStarterCount >= 20;
            const subDisabled = role === 'starter' && counts.teamBSubCount >= 10;
            return `
            <div class="role-toggle team-b-selected">
                <button class="role-btn starter ${role === 'starter' ? 'active' : ''}"
                        ${starterDisabled ? 'disabled' : ''}
                        data-role="starter">${t('role_starter')}</button>
                <button class="role-btn substitute ${role === 'substitute' ? 'active' : ''}"
                        ${subDisabled ? 'disabled' : ''}
                        data-role="substitute">${t('role_substitute')}</button>
            </div>
            <button class="clear-btn">${t('clear_button')}</button>
        `;
        }

        const teamAFullyDisabled = counts.teamAStarterCount >= 20 && counts.teamASubCount >= 10;
        const teamBFullyDisabled = counts.teamBStarterCount >= 20 && counts.teamBSubCount >= 10;

        return `
        <button class="team-btn team-a-btn" ${teamAFullyDisabled ? 'disabled' : ''}>
            <span class="team-label-full">${t('team_a_button')}</span>
            <span class="team-label-short">${t('team_a_short')}</span>
        </button>
        <button class="team-btn team-b-btn" ${teamBFullyDisabled ? 'disabled' : ''}>
            <span class="team-label-full">${t('team_b_button')}</span>
            <span class="team-label-short">${t('team_b_short')}</span>
        </button>
    `;
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

        const fragment = document.createDocumentFragment();
        displayPlayers.forEach((player) => {
            let row = rowCache.get(player.name);
            if (!row) {
                row = createPlayerRow(player, getTroopLabel);
                rowCache.set(player.name, row);
            } else {
                updatePlayerRowStaticData(row, player, getTroopLabel);
            }
            applyPlayerRowSelectionState(row, player, counts, selectionMaps, config.translate);
            fragment.appendChild(row);
        });

        tbody.replaceChildren(fragment);
    }

    global.DSPlayerTableUI = {
        getFilteredAndSortedPlayers: getFilteredAndSortedPlayers,
        refreshVisiblePlayerRows: refreshVisiblePlayerRows,
        renderPlayersTable: renderPlayersTable,
    };
})(window);
