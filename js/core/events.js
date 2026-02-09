(function initEventsCore(global) {
    const EVENT_REGISTRY = {
        desert_storm: {
            id: 'desert_storm',
            titleKey: 'event_desert_storm',
            mapFile: 'desert-storm-map.png',
            previewMapFile: 'desert-storm-map-preview.webp',
            exportMapFile: 'desert-storm-map.png',
            mapTitle: 'DESERT STORM',
            excelPrefix: 'desert_storm',
            buildings: [
                { name: 'Bomb Squad', priority: 1, slots: 4 },
                { name: 'Oil Refinery 1', priority: 3, slots: 2 },
                { name: 'Oil Refinery 2', priority: 3, slots: 2 },
                { name: 'Field Hospital 1', priority: 4, slots: 2 },
                { name: 'Field Hospital 2', priority: 4, slots: 2 },
                { name: 'Field Hospital 3', priority: 4, slots: 2 },
                { name: 'Field Hospital 4', priority: 4, slots: 2 },
                { name: 'Info Center', priority: 5, slots: 2 },
                { name: 'Science Hub', priority: 5, slots: 2 },
            ],
            defaultPositions: {
                'Info Center': [366, 38],
                'Field Hospital 4': [785, 139],
                'Oil Refinery 1': [194, 260],
                'Field Hospital 2': [951, 247],
                'Oil Refinery 2': [914, 472],
                'Field Hospital 1': [161, 458],
                'Field Hospital 3': [314, 654],
                'Science Hub': [774, 656],
            },
            buildingAnchors: {
                'Info Center': 'left',
                'Field Hospital 4': 'right',
                'Oil Refinery 1': 'left',
                'Field Hospital 2': 'right',
                'Oil Refinery 2': 'right',
                'Field Hospital 1': 'left',
                'Field Hospital 3': 'left',
                'Science Hub': 'right',
            },
        },
        canyon_battlefield: {
            id: 'canyon_battlefield',
            titleKey: 'event_canyon_battlefield',
            mapFile: 'canon-storm-map.png',
            previewMapFile: 'canon-storm-map-preview.webp',
            exportMapFile: 'canon-storm-map.png',
            mapTitle: 'CANYON BATTLEFIELD',
            excelPrefix: 'canyon_battlefield',
            buildings: [
                { name: 'Bomb Squad', priority: 1, slots: 4 },
                { name: 'Missile Silo 1', priority: 2, slots: 2 },
                { name: 'Missile Silo 2', priority: 2, slots: 2 },
                { name: 'Radar Station 1', priority: 3, slots: 2 },
                { name: 'Radar Station 2', priority: 3, slots: 2 },
                { name: 'Watchtower 1', priority: 4, slots: 1 },
                { name: 'Watchtower 2', priority: 4, slots: 1 },
                { name: 'Watchtower 3', priority: 4, slots: 1 },
                { name: 'Watchtower 4', priority: 4, slots: 1 },
                { name: 'Command Center', priority: 3, slots: 2 },
                { name: 'Supply Depot', priority: 5, slots: 1 },
                { name: 'Armory', priority: 5, slots: 1 },
                { name: 'Comm Tower', priority: 5, slots: 0 },
            ],
            defaultPositions: {},
            buildingAnchors: {},
        },
    };

    function getEvent(eventId) {
        return EVENT_REGISTRY[eventId] || null;
    }

    function cloneEventBuildings(eventId) {
        const evt = getEvent(eventId);
        if (!evt) {
            return [];
        }
        return evt.buildings.map((building) => ({ ...building }));
    }

    function cloneDefaultPositions(eventId) {
        const evt = getEvent(eventId);
        if (!evt) {
            return {};
        }
        return JSON.parse(JSON.stringify(evt.defaultPositions || {}));
    }

    global.DSCoreEvents = {
        EVENT_REGISTRY: EVENT_REGISTRY,
        getEvent: getEvent,
        cloneEventBuildings: cloneEventBuildings,
        cloneDefaultPositions: cloneDefaultPositions,
    };
})(window);
