(function initEventsManagerActions(global) {
    function normalizeEditIntent(value) {
        const intent = typeof value === 'string' ? value.trim().toLowerCase() : '';
        if (intent === 'save' || intent === 'cancel' || intent === 'delete') {
            return intent;
        }
        return 'edit';
    }

    function buildMetadataPatch(options) {
        const source = options && typeof options === 'object' ? options : {};
        const name = typeof source.name === 'string' ? source.name.trim() : '';
        const logoDataUrl = typeof source.logoDataUrl === 'string' ? source.logoDataUrl : '';
        const mapDataUrl = typeof source.mapDataUrl === 'string' ? source.mapDataUrl : '';
        return {
            name: name,
            logoDataUrl: logoDataUrl,
            mapDataUrl: mapDataUrl,
        };
    }

    global.DSFeatureEventsManagerActions = {
        normalizeEditIntent: normalizeEditIntent,
        buildMetadataPatch: buildMetadataPatch,
    };
})(window);
