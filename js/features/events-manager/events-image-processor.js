(function initEventsImageProcessor(global) {
    'use strict';

    function isImageDataUrl(value, maxLength) {
        var dataUrl = typeof value === 'string' ? value.trim() : '';
        if (!dataUrl || !dataUrl.startsWith('data:image/')) {
            return false;
        }
        return dataUrl.length <= maxLength;
    }

    function hashString(value) {
        var input = String(value || '');
        var hash = 2166136261;
        for (var index = 0; index < input.length; index += 1) {
            hash ^= input.charCodeAt(index);
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        }
        return Math.abs(hash >>> 0);
    }

    function generateEventAvatarDataUrl(nameSeed, idSeed, deps) {
        var seed = (nameSeed || '') + '|' + (idSeed || '') + '|event-avatar';
        var hue = hashString(seed) % 360;
        var canvas = document.createElement('canvas');
        canvas.width = 96;
        canvas.height = 96;
        var ctx = canvas.getContext('2d');
        if (!ctx) {
            return '';
        }
        var grad = ctx.createLinearGradient(0, 0, 96, 96);
        grad.addColorStop(0, 'hsl(' + hue + ', 78%, 50%)');
        grad.addColorStop(1, 'hsl(' + ((hue + 60) % 360) + ', 72%, 40%)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 96, 96);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.font = 'bold 34px Trebuchet MS';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(deps.getAvatarInitials(nameSeed || 'Event', ''), 48, 50);
        return canvas.toDataURL('image/png');
    }

    async function createEventImageDataUrl(file, options, deps) {
        var opts = options && typeof options === 'object' ? options : {};
        var maxBytes = Number(opts.maxBytes) || deps.AVATAR_MAX_UPLOAD_BYTES;
        var minDimension = Number(opts.minDimension) || deps.AVATAR_MIN_DIMENSION;
        var maxSide = Number(opts.maxSide) || 512;
        var maxDataUrlLength = Number(opts.maxDataUrlLength) || deps.EVENT_MAP_DATA_URL_LIMIT;
        var tooLargeMessage = opts.tooLargeMessage || deps.t('events_manager_image_too_large');
        var tooSmallMessage = opts.tooSmallMessage || deps.t('events_manager_image_too_small', { min: minDimension });

        if (!deps.isAllowedAvatarFile(file)) {
            throw new Error(deps.t('events_manager_invalid_image'));
        }
        if (typeof file.size === 'number' && file.size > maxBytes) {
            throw new Error(tooLargeMessage);
        }
        var rawDataUrl = await deps.readFileAsDataUrl(file);
        var img = await deps.loadImageFromDataUrl(rawDataUrl);
        if ((img.width || 0) < minDimension || (img.height || 0) < minDimension) {
            throw new Error(tooSmallMessage);
        }

        var longestSide = Math.max(img.width || 1, img.height || 1);
        var scale = Math.min(1, maxSide / longestSide);
        var width = Math.max(1, Math.round((img.width || 1) * scale));
        var height = Math.max(1, Math.round((img.height || 1) * scale));
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error(deps.t('events_manager_image_process_failed'));
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        var qualities = [0.9, 0.8, 0.7, 0.6];
        for (var i = 0; i < qualities.length; i++) {
            var jpegDataUrl = canvas.toDataURL('image/jpeg', qualities[i]);
            if (jpegDataUrl.length <= maxDataUrlLength) {
                return jpegDataUrl;
            }
        }
        var pngDataUrl = canvas.toDataURL('image/png');
        if (pngDataUrl.length <= maxDataUrlLength) {
            return pngDataUrl;
        }
        throw new Error(deps.t('events_manager_image_data_too_large'));
    }

    async function createContainedSquareImageDataUrl(sourceDataUrl, options, deps) {
        var opts = options && typeof options === 'object' ? options : {};
        var sideRaw = Number(opts.side);
        var side = Number.isFinite(sideRaw) && sideRaw > 0 ? Math.round(sideRaw) : 320;
        var maxDataUrlLength = Number(opts.maxDataUrlLength) || deps.EVENT_LOGO_DATA_URL_LIMIT;
        var img = await deps.loadImageFromDataUrl(sourceDataUrl);
        var canvas = document.createElement('canvas');
        canvas.width = side;
        canvas.height = side;
        var ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error(deps.t('events_manager_image_process_failed'));
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, side, side);

        var sourceWidth = Math.max(1, Number(img.width) || 1);
        var sourceHeight = Math.max(1, Number(img.height) || 1);
        var drawScale = Math.min(side / sourceWidth, side / sourceHeight);
        var drawWidth = Math.max(1, Math.round(sourceWidth * drawScale));
        var drawHeight = Math.max(1, Math.round(sourceHeight * drawScale));
        var offsetX = Math.round((side - drawWidth) / 2);
        var offsetY = Math.round((side - drawHeight) / 2);
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

        var qualities = [0.9, 0.8, 0.7, 0.6];
        for (var i = 0; i < qualities.length; i++) {
            var jpegDataUrl = canvas.toDataURL('image/jpeg', qualities[i]);
            if (jpegDataUrl.length <= maxDataUrlLength) {
                return jpegDataUrl;
            }
        }
        var pngDataUrl = canvas.toDataURL('image/png');
        if (pngDataUrl.length <= maxDataUrlLength) {
            return pngDataUrl;
        }
        throw new Error(deps.t('events_manager_image_data_too_large'));
    }

    async function createGameMetadataLogoDataUrl(file, deps) {
        var resized = await createEventImageDataUrl(file, {
            maxBytes: deps.AVATAR_MAX_UPLOAD_BYTES,
            minDimension: deps.AVATAR_MIN_DIMENSION,
            maxSide: 320,
            maxDataUrlLength: deps.EVENT_LOGO_DATA_URL_LIMIT,
            tooLargeMessage: deps.t('events_manager_logo_too_large'),
        }, deps);
        return createContainedSquareImageDataUrl(resized, {
            side: 320,
            maxDataUrlLength: deps.EVENT_LOGO_DATA_URL_LIMIT,
        }, deps);
    }

    global.DSEventsImageProcessor = {
        isImageDataUrl: isImageDataUrl,
        hashString: hashString,
        generateEventAvatarDataUrl: generateEventAvatarDataUrl,
        createEventImageDataUrl: createEventImageDataUrl,
        createContainedSquareImageDataUrl: createContainedSquareImageDataUrl,
        createGameMetadataLogoDataUrl: createGameMetadataLogoDataUrl,
    };
})(window);
