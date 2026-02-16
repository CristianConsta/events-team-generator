(function initPlayersManagementActions(global) {
    function readAddPlayerPayload(options) {
        const settings = options && typeof options === 'object' ? options : {};
        const doc = settings.document || global.document;
        const readValue = function readValue(id, fallback) {
            const el = doc && typeof doc.getElementById === 'function' ? doc.getElementById(id) : null;
            return el ? el.value : fallback;
        };

        return {
            name: readValue('playersMgmtNewName', ''),
            power: readValue('playersMgmtNewPower', 0),
            thp: readValue('playersMgmtNewThp', 0),
            troops: readValue('playersMgmtNewTroops', 'Unknown'),
        };
    }

    function toFilterChangePayload(event) {
        const target = event && event.target ? event.target : null;
        return {
            id: target && target.id ? target.id : '',
            value: target && typeof target.value !== 'undefined' ? target.value : '',
        };
    }

    global.DSFeaturePlayersManagementActions = {
        readAddPlayerPayload: readAddPlayerPayload,
        toFilterChangePayload: toFilterChangePayload,
    };
})(window);
