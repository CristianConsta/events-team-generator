(function initCoordinatePickerController(global) {
    function getCoordinatePickerBuildingNames(deps) {
        var event = deps.getActiveEvent();
        if (!event) {
            return [];
        }

        var sourceBuildings = Array.isArray(event.buildings) ? event.buildings : [];
        var names = [];
        var seen = new Set();

        sourceBuildings.forEach(function (building) {
            if (!building || typeof building.name !== 'string') {
                return;
            }
            var name = building.name.trim();
            if (!name || seen.has(name)) {
                return;
            }
            if (building.showOnMap === false) {
                return;
            }
            seen.add(name);
            names.push(name);
        });

        if (names.length > 0) {
            return names;
        }

        return deps.getBuildingConfig()
            .filter(function (building) { return building && building.showOnMap !== false && typeof building.name === 'string' && building.name.trim(); })
            .map(function (building) { return building.name.trim(); });
    }

    function getCoordinatePickerTeamBuildings(deps) {
        var event = deps.getActiveEvent();
        var teamBuildings = [];
        var seen = new Set();

        var collect = function (sourceBuildings) {
            if (!Array.isArray(sourceBuildings)) {
                return;
            }
            sourceBuildings.forEach(function (building) {
                if (!building || typeof building.name !== 'string') {
                    return;
                }
                var name = building.name.trim();
                if (!name || seen.has(name)) {
                    return;
                }
                if (building.showOnMap !== false) {
                    return;
                }
                var label = typeof building.label === 'string' && building.label.trim()
                    ? building.label.trim()
                    : name;
                seen.add(name);
                teamBuildings.push({ name: name, label: label });
            });
        };

        collect(event && Array.isArray(event.buildings) ? event.buildings : []);
        if (teamBuildings.length > 0) {
            return teamBuildings;
        }

        collect(deps.getBuildingConfig());
        return teamBuildings;
    }

    function fitCoordText(ctx, text, maxWidth, font) {
        var value = String(text || '');
        if (!value) {
            return value;
        }
        if (!ctx || !Number.isFinite(maxWidth) || maxWidth <= 0) {
            return value;
        }
        ctx.save();
        if (font) {
            ctx.font = font;
        }
        if (ctx.measureText(value).width <= maxWidth) {
            ctx.restore();
            return value;
        }
        var suffix = '...';
        var trimmed = value;
        while (trimmed.length > 1 && ctx.measureText(trimmed + suffix).width > maxWidth) {
            trimmed = trimmed.slice(0, -1);
        }
        ctx.restore();
        return trimmed + suffix;
    }

    function updateCoordLabel(state, deps) {
        var name = state.coordBuildings[state.coordBuildingIndex];
        var displayName = name || '';
        var pos = deps.getBuildingPositions()[name];
        var t = deps.t;
        var eventNameEl = deps.document.getElementById('coordEventName');
        if (eventNameEl) {
            eventNameEl.textContent = deps.getEventDisplayName(deps.currentEvent);
        }
        deps.document.getElementById('coordBuildingLabel').textContent = displayName || '';
        deps.document.getElementById('coordBuildingIndex').textContent = '(' + (state.coordBuildingIndex + 1) + '/' + state.coordBuildings.length + ')';
        deps.document.getElementById('coordBuildingValue').textContent = pos
            ? t('coord_current', { x: pos[0], y: pos[1] })
            : t('coord_current_not_set');
        deps.document.getElementById('coordPrompt').textContent = t('coord_select_prompt', { name: displayName });
    }

    function drawCoordCanvas(state, deps) {
        var canvas = deps.document.getElementById('coordCanvas');
        if (!canvas) return;

        updateCoordLabel(state, deps);

        var MAP_EXPORT = deps.MAP_EXPORT;
        var activeMapState = deps.getMapRuntimeState(deps.currentEvent, MAP_EXPORT);
        var activeMapImage = activeMapState ? activeMapState.image : null;
        var activeMapLoaded = activeMapState ? activeMapState.loaded : false;
        var activeMapUnavailable = activeMapState ? activeMapState.unavailable : false;
        var statusEl = deps.document.getElementById('coordStatus');
        var t = deps.t;

        if (!activeMapLoaded && !activeMapUnavailable) {
            deps.loadMapImage(deps.currentEvent, MAP_EXPORT)
                .then(function () { drawCoordCanvas(state, deps); })
                .catch(function () { drawCoordCanvas(state, deps); });
            return;
        }

        var ctx = canvas.getContext('2d');
        var hasMapBackground = !!(activeMapLoaded && activeMapImage && activeMapImage.width > 0 && activeMapImage.height > 0);
        var mapWidth = deps.MAP_CANVAS_WIDTH;
        var mapHeight = hasMapBackground
            ? Math.max(1, Math.floor(activeMapImage.height * (mapWidth / activeMapImage.width)))
            : deps.MAP_CANVAS_FALLBACK_HEIGHT;
        var coordTeamBuildings = getCoordinatePickerTeamBuildings(deps);
        var hasTeamReservedArea = coordTeamBuildings.length > 0;
        var teamAreaTopGap = hasTeamReservedArea ? 12 : 0;
        var teamAreaHeaderHeight = hasTeamReservedArea ? 24 : 0;
        var teamTagHeight = hasTeamReservedArea ? 28 : 0;
        var teamTagGap = hasTeamReservedArea ? 8 : 0;
        var teamTagColumns = hasTeamReservedArea ? Math.min(3, coordTeamBuildings.length) : 0;
        var teamTagRows = hasTeamReservedArea ? Math.ceil(coordTeamBuildings.length / teamTagColumns) : 0;
        var teamAreaHeight = hasTeamReservedArea
            ? 12 + teamAreaHeaderHeight + (teamTagRows * teamTagHeight) + (Math.max(0, teamTagRows - 1) * teamTagGap) + 12
            : 0;

        state.coordCanvasMapHeight = mapHeight;
        canvas.width = mapWidth;
        canvas.height = mapHeight + teamAreaTopGap + teamAreaHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (hasMapBackground) {
            ctx.drawImage(activeMapImage, 0, 0, mapWidth, mapHeight);
            state.coordMapWarningShown[deps.currentEvent] = false;
            if (statusEl) {
                statusEl.innerHTML = '';
            }
        } else {
            var grad = ctx.createLinearGradient(0, 0, mapWidth, mapHeight);
            grad.addColorStop(0, '#1f2238');
            grad.addColorStop(1, '#2b2f4a');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, mapWidth, mapHeight);

            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1;
            for (var x = 0; x <= mapWidth; x += deps.MAP_GRID_STEP) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, mapHeight);
                ctx.stroke();
            }
            for (var y = 0; y <= mapHeight; y += deps.MAP_GRID_STEP) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(mapWidth, y);
                ctx.stroke();
            }

            ctx.fillStyle = 'rgba(253, 200, 48, 0.9)';
            ctx.font = 'bold 28px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('MAP PREVIEW UNAVAILABLE', mapWidth / 2, 52);
            ctx.font = '16px Arial';
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillText(t('events_manager_map_placeholder'), mapWidth / 2, 80);

            if (!state.coordMapWarningShown[deps.currentEvent]) {
                deps.showMessage('coordStatus', t('coord_map_not_loaded'), 'warning');
                state.coordMapWarningShown[deps.currentEvent] = true;
            }
        }

        var coordBuildingSet = new Set(state.coordBuildings);
        Object.entries(deps.getBuildingPositions()).forEach(function (entry) {
            var name = entry[0];
            var pos = entry[1];
            if (!pos) return;
            if (!coordBuildingSet.has(name)) return;
            var isActive = name === state.coordBuildings[state.coordBuildingIndex];
            ctx.beginPath();
            ctx.arc(pos[0], pos[1], isActive ? 8 : 5, 0, Math.PI * 2);
            ctx.fillStyle = isActive ? '#FDC830' : 'rgba(255,255,255,0.7)';
            ctx.fill();
            ctx.strokeStyle = isActive ? '#000' : 'rgba(0,0,0,0.6)';
            ctx.lineWidth = 2;
            ctx.stroke();
        });

        if (hasTeamReservedArea) {
            var panelX = 12;
            var panelY = mapHeight + teamAreaTopGap;
            var panelWidth = mapWidth - 24;
            var panelHeight = teamAreaHeight;

            var panelGrad = ctx.createLinearGradient(0, panelY, 0, panelY + panelHeight);
            panelGrad.addColorStop(0, 'rgba(22, 27, 40, 0.93)');
            panelGrad.addColorStop(1, 'rgba(18, 22, 34, 0.98)');
            ctx.fillStyle = panelGrad;
            ctx.beginPath();
            ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 12);
            ctx.fill();
            ctx.strokeStyle = 'rgba(253, 200, 48, 0.72)';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            ctx.font = 'bold 13px Arial';
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            var teamHeader = t('building_type_team') + ' ' + t('coord_label_building');
            ctx.fillText(teamHeader, panelX + 12, panelY + 18);

            ctx.font = '11px Arial';
            ctx.fillStyle = 'rgba(255,255,255,0.72)';
            ctx.textAlign = 'right';
            ctx.fillText(String(coordTeamBuildings.length), panelX + panelWidth - 12, panelY + 18);

            var cardsTop = panelY + 12 + teamAreaHeaderHeight;
            var cardGap = 8;
            var cardWidth = Math.floor((panelWidth - 24 - ((teamTagColumns - 1) * cardGap)) / teamTagColumns);

            coordTeamBuildings.forEach(function (building, index) {
                var row = Math.floor(index / teamTagColumns);
                var col = index % teamTagColumns;
                var cardX = panelX + 12 + (col * (cardWidth + cardGap));
                var cardY = cardsTop + (row * (teamTagHeight + teamTagGap));

                var cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardWidth, cardY);
                cardGrad.addColorStop(0, 'rgba(255,255,255,0.08)');
                cardGrad.addColorStop(1, 'rgba(255,255,255,0.03)');
                ctx.fillStyle = cardGrad;
                ctx.beginPath();
                ctx.roundRect(cardX, cardY, cardWidth, teamTagHeight, 8);
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.28)';
                ctx.lineWidth = 1;
                ctx.stroke();

                var tagText = t('building_type_team') + ': ' + building.label;
                ctx.font = 'bold 12px Arial';
                ctx.fillStyle = 'rgba(253, 200, 48, 0.95)';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(
                    fitCoordText(ctx, tagText, cardWidth - 16, 'bold 12px Arial'),
                    cardX + 8,
                    cardY + (teamTagHeight / 2) + 0.5
                );
            });
        }
    }

    function refreshCoordinatesPickerForCurrentEvent(state, deps) {
        if (!deps.getActiveEvent()) {
            deps.showMessage('coordStatus', deps.t('events_manager_no_events'), 'error');
            return false;
        }
        deps.loadBuildingConfig();
        deps.loadBuildingPositions();
        state.coordBuildings = getCoordinatePickerBuildingNames(deps);

        if (state.coordBuildings.length === 0) {
            deps.showMessage('coordStatus', deps.t('coord_no_mapped_buildings'), 'error');
            return false;
        }

        state.coordBuildingIndex = 0;
        drawCoordCanvas(state, deps);
        return true;
    }

    function openCoordinatesPicker(state, deps) {
        if (!deps.getActiveEvent()) {
            deps.showMessage('coordStatus', deps.t('events_manager_no_events'), 'error');
            return;
        }
        var overlay = deps.document.getElementById('coordPickerOverlay');
        if (!overlay) {
            return;
        }
        deps.openModalOverlay(overlay, { initialFocusSelector: '#coordCloseBtn' });
        refreshCoordinatesPickerForCurrentEvent(state, deps);
    }

    function openCoordinatesPickerForEvent(eventId, state, deps) {
        if (deps.EVENT_REGISTRY[eventId]) {
            deps.switchEvent(eventId);
        }
        openCoordinatesPicker(state, deps);
    }

    function closeCoordinatesPicker(deps) {
        var overlay = deps.document.getElementById('coordPickerOverlay');
        if (overlay) {
            deps.closeModalOverlay(overlay);
        }
    }

    function coordCanvasClick(event, state, deps) {
        var canvas = deps.document.getElementById('coordCanvas');
        if (!canvas) return;
        if (event && event.type === 'pointerdown' && event.button !== 0) return;
        if (event && typeof event.preventDefault === 'function') {
            event.preventDefault();
        }
        var rect = canvas.getBoundingClientRect();
        var scaleX = canvas.width / rect.width;
        var scaleY = canvas.height / rect.height;
        var x = Math.round((event.clientX - rect.left) * scaleX);
        var y = Math.round((event.clientY - rect.top) * scaleY);
        if (y > state.coordCanvasMapHeight) return;
        var name = state.coordBuildings[state.coordBuildingIndex];
        if (!name) return;
        deps.getBuildingPositions()[name] = [x, y];
        updateCoordLabel(state, deps);
        drawCoordCanvas(state, deps);
        if (state.coordBuildingIndex < state.coordBuildings.length - 1) {
            state.coordBuildingIndex += 1;
            updateCoordLabel(state, deps);
            drawCoordCanvas(state, deps);
        }
    }

    function prevCoordBuilding(state, deps) {
        if (state.coordBuildingIndex > 0) {
            state.coordBuildingIndex -= 1;
            drawCoordCanvas(state, deps);
        }
    }

    function nextCoordBuilding(state, deps) {
        if (state.coordBuildingIndex < state.coordBuildings.length - 1) {
            state.coordBuildingIndex += 1;
            drawCoordCanvas(state, deps);
        }
    }

    global.DSCoordinatePickerController = {
        getCoordinatePickerBuildingNames: getCoordinatePickerBuildingNames,
        getCoordinatePickerTeamBuildings: getCoordinatePickerTeamBuildings,
        fitCoordText: fitCoordText,
        drawCoordCanvas: drawCoordCanvas,
        refreshCoordinatesPickerForCurrentEvent: refreshCoordinatesPickerForCurrentEvent,
        openCoordinatesPicker: openCoordinatesPicker,
        openCoordinatesPickerForEvent: openCoordinatesPickerForEvent,
        closeCoordinatesPicker: closeCoordinatesPicker,
        coordCanvasClick: coordCanvasClick,
        prevCoordBuilding: prevCoordBuilding,
        nextCoordBuilding: nextCoordBuilding,
    };
})(window);
