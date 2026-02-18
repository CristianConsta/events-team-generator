(function initEventBuildingsEditorUi(global) {
    function createEditorBuildingRow(options) {
        const config = options && typeof options === 'object' ? options : {};
        const source = config.rowData && typeof config.rowData === 'object' ? config.rowData : {};
        const translate = typeof config.translate === 'function' ? config.translate : (value) => value;
        const escapeAttribute = typeof config.escapeAttribute === 'function'
            ? config.escapeAttribute
            : (value) => String(value || '').replace(/"/g, '&quot;');
        const clampSlots = typeof config.clampSlots === 'function' ? config.clampSlots : (value) => value;
        const clampPriority = typeof config.clampPriority === 'function' ? config.clampPriority : (value) => value;
        const minSlots = Number(config.minSlots) || 0;
        const maxSlots = Number(config.maxSlots) || 999;

        const name = typeof source.name === 'string' ? source.name : '';
        const slots = Number(source.slots);
        const priority = Number(source.priority);
        const showOnMap = source.showOnMap !== false;

        const row = document.createElement('tr');
        row.innerHTML = `
        <td><input type="text" data-field="name" maxlength="50" value="${escapeAttribute(name)}"></td>
        <td data-label="${escapeAttribute(translate('buildings_table_slots'))}"><input type="number" data-field="slots" min="${minSlots}" max="${maxSlots}" value="${Number.isFinite(slots) ? Math.max(minSlots, Math.min(maxSlots, Math.round(slots))) : 0}"></td>
        <td data-label="${escapeAttribute(translate('buildings_table_priority'))}"><input type="number" data-field="priority" min="1" max="6" value="${Number.isFinite(priority) ? clampPriority(priority, 1) : 1}"></td>
        <td data-label="${escapeAttribute(translate('buildings_table_display'))}"><div class="display-toggle" data-field="showOnMap"><button type="button" class="display-toggle-btn${showOnMap ? ' active' : ''}" data-display="building">${translate('building_type_building')}</button><button type="button" class="display-toggle-btn${!showOnMap ? ' active' : ''}" data-display="team">${translate('building_type_team')}</button></div></td>
        <td><button class="clear-btn" type="button" data-action="remove-row">${translate('events_manager_remove')}</button></td>
    `;
        return row;
    }

    function renderEventBuildingsEditor(options) {
        const config = options && typeof options === 'object' ? options : {};
        const tbody = config.tbody;
        if (!tbody) {
            return;
        }
        const createRow = typeof config.createRow === 'function'
            ? config.createRow
            : () => document.createElement('tr');
        const defaultRows = Array.isArray(config.defaultRows) && config.defaultRows.length > 0
            ? config.defaultRows
            : [{ name: '', slots: 0, priority: 1, showOnMap: true }];
        const source = Array.isArray(config.buildings) && config.buildings.length > 0
            ? config.buildings
            : defaultRows;

        tbody.innerHTML = '';
        source.forEach((building) => {
            tbody.appendChild(createRow(building));
        });
    }

    function addEventBuildingRow(options) {
        const config = options && typeof options === 'object' ? options : {};
        const tbody = config.tbody;
        const canEdit = !!config.canEdit;
        if (!canEdit || !tbody) {
            return false;
        }
        const createRow = typeof config.createRow === 'function'
            ? config.createRow
            : () => document.createElement('tr');
        const rowData = config.rowData && typeof config.rowData === 'object'
            ? config.rowData
            : { name: '', slots: 0, priority: 1, showOnMap: true };
        tbody.appendChild(createRow(rowData));
        return true;
    }

    function readEventBuildingsEditor(options) {
        const config = options && typeof options === 'object' ? options : {};
        const tbody = config.tbody;
        const translate = typeof config.translate === 'function' ? config.translate : (value) => value;
        const clampSlots = typeof config.clampSlots === 'function' ? config.clampSlots : (value) => value;
        const clampPriority = typeof config.clampPriority === 'function' ? config.clampPriority : (value) => value;

        if (!tbody) {
            return { buildings: [], error: translate('events_manager_buildings_required') };
        }

        const rows = Array.from(tbody.querySelectorAll('tr'));
        const buildings = [];
        const seenNames = new Set();

        for (const row of rows) {
            const nameInput = row.querySelector('input[data-field="name"]');
            const slotsInput = row.querySelector('input[data-field="slots"]');
            const priorityInput = row.querySelector('input[data-field="priority"]');
            const showOnMapToggle = row.querySelector('[data-field="showOnMap"]');
            const name = nameInput && typeof nameInput.value === 'string' ? nameInput.value.trim() : '';
            if (!name) {
                continue;
            }
            const dedupeKey = name.toLowerCase();
            if (seenNames.has(dedupeKey)) {
                return { buildings: [], error: translate('events_manager_duplicate_building', { name: name }) };
            }
            seenNames.add(dedupeKey);

            const slots = clampSlots(Number(slotsInput ? slotsInput.value : 0), 0);
            const priority = clampPriority(Number(priorityInput ? priorityInput.value : 1), 1);
            const showOnMap = !showOnMapToggle || !!showOnMapToggle.querySelector('[data-display="building"].active');
            buildings.push({
                name: name,
                label: name,
                slots: slots,
                priority: priority,
                showOnMap: showOnMap,
            });
        }

        if (buildings.length === 0) {
            return { buildings: [], error: translate('events_manager_buildings_required') };
        }
        return { buildings: buildings, error: null };
    }

    function bindEventEditorTableActions(options) {
        const config = options && typeof options === 'object' ? options : {};
        const tbody = config.tbody;
        if (!tbody) {
            return;
        }
        const canEdit = typeof config.canEdit === 'function' ? config.canEdit : () => false;
        const ensureAtLeastOneRow = typeof config.ensureAtLeastOneRow === 'function'
            ? config.ensureAtLeastOneRow
            : () => {};

        tbody.addEventListener('click', (event) => {
            if (!canEdit()) {
                return;
            }
            const btn = event.target.closest('button[data-action="remove-row"]');
            if (!btn) {
                return;
            }
            const row = btn.closest('tr');
            if (!row) {
                return;
            }
            row.remove();
            if (tbody.querySelectorAll('tr').length === 0) {
                ensureAtLeastOneRow();
            }
        });
    }

    global.DSEventBuildingsEditorUI = {
        createEditorBuildingRow: createEditorBuildingRow,
        renderEventBuildingsEditor: renderEventBuildingsEditor,
        addEventBuildingRow: addEventBuildingRow,
        readEventBuildingsEditor: readEventBuildingsEditor,
        bindEventEditorTableActions: bindEventEditorTableActions,
    };
})(window);
