(function initThemeColors(global) {
    'use strict';

    var cache = {};
    var root = document.documentElement;

    function invalidateCache() {
        cache = {};
    }

    // Watch for theme changes via data-theme attribute
    if (typeof MutationObserver !== 'undefined') {
        new MutationObserver(function(mutations) {
            for (var i = 0; i < mutations.length; i++) {
                if (mutations[i].attributeName === 'data-theme') {
                    invalidateCache();
                    return;
                }
            }
        }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    }

    function get(tokenName) {
        if (cache[tokenName]) { return cache[tokenName]; }
        var val = getComputedStyle(root).getPropertyValue('--ds-' + tokenName).trim();
        if (val) { cache[tokenName] = val; }
        return val || '';
    }

    function getRgb(tokenName) {
        return get(tokenName + '-rgb');
    }

    function getAlpha(tokenName, alpha) {
        var rgb = getRgb(tokenName);
        return rgb ? 'rgba(' + rgb + ', ' + alpha + ')' : '';
    }

    function teamConfig(team) {
        var prefix = team === 'A' ? 'team-a' : 'team-b';
        return {
            primary: get(prefix),
            light: get(prefix + '-light'),
            rgb: getRgb(prefix)
        };
    }

    function reliabilityColor(tier) {
        return get('reliability-' + tier);
    }

    function paletteColor(index, type) {
        return get('palette-' + index + '-' + type);
    }

    global.DSThemeColors = {
        get: get,
        getRgb: getRgb,
        getAlpha: getAlpha,
        teamConfig: teamConfig,
        reliabilityColor: reliabilityColor,
        paletteColor: paletteColor,
        invalidateCache: invalidateCache
    };
})(window);
