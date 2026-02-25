(function initFeaturePlayerUpdatesView(global) {
    var FRESHNESS_THRESHOLD_DAYS = 30;

    // Render token generation modal with links.
    // container: HTMLElement, tokens: Array<{ playerName, link }>
    function renderTokenModal(container, tokens) {
        if (!container) return;
        container.innerHTML = '';

        if (!tokens || tokens.length === 0) {
            var empty = document.createElement('p');
            empty.setAttribute('data-i18n', 'player_updates_no_tokens');
            empty.textContent = 'No tokens generated.';
            container.appendChild(empty);
            return;
        }

        var list = document.createElement('ul');
        list.className = 'token-link-list';

        tokens.forEach(function(token) {
            var item = document.createElement('li');
            item.className = 'token-link-row';

            var nameEl = document.createElement('span');
            nameEl.className = 'token-player-name';
            nameEl.textContent = token.playerName || '';

            var linkEl = document.createElement('a');
            linkEl.className = 'token-link-url';
            linkEl.href = token.link || '#';
            linkEl.textContent = token.link || '';
            linkEl.setAttribute('target', '_blank');
            linkEl.setAttribute('rel', 'noopener noreferrer');

            var copyBtn = document.createElement('button');
            copyBtn.className = 'secondary token-copy-btn';
            copyBtn.setAttribute('data-link', token.link || '');
            copyBtn.setAttribute('data-i18n', 'player_updates_copy_link');
            var playerName = (token && token.playerName) || 'player';
            copyBtn.setAttribute('title', 'Copy link for ' + playerName);
            copyBtn.setAttribute('aria-label', 'Copy link for ' + playerName);
            copyBtn.innerHTML = '<span class="action-btn-text">' + t('player_updates_copy_link') + '</span><span class="action-btn-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="2" width="10" height="12" rx="1.5"/><path d="M6,1h4v2H6z"/><line x1="5.5" y1="7" x2="10.5" y2="7"/><line x1="5.5" y1="10" x2="10.5" y2="10"/></svg></span>';

            item.appendChild(nameEl);
            item.appendChild(linkEl);
            item.appendChild(copyBtn);
            list.appendChild(item);
        });

        container.appendChild(list);
    }

    // Render pending updates review panel.
    // container: HTMLElement, updates: Array<pending_update docs with deltas>
    function renderReviewPanel(container, updates) {
        if (!container) return;
        container.innerHTML = '';

        var refreshBtn = document.createElement('button');
        refreshBtn.className = 'btn btn-secondary btn-sm';
        refreshBtn.setAttribute('data-i18n', 'player_updates_refresh');
        refreshBtn.textContent = global.DSI18N && global.DSI18N.t ? global.DSI18N.t('player_updates_refresh') : 'Refresh';
        refreshBtn.addEventListener('click', function() {
            if (typeof global.refreshPlayerUpdatesPanel === 'function') {
                global.refreshPlayerUpdatesPanel();
            }
        });
        container.appendChild(refreshBtn);

        if (!updates || updates.length === 0) {
            var empty = document.createElement('p');
            empty.setAttribute('data-i18n', 'player_updates_no_pending');
            empty.textContent = 'No pending updates.';
            container.appendChild(empty);
            return;
        }

        updates.forEach(function(update) {
            var row = renderComparisonRow(update);
            if (row) {
                container.appendChild(row);
            }
        });
    }

    // Render side-by-side comparison row for one pending update.
    // update: pending_update doc with deltas pre-calculated by DSFeaturePlayerUpdatesCore.calculateDeltas
    // Returns: HTMLElement
    function renderComparisonRow(update) {
        if (!update) return null;

        var deltas = null;
        if (
            global.DSFeaturePlayerUpdatesCore
            && typeof global.DSFeaturePlayerUpdatesCore.calculateDeltas === 'function'
        ) {
            deltas = global.DSFeaturePlayerUpdatesCore.calculateDeltas(
                update.currentSnapshot || {},
                update.proposedValues || {}
            );
        }

        var row = document.createElement('div');
        row.className = 'review-comparison-row';
        row.setAttribute('data-update-id', update.id || '');

        var header = document.createElement('div');
        header.className = 'review-player-header';

        var nameEl = document.createElement('span');
        nameEl.className = 'review-player-name';
        nameEl.textContent = update.playerName || '';
        header.appendChild(nameEl);

        var sourceBadge = document.createElement('span');
        sourceBadge.className = 'review-source-badge review-source-badge--' + (update.contextType || 'unknown');
        sourceBadge.textContent = update.contextType === 'personal'
            ? ((global.DSI18N && global.DSI18N.t) ? global.DSI18N.t('player_updates_source_personal') : 'Personal')
            : ((global.DSI18N && global.DSI18N.t) ? global.DSI18N.t('player_updates_source_alliance') : 'Alliance');
        header.appendChild(sourceBadge);

        row.appendChild(header);

        var table = document.createElement('table');
        table.className = 'review-comparison-table';

        var thead = document.createElement('thead');
        var headRow = document.createElement('tr');
        var DSI18N = global.DSI18N || {};
        [
            DSI18N.t ? DSI18N.t('player_updates_col_field') : 'Field',
            DSI18N.t ? DSI18N.t('player_updates_col_current') : 'Current',
            DSI18N.t ? DSI18N.t('player_updates_col_proposed') : 'Proposed',
            DSI18N.t ? DSI18N.t('player_updates_col_change') : 'Change',
        ].forEach(function(label) {
            var th = document.createElement('th');
            th.textContent = label;
            headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        table.appendChild(thead);

        var tbody = document.createElement('tbody');

        if (deltas) {
            function fmtVal(v) { return v !== null && Number.isFinite(v) ? String(v) : '\u2014'; }
            function fmtDelta(v) {
                if (v === null || !Number.isFinite(v)) return '\u2014';
                return (v > 0 ? '+' : '') + String(v);
            }

            function buildDeltaRow(label, delta, isFlagged) {
                var tr = document.createElement('tr');
                if (isFlagged) { tr.className = 'flagged'; }
                [label, fmtVal(delta.old), fmtVal(delta.new), fmtDelta(delta.delta)].forEach(function(text) {
                    var td = document.createElement('td');
                    td.textContent = text;
                    tr.appendChild(td);
                });
                return tr;
            }

            if (deltas.power) {
                tbody.appendChild(buildDeltaRow('Power', deltas.power, deltas.power.flagged));
            }
            if (deltas.thp) {
                tbody.appendChild(buildDeltaRow('THP', deltas.thp, deltas.thp.flagged));
            }

            // Troops uses a different format (string values, changed flag)
            if (deltas.troops) {
                var troopsTr = document.createElement('tr');
                if (deltas.troops.changed) { troopsTr.className = 'flagged'; }
                [
                    'Troops',
                    String(deltas.troops.old || ''),
                    String(deltas.troops.new || ''),
                    deltas.troops.changed ? 'Changed' : 'Unchanged',
                ].forEach(function(text) {
                    var td = document.createElement('td');
                    td.textContent = text;
                    troopsTr.appendChild(td);
                });
                tbody.appendChild(troopsTr);
            }
        }

        table.appendChild(tbody);
        row.appendChild(table);

        // Decision buttons (Approve / Reject)
        var decisionGroup = document.createElement('div');
        decisionGroup.className = 'review-decision-group';

        var approveBtn = document.createElement('button');
        approveBtn.type = 'button';
        approveBtn.className = 'primary review-approve-btn';
        approveBtn.setAttribute('data-update-id', update.id || '');
        approveBtn.setAttribute('data-i18n', 'player_updates_approve_btn');
        approveBtn.textContent = (global.DSI18N && global.DSI18N.t)
            ? global.DSI18N.t('player_updates_approve_btn') : 'Approve';

        var rejectBtn = document.createElement('button');
        rejectBtn.type = 'button';
        rejectBtn.className = 'secondary review-reject-btn';
        rejectBtn.setAttribute('data-update-id', update.id || '');
        rejectBtn.setAttribute('data-i18n', 'player_updates_reject_btn');
        rejectBtn.textContent = (global.DSI18N && global.DSI18N.t)
            ? global.DSI18N.t('player_updates_reject_btn') : 'Reject';

        approveBtn.addEventListener('click', function() {
            var updateId = approveBtn.getAttribute('data-update-id');
            if (global.DSFeaturePlayerUpdatesController
                && typeof global.DSFeaturePlayerUpdatesController.approveUpdate === 'function') {
                approveBtn.disabled = true;
                rejectBtn.disabled = true;
                global.DSFeaturePlayerUpdatesController.approveUpdate(updateId).then(function(result) {
                    if (result && result.cancelled) {
                        approveBtn.disabled = false;
                        rejectBtn.disabled = false;
                        return;
                    }
                    if (result && result.ok) {
                        row.classList.add('review-decision-applied');
                        row.setAttribute('aria-disabled', 'true');
                    } else {
                        approveBtn.disabled = false;
                        rejectBtn.disabled = false;
                    }
                });
            }
        });

        rejectBtn.addEventListener('click', function() {
            var updateId = rejectBtn.getAttribute('data-update-id');
            if (global.DSFeaturePlayerUpdatesController
                && typeof global.DSFeaturePlayerUpdatesController.rejectUpdate === 'function') {
                rejectBtn.disabled = true;
                approveBtn.disabled = true;
                global.DSFeaturePlayerUpdatesController.rejectUpdate(updateId).then(function(result) {
                    if (result && result.ok) {
                        row.classList.add('review-decision-applied');
                        row.setAttribute('aria-disabled', 'true');
                    } else {
                        rejectBtn.disabled = false;
                        approveBtn.disabled = false;
                    }
                });
            }
        });

        decisionGroup.appendChild(approveBtn);
        decisionGroup.appendChild(rejectBtn);
        row.appendChild(decisionGroup);
        return row;
    }

    // Render pending updates badge on nav.
    // container: HTMLElement, count: number
    function renderPendingBadge(container, count) {
        if (!container) return;
        container.textContent = count || '0';
        if (count && count > 0) {
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
    }

    // Render data freshness dot for a player.
    // lastUpdated: Date | null, now: Date
    // Returns: HTMLElement with aria-label
    function renderFreshnessDot(lastUpdated, now) {
        var dot = document.createElement('span');
        dot.className = 'freshness-dot';

        if (!lastUpdated) {
            dot.classList.add('freshness-never');
            dot.setAttribute('aria-label', 'Never updated via self-update');
            dot.setAttribute('title', 'Never updated via self-update');
            return dot;
        }

        var lastMs = lastUpdated instanceof Date
            ? lastUpdated.getTime()
            : (lastUpdated && typeof lastUpdated.toDate === 'function'
                ? lastUpdated.toDate().getTime()
                : Number(lastUpdated));
        var nowMs = now instanceof Date ? now.getTime() : Number(now);
        var diffDays = (nowMs - lastMs) / (24 * 60 * 60 * 1000);

        if (diffDays <= FRESHNESS_THRESHOLD_DAYS) {
            dot.classList.add('freshness-fresh');
            dot.setAttribute('aria-label', 'Updated within last ' + FRESHNESS_THRESHOLD_DAYS + ' days');
            dot.setAttribute('title', 'Updated within last ' + FRESHNESS_THRESHOLD_DAYS + ' days');
        } else {
            dot.classList.add('freshness-stale');
            dot.setAttribute('aria-label', 'Data stale — last updated ' + Math.floor(diffDays) + ' days ago');
            dot.setAttribute('title', 'Data stale — last updated ' + Math.floor(diffDays) + ' days ago');
        }

        return dot;
    }

    global.DSFeaturePlayerUpdatesView = {
        renderTokenModal: renderTokenModal,
        renderReviewPanel: renderReviewPanel,
        renderComparisonRow: renderComparisonRow,
        renderPendingBadge: renderPendingBadge,
        renderFreshnessDot: renderFreshnessDot,
    };
})(window);
