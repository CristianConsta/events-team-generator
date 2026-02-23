(function initCoreReliability(global) {
    var DECAY_FACTOR = 0.85;

    var TIERS = [
        { min: 90, max: 100, tier: 'excellent', label: 'Rock solid',      color: '#2e7d32', cssClass: 'reliability-excellent' },
        { min: 70, max: 89,  tier: 'good',      label: 'Reliable',        color: '#1565c0', cssClass: 'reliability-good'      },
        { min: 50, max: 69,  tier: 'fair',       label: 'Inconsistent',    color: '#ef6c00', cssClass: 'reliability-fair'      },
        { min: 30, max: 49,  tier: 'poor',       label: 'Unreliable',      color: '#c62828', cssClass: 'reliability-poor'      },
        { min: 0,  max: 29,  tier: 'critical',   label: 'Chronic no-show', color: '#b71c1c', cssClass: 'reliability-critical'  },
    ];

    var NULL_TIER = { tier: 'new', label: 'No history', color: '#757575', cssClass: 'reliability-new' };

    function calculateReliabilityScore(history) {
        if (!Array.isArray(history)) {
            return null;
        }

        var validCount = 0;
        var attendedWeight = 0;
        var totalWeight = 0;
        var decayIndex = 0;

        for (var i = 0; i < history.length; i++) {
            var entry = history[i];
            var status = entry && entry.status;

            if (status === 'cancelled_event') {
                continue;
            }

            validCount++;
            var weight = Math.pow(DECAY_FACTOR, decayIndex);
            decayIndex++;

            if (status === 'attended') {
                attendedWeight += weight;
                totalWeight += weight;
            } else if (status === 'late_sub') {
                attendedWeight += weight * 0.8;
                totalWeight += weight;
            } else if (status === 'excused') {
                // skip — neither weight incremented
            } else if (status === 'no_show') {
                totalWeight += weight;
            }
        }

        if (validCount < 3) {
            return null;
        }
        if (totalWeight === 0) {
            return null;
        }

        return Math.round((attendedWeight / totalWeight) * 100);
    }

    function getReliabilityTier(score) {
        if (score === null || score === undefined) {
            return NULL_TIER;
        }

        for (var i = 0; i < TIERS.length; i++) {
            var tier = TIERS[i];
            if (score >= tier.min && score <= tier.max) {
                return { tier: tier.tier, label: tier.label, color: tier.color, cssClass: tier.cssClass };
            }
        }

        // Clamp: below 0 → critical, above 100 → excellent
        if (score < 0) {
            return { tier: TIERS[4].tier, label: TIERS[4].label, color: TIERS[4].color, cssClass: TIERS[4].cssClass };
        }
        return { tier: TIERS[0].tier, label: TIERS[0].label, color: TIERS[0].color, cssClass: TIERS[0].cssClass };
    }

    function recalculatePlayerStats(history, existing) {
        var base = existing && typeof existing === 'object' ? existing : {};

        if (!Array.isArray(history) || history.length === 0) {
            return Object.assign({}, base, {
                totalEvents: 0,
                attended: 0,
                noShows: 0,
                excused: 0,
                reliabilityScore: null,
                currentStreak: 0,
                longestNoShowStreak: 0,
                lastEventDate: null,
                recentHistory: [],
            });
        }

        // history is most-recent-first
        var totalEvents = 0;
        var attended = 0;
        var noShows = 0;
        var excused = 0;
        var lastEventDate = null;

        // current streak: consecutive 'attended' from the most recent (index 0)
        var currentStreak = 0;
        var streakBroken = false;

        // longest no-show streak
        var longestNoShowStreak = 0;
        var currentNoShowStreak = 0;

        for (var i = 0; i < history.length; i++) {
            var entry = history[i];
            var status = entry && entry.status;

            if (status === 'cancelled_event') {
                continue;
            }

            totalEvents++;

            if (lastEventDate === null && entry.scheduledAt) {
                lastEventDate = entry.scheduledAt;
            }

            if (status === 'attended' || status === 'late_sub') {
                attended++;
                if (!streakBroken) {
                    currentStreak++;
                }
                if (currentNoShowStreak > longestNoShowStreak) {
                    longestNoShowStreak = currentNoShowStreak;
                }
                currentNoShowStreak = 0;
            } else if (status === 'no_show') {
                noShows++;
                streakBroken = true;
                currentNoShowStreak++;
            } else if (status === 'excused') {
                excused++;
                // excused does not break current streak nor increment no-show streak
            }
        }

        // finalize longest no-show streak
        if (currentNoShowStreak > longestNoShowStreak) {
            longestNoShowStreak = currentNoShowStreak;
        }

        var reliabilityScore = calculateReliabilityScore(history);

        // recentHistory: last 10 entries newest-first (history is already newest-first)
        var recentHistory = history.slice(0, 10).map(function (entry) {
            return {
                historyId: entry.historyId || null,
                status: entry.status || null,
                eventName: entry.eventName || null,
                scheduledAt: entry.scheduledAt || null,
            };
        });

        return Object.assign({}, base, {
            totalEvents: totalEvents,
            attended: attended,
            noShows: noShows,
            excused: excused,
            reliabilityScore: reliabilityScore,
            currentStreak: currentStreak,
            longestNoShowStreak: longestNoShowStreak,
            lastEventDate: lastEventDate,
            recentHistory: recentHistory,
        });
    }

    global.DSCoreReliability = {
        calculateReliabilityScore: calculateReliabilityScore,
        getReliabilityTier: getReliabilityTier,
        recalculatePlayerStats: recalculatePlayerStats,
    };
})(window);
