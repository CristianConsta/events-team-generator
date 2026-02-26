(function initBuildingsConfigManager(global) {
    function getDefaultBuildings(currentEvent) {
        var defaults = global.DSCoreEvents.cloneEventBuildings(currentEvent);
        return Array.isArray(defaults) ? defaults : [];
    }

    function getBuildingDisplayName(internalName, buildingConfig) {
        var building = buildingConfig.find(function (b) { return b.name === internalName; });
        if (!building) {
            return internalName;
        }
        return (typeof building.label === 'string' && building.label.trim()) ? building.label.trim() : internalName;
    }

    function isBuildingShownOnMap(internalName, buildingConfig) {
        var building = buildingConfig.find(function (b) { return b.name === internalName; });
        if (!building) {
            return true;
        }
        return building.showOnMap !== false;
    }

    function getBuildingEditIcon(editing) {
        if (editing) {
            return '\n            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">\n                <polyline points="20 6 9 17 4 12"/>\n            </svg>\n        ';
        }
        return '\n        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">\n            <path d="M12 20h9"/>\n            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>\n        </svg>\n    ';
    }

    function toggleBuildingFieldEdit(buttonEl) {
        var row = buttonEl.closest('tr');
        var field = buttonEl.getAttribute('data-field');
        if (!row || !field) return;
        var input = row.querySelector('input[data-field="' + field + '"]');
        if (!input) return;

        var nextEditing = input.disabled;
        input.disabled = !nextEditing;
        buttonEl.classList.toggle('is-editing', nextEditing);
        buttonEl.setAttribute('aria-label', nextEditing ? 'Lock ' + field : 'Edit ' + field);
        buttonEl.title = nextEditing ? 'Lock ' + field : 'Edit ' + field;
        buttonEl.innerHTML = getBuildingEditIcon(nextEditing);

        if (nextEditing) {
            input.focus();
            if (typeof input.select === 'function' && input.type === 'text') {
                input.select();
            }
        }
    }

    function getGlobalDefaultBuildingConfig(currentEvent, FirebaseService) {
        if (!FirebaseService || typeof FirebaseService.getGlobalDefaultBuildingConfig !== 'function') {
            return null;
        }
        var config = FirebaseService.getGlobalDefaultBuildingConfig(currentEvent);
        return Array.isArray(config) ? config : null;
    }

    function getResolvedDefaultBuildingConfig(currentEvent, deps) {
        var baseDefaults = getDefaultBuildings(currentEvent);
        var globalDefaults = getGlobalDefaultBuildingConfig(currentEvent, deps.FirebaseService);
        if (!Array.isArray(globalDefaults) || globalDefaults.length === 0) {
            return baseDefaults;
        }
        return deps.normalizeBuildingConfig(globalDefaults, baseDefaults);
    }

    function getDefaultBuildingPositions(currentEvent) {
        return global.DSCoreEvents.cloneDefaultPositions(currentEvent);
    }

    function normalizeBuildingPositions(positions, currentEvent) {
        var activeEvent = global.DSCoreEvents.getEvent(currentEvent);
        var validNames = new Set((activeEvent && Array.isArray(activeEvent.buildings) ? activeEvent.buildings : []).map(function (b) { return b.name; }));
        return global.DSCoreBuildings.normalizeBuildingPositions(positions, validNames);
    }

    function getGlobalDefaultBuildingPositions(currentEvent, FirebaseService) {
        if (!FirebaseService || typeof FirebaseService.getGlobalDefaultBuildingPositions !== 'function') {
            return {};
        }
        return normalizeBuildingPositions(FirebaseService.getGlobalDefaultBuildingPositions(currentEvent), currentEvent);
    }

    function getResolvedDefaultBuildingPositions(currentEvent, FirebaseService) {
        return Object.assign(
            {},
            getDefaultBuildingPositions(currentEvent),
            getGlobalDefaultBuildingPositions(currentEvent, FirebaseService)
        );
    }

    function getTargetBuildingPositionsVersion(baseVersion, FirebaseService) {
        var targetVersion = baseVersion;
        if (FirebaseService && typeof FirebaseService.getGlobalDefaultBuildingPositionsVersion === 'function') {
            var sharedVersion = Number(FirebaseService.getGlobalDefaultBuildingPositionsVersion());
            if (Number.isFinite(sharedVersion) && sharedVersion > targetVersion) {
                targetVersion = sharedVersion;
            }
        }
        return targetVersion;
    }

    function getTargetBuildingConfigVersion(baseVersion, FirebaseService) {
        var targetVersion = baseVersion;
        if (FirebaseService && typeof FirebaseService.getGlobalDefaultBuildingConfigVersion === 'function') {
            var sharedVersion = Number(FirebaseService.getGlobalDefaultBuildingConfigVersion());
            if (Number.isFinite(sharedVersion) && sharedVersion > targetVersion) {
                targetVersion = sharedVersion;
            }
        }
        return targetVersion;
    }

    function getEffectiveBuildingPositions(deps) {
        return Object.assign(
            {},
            getResolvedDefaultBuildingPositions(deps.currentEvent, deps.FirebaseService),
            deps.getBuildingPositions()
        );
    }

    function getEffectiveBuildingConfig(deps) {
        return deps.normalizeBuildingConfig(
            deps.getBuildingConfig(),
            getResolvedDefaultBuildingConfig(deps.currentEvent, deps)
        );
    }

    function renderBuildingsTable(deps) {
        var tbody = deps.document.getElementById('buildingsTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        var config = deps.getBuildingConfig();
        var t = deps.t;
        var escapeAttribute = deps.escapeAttribute;

        config.forEach(function (b, index) {
            var row = deps.document.createElement('tr');
            var labelEditing = false;
            var slotsEditing = false;
            var priorityEditing = false;
            row.innerHTML = '\n            <td>\n                <div class="building-field-cell">\n                    <input type="text" value="' + escapeAttribute((b.label || b.name)) + '" data-index="' + index + '" data-field="label" class="building-label-input" ' + (labelEditing ? '' : 'disabled') + '>\n                    <button type="button" class="building-edit-btn ' + (labelEditing ? 'is-editing' : '') + '" data-action="toggle-edit" data-field="label" title="' + (labelEditing ? 'Lock name' : 'Edit name') + '" aria-label="' + (labelEditing ? 'Lock name' : 'Edit name') + '">' + getBuildingEditIcon(labelEditing) + '</button>\n                </div>\n            </td>\n            <td data-label="' + t('slots_label') + '">\n                <div class="building-field-cell">\n                    <input type="number" min="' + deps.MIN_BUILDING_SLOTS + '" max="' + deps.MAX_BUILDING_SLOTS_TOTAL + '" value="' + b.slots + '" data-index="' + index + '" data-field="slots" class="building-slots-input" ' + (slotsEditing ? '' : 'disabled') + '>\n                    <button type="button" class="building-edit-btn ' + (slotsEditing ? 'is-editing' : '') + '" data-action="toggle-edit" data-field="slots" title="' + (slotsEditing ? 'Lock slots' : 'Edit slots') + '" aria-label="' + (slotsEditing ? 'Lock slots' : 'Edit slots') + '">' + getBuildingEditIcon(slotsEditing) + '</button>\n                </div>\n            </td>\n            <td data-label="' + t('priority_label') + '">\n                <div class="building-field-cell">\n                    <input type="number" min="1" max="6" value="' + b.priority + '" data-index="' + index + '" data-field="priority" class="building-priority-input" ' + (priorityEditing ? '' : 'disabled') + '>\n                    <button type="button" class="building-edit-btn ' + (priorityEditing ? 'is-editing' : '') + '" data-action="toggle-edit" data-field="priority" title="' + (priorityEditing ? 'Lock priority' : 'Edit priority') + '" aria-label="' + (priorityEditing ? 'Lock priority' : 'Edit priority') + '">' + getBuildingEditIcon(priorityEditing) + '</button>\n                </div>\n            </td>\n        ';
            tbody.appendChild(row);
        });
    }

    function readBuildingConfigFromTable(deps) {
        var tbody = deps.document.getElementById('buildingsTableBody');
        var updated = deps.getBuildingConfig().map(function (b) { return Object.assign({}, b); });
        if (!tbody) {
            return { updated: updated, totalSlots: deps.getBuildingSlotsTotal(updated) };
        }
        var inputs = tbody.querySelectorAll('input[data-index][data-field]');
        inputs.forEach(function (input) {
            var index = Number(input.getAttribute('data-index'));
            if (!Number.isFinite(index) || !updated[index]) {
                return;
            }
            var field = input.getAttribute('data-field');
            if (field === 'label') {
                var raw = String(input.value || '').trim();
                updated[index].label = raw || updated[index].name;
                return;
            }

            var value = Number(input.value);
            if (!Number.isFinite(value)) {
                return;
            }
            if (field === 'priority') {
                updated[index].priority = deps.clampPriority(value, updated[index].priority);
            } else if (field === 'slots') {
                updated[index].slots = deps.clampSlots(value, updated[index].slots);
            }
        });
        return { updated: updated, totalSlots: deps.getBuildingSlotsTotal(updated) };
    }

    function loadBuildingConfig(deps) {
        var currentEvent = deps.currentEvent;
        var FirebaseService = deps.FirebaseService;

        if (!FirebaseService) {
            deps.setBuildingConfig(getResolvedDefaultBuildingConfig(currentEvent, deps));
            renderBuildingsTable(deps);
            return;
        }
        var eventContext = deps.getEventGameplayContext(currentEvent);
        var stored = FirebaseService.getBuildingConfig(currentEvent, eventContext || undefined);
        var defaultConfig = getResolvedDefaultBuildingConfig(currentEvent, deps);
        var shouldResetToDefaults = !Array.isArray(stored) || stored.length === 0;
        var normalized = shouldResetToDefaults
            ? deps.normalizeBuildingConfig(defaultConfig, defaultConfig)
            : deps.normalizeBuildingConfig(stored, stored);
        deps.setBuildingConfig(normalized);
        var totalSlots = deps.getBuildingSlotsTotal(normalized);
        var slotsOverLimit = totalSlots > deps.MAX_BUILDING_SLOTS_TOTAL;
        if (slotsOverLimit) {
            deps.setBuildingConfig(deps.normalizeBuildingConfig(defaultConfig, defaultConfig));
            deps.showMessage('buildingsStatus', deps.t('buildings_slots_exceeded_saved', { max: deps.MAX_BUILDING_SLOTS_TOTAL }), 'error');
        }

        var config = deps.getBuildingConfig();
        var needsSave = shouldResetToDefaults || slotsOverLimit || !Array.isArray(stored) || stored.length !== config.length || stored.some(function (item) {
            if (!item || !item.name) {
                return true;
            }
            var match = config.find(function (b) { return b.name === item.name; });
            if (!match) {
                return true;
            }
            var priority = Number(item.priority);
            var slots = Number(item.slots);
            if (!Number.isFinite(priority) || priority !== match.priority) {
                return true;
            }
            if (!Number.isFinite(slots) || slots !== match.slots) {
                return true;
            }
            var storedLabel = (typeof item.label === 'string' && item.label.trim()) ? item.label.trim() : item.name;
            if (storedLabel !== match.label) {
                return true;
            }
            var storedShowOnMap = !Object.prototype.hasOwnProperty.call(item, 'showOnMap') || item.showOnMap !== false;
            var matchShowOnMap = !Object.prototype.hasOwnProperty.call(match, 'showOnMap') || match.showOnMap !== false;
            if (storedShowOnMap !== matchShowOnMap) {
                return true;
            }
            return false;
        });

        if (needsSave) {
            var targetVersion = getTargetBuildingConfigVersion(deps.BUILDING_CONFIG_VERSION, FirebaseService);
            FirebaseService.setBuildingConfig(currentEvent, config, eventContext || undefined);
            FirebaseService.setBuildingConfigVersion(currentEvent, targetVersion, eventContext || undefined);
        }

        renderBuildingsTable(deps);
        return needsSave;
    }

    function loadBuildingPositions(deps) {
        var currentEvent = deps.currentEvent;
        var FirebaseService = deps.FirebaseService;

        if (!FirebaseService) {
            deps.setBuildingPositionsLocal({});
            return false;
        }
        var eventContext = deps.getEventGameplayContext(currentEvent);
        var stored = FirebaseService.getBuildingPositions(currentEvent, eventContext || undefined);
        var targetVersion = getTargetBuildingPositionsVersion(deps.BUILDING_POSITIONS_VERSION, FirebaseService);
        var targetDefaults = getResolvedDefaultBuildingPositions(currentEvent, FirebaseService);
        deps.setBuildingPositionsLocal(normalizeBuildingPositions(stored, currentEvent));
        if (Object.keys(deps.getBuildingPositions()).length === 0) {
            deps.setBuildingPositionsLocal(targetDefaults);
            FirebaseService.setBuildingPositions(currentEvent, deps.getBuildingPositions(), eventContext || undefined);
            FirebaseService.setBuildingPositionsVersion(currentEvent, targetVersion, eventContext || undefined);
            return true;
        }
        return false;
    }

    function resetBuildingsToDefault(deps) {
        deps.setBuildingConfig(getResolvedDefaultBuildingConfig(deps.currentEvent, deps));
        renderBuildingsTable(deps);
    }

    async function saveBuildingConfig(deps) {
        var result = readBuildingConfigFromTable(deps);
        if (result.totalSlots > deps.MAX_BUILDING_SLOTS_TOTAL) {
            deps.showMessage('buildingsStatus', deps.t('buildings_slots_exceeded', { max: deps.MAX_BUILDING_SLOTS_TOTAL, total: result.totalSlots }), 'error');
            return;
        }

        deps.setBuildingConfig(deps.normalizeBuildingConfig(result.updated, getResolvedDefaultBuildingConfig(deps.currentEvent, deps)));
        renderBuildingsTable(deps);

        var FirebaseService = deps.FirebaseService;
        if (!FirebaseService) {
            deps.showMessage('buildingsStatus', deps.t('buildings_changes_not_saved'), 'error');
            return;
        }
        var gameplayContext = deps.getGameplayContext('buildingsStatus');
        if (!gameplayContext) {
            return;
        }
        var eventContext = { gameId: gameplayContext.gameId, eventId: deps.normalizeEventId(deps.currentEvent) };
        var targetVersion = getTargetBuildingConfigVersion(deps.BUILDING_CONFIG_VERSION, FirebaseService);

        FirebaseService.setBuildingConfig(deps.currentEvent, deps.getBuildingConfig(), eventContext);
        FirebaseService.setBuildingConfigVersion(deps.currentEvent, targetVersion, eventContext);
        var saveResult = await FirebaseService.saveUserData(undefined, gameplayContext);
        if (saveResult.success) {
            deps.showMessage('buildingsStatus', deps.t('buildings_saved'), 'success');
        } else {
            deps.showMessage('buildingsStatus', deps.t('buildings_save_failed', { error: saveResult.error }), 'error');
        }
    }

    function refreshBuildingConfigForAssignments(deps) {
        if (deps.isConfigurationPageVisible()) {
            return syncBuildingConfigFromTable(deps);
        }
        loadBuildingConfig(deps);
        return true;
    }

    function syncBuildingConfigFromTable(deps) {
        var tbody = deps.document.getElementById('buildingsTableBody');
        if (!tbody || !deps.isConfigurationPageVisible()) {
            return true;
        }
        var result = readBuildingConfigFromTable(deps);
        if (result.totalSlots > deps.MAX_BUILDING_SLOTS_TOTAL) {
            deps.showMessage('buildingsStatus', deps.t('buildings_slots_exceeded', { max: deps.MAX_BUILDING_SLOTS_TOTAL, total: result.totalSlots }), 'error');
            return false;
        }
        deps.setBuildingConfig(deps.normalizeBuildingConfig(result.updated, getResolvedDefaultBuildingConfig(deps.currentEvent, deps)));
        return true;
    }

    async function saveBuildingPositions(deps) {
        var FirebaseService = deps.FirebaseService;
        if (!FirebaseService) {
            deps.showMessage('coordStatus', deps.t('coord_changes_not_saved'), 'error');
            return;
        }
        var gameplayContext = deps.getGameplayContext('coordStatus');
        if (!gameplayContext) {
            return;
        }
        var targetVersion = getTargetBuildingPositionsVersion(deps.BUILDING_POSITIONS_VERSION, FirebaseService);
        var eventContext = { gameId: gameplayContext.gameId, eventId: deps.normalizeEventId(deps.currentEvent) };
        FirebaseService.setBuildingPositions(deps.currentEvent, deps.getBuildingPositions(), eventContext);
        FirebaseService.setBuildingPositionsVersion(deps.currentEvent, targetVersion, eventContext);
        var saveResult = await FirebaseService.saveUserData(undefined, gameplayContext);
        if (saveResult.success) {
            deps.showMessage('coordStatus', deps.t('coord_saved'), 'success');
        } else {
            deps.showMessage('coordStatus', deps.t('coord_save_failed', { error: saveResult.error }), 'error');
        }
    }

    global.DSBuildingsConfigManager = {
        getDefaultBuildings: getDefaultBuildings,
        getBuildingDisplayName: getBuildingDisplayName,
        isBuildingShownOnMap: isBuildingShownOnMap,
        getBuildingEditIcon: getBuildingEditIcon,
        toggleBuildingFieldEdit: toggleBuildingFieldEdit,
        getResolvedDefaultBuildingConfig: getResolvedDefaultBuildingConfig,
        getResolvedDefaultBuildingPositions: getResolvedDefaultBuildingPositions,
        getTargetBuildingPositionsVersion: getTargetBuildingPositionsVersion,
        getTargetBuildingConfigVersion: getTargetBuildingConfigVersion,
        getEffectiveBuildingPositions: getEffectiveBuildingPositions,
        getEffectiveBuildingConfig: getEffectiveBuildingConfig,
        renderBuildingsTable: renderBuildingsTable,
        readBuildingConfigFromTable: readBuildingConfigFromTable,
        loadBuildingConfig: loadBuildingConfig,
        loadBuildingPositions: loadBuildingPositions,
        resetBuildingsToDefault: resetBuildingsToDefault,
        saveBuildingConfig: saveBuildingConfig,
        refreshBuildingConfigForAssignments: refreshBuildingConfigForAssignments,
        syncBuildingConfigFromTable: syncBuildingConfigFromTable,
        saveBuildingPositions: saveBuildingPositions,
        normalizeBuildingPositions: normalizeBuildingPositions,
    };
})(window);
