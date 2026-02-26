const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modulePath = path.resolve(__dirname, '../js/core/reliability.js');

function loadModule() {
    global.window = global;
    delete global.DSCoreReliability;
    delete require.cache[require.resolve(modulePath)];
    require(modulePath);
}

// ---------------------------------------------------------------------------
// calculateReliabilityScore
// ---------------------------------------------------------------------------

test('calculateReliabilityScore: empty history returns null', () => {
    loadModule();
    assert.equal(global.DSCoreReliability.calculateReliabilityScore([]), null);
});

test('calculateReliabilityScore: non-array returns null', () => {
    loadModule();
    assert.equal(global.DSCoreReliability.calculateReliabilityScore(null), null);
    assert.equal(global.DSCoreReliability.calculateReliabilityScore(undefined), null);
});

test('calculateReliabilityScore: 2 non-cancelled entries returns a score (threshold is 1)', () => {
    loadModule();
    const history = [
        { status: 'attended' },
        { status: 'no_show' },
    ];
    const score = global.DSCoreReliability.calculateReliabilityScore(history);
    assert.ok(score !== null, 'score should not be null with 2 entries');
    assert.ok(score > 0 && score < 100, 'score should be between 0 and 100');
});

test('calculateReliabilityScore: exactly 3 attended entries returns score close to 100', () => {
    loadModule();
    const history = [
        { status: 'attended' },
        { status: 'attended' },
        { status: 'attended' },
    ];
    const score = global.DSCoreReliability.calculateReliabilityScore(history);
    assert.ok(score !== null, 'score should not be null');
    assert.ok(score >= 99, 'score should be close to 100');
});

test('calculateReliabilityScore: mix of attended and no_show returns value between 0 and 100', () => {
    loadModule();
    const history = [
        { status: 'attended' },
        { status: 'no_show' },
        { status: 'attended' },
    ];
    const score = global.DSCoreReliability.calculateReliabilityScore(history);
    assert.ok(score !== null);
    assert.ok(score > 0 && score < 100);
});

test('calculateReliabilityScore: all 5 no_show returns 0', () => {
    loadModule();
    const history = [
        { status: 'no_show' },
        { status: 'no_show' },
        { status: 'no_show' },
        { status: 'no_show' },
        { status: 'no_show' },
    ];
    assert.equal(global.DSCoreReliability.calculateReliabilityScore(history), 0);
});

test('calculateReliabilityScore: all 5 excused returns null (totalWeight=0)', () => {
    loadModule();
    const history = [
        { status: 'excused' },
        { status: 'excused' },
        { status: 'excused' },
        { status: 'excused' },
        { status: 'excused' },
    ];
    assert.equal(global.DSCoreReliability.calculateReliabilityScore(history), null);
});

test('calculateReliabilityScore: cancelled_event + attended mix with 2 valid entries returns score', () => {
    loadModule();
    // 2 non-cancelled entries → score (threshold is 1)
    const history = [
        { status: 'cancelled_event' },
        { status: 'cancelled_event' },
        { status: 'attended' },
        { status: 'attended' },
    ];
    const score = global.DSCoreReliability.calculateReliabilityScore(history);
    assert.ok(score !== null, 'score should not be null with 2 valid entries');
    assert.ok(score >= 99, 'all attended should be close to 100');
});

test('calculateReliabilityScore: 3 late_sub entries score equals 80', () => {
    loadModule();
    // Each late_sub adds weight*0.8 to attendedWeight and weight to totalWeight
    // score = 0.8 → 80
    const history = [
        { status: 'late_sub' },
        { status: 'late_sub' },
        { status: 'late_sub' },
    ];
    assert.equal(global.DSCoreReliability.calculateReliabilityScore(history), 80);
});

test('calculateReliabilityScore: recency weighting — no_show first scores lower', () => {
    loadModule();
    // Recent no_show has higher weight → lower score
    const recentNoShow = [
        { status: 'no_show' },
        { status: 'attended' },
        { status: 'attended' },
        { status: 'attended' },
        { status: 'attended' },
    ];
    // Recent attended has higher weight → higher score
    const recentAttended = [
        { status: 'attended' },
        { status: 'attended' },
        { status: 'attended' },
        { status: 'attended' },
        { status: 'no_show' },
    ];
    const scoreRecentNoShow = global.DSCoreReliability.calculateReliabilityScore(recentNoShow);
    const scoreRecentAttended = global.DSCoreReliability.calculateReliabilityScore(recentAttended);
    assert.ok(scoreRecentNoShow < scoreRecentAttended, 'recent no_show should produce lower score');
});

test('calculateReliabilityScore: GOLDEN SNAPSHOT exact value = 81', () => {
    loadModule();
    const score = global.DSCoreReliability.calculateReliabilityScore([
        { status: 'attended' },
        { status: 'attended' },
        { status: 'no_show' },
        { status: 'attended' },
        { status: 'attended' },
    ]);
    assert.equal(score, 81);
});

// ---------------------------------------------------------------------------
// getReliabilityTier
// ---------------------------------------------------------------------------

test('getReliabilityTier: boundary values', () => {
    loadModule();
    const { getReliabilityTier } = global.DSCoreReliability;

    assert.equal(getReliabilityTier(100).tier, 'excellent');
    assert.equal(getReliabilityTier(90).tier, 'excellent');
    assert.equal(getReliabilityTier(89).tier, 'good');
    assert.equal(getReliabilityTier(70).tier, 'good');
    assert.equal(getReliabilityTier(69).tier, 'fair');
    assert.equal(getReliabilityTier(50).tier, 'fair');
    assert.equal(getReliabilityTier(49).tier, 'poor');
    assert.equal(getReliabilityTier(30).tier, 'poor');
    assert.equal(getReliabilityTier(29).tier, 'critical');
    assert.equal(getReliabilityTier(0).tier, 'critical');
    assert.equal(getReliabilityTier(null).tier, 'new');
});

test('getReliabilityTier: returns cssClass and color fields', () => {
    loadModule();
    const { getReliabilityTier } = global.DSCoreReliability;
    const tier = getReliabilityTier(95);
    assert.ok(tier.cssClass, 'should have cssClass');
    assert.ok(tier.color, 'should have color');
    assert.ok(tier.label, 'should have label');
});

// ---------------------------------------------------------------------------
// recalculatePlayerStats
// ---------------------------------------------------------------------------

test('recalculatePlayerStats: 5 attended entries', () => {
    loadModule();
    const history = [
        { status: 'attended', scheduledAt: '2026-01-05' },
        { status: 'attended', scheduledAt: '2026-01-04' },
        { status: 'attended', scheduledAt: '2026-01-03' },
        { status: 'attended', scheduledAt: '2026-01-02' },
        { status: 'attended', scheduledAt: '2026-01-01' },
    ];
    const stats = global.DSCoreReliability.recalculatePlayerStats(history);
    assert.equal(stats.attended, 5);
    assert.equal(stats.noShows, 0);
    assert.equal(stats.currentStreak, 5);
    assert.equal(stats.longestNoShowStreak, 0);
});

test('recalculatePlayerStats: streak breaks on no_show', () => {
    loadModule();
    // newest-first: attended, attended, no_show, attended
    const history = [
        { status: 'attended', scheduledAt: '2026-01-04' },
        { status: 'attended', scheduledAt: '2026-01-03' },
        { status: 'no_show', scheduledAt: '2026-01-02' },
        { status: 'attended', scheduledAt: '2026-01-01' },
    ];
    const stats = global.DSCoreReliability.recalculatePlayerStats(history);
    assert.equal(stats.currentStreak, 2);
    assert.equal(stats.longestNoShowStreak, 1);
});

test('recalculatePlayerStats: all excused', () => {
    loadModule();
    const history = [
        { status: 'excused', scheduledAt: '2026-01-03' },
        { status: 'excused', scheduledAt: '2026-01-02' },
        { status: 'excused', scheduledAt: '2026-01-01' },
    ];
    const stats = global.DSCoreReliability.recalculatePlayerStats(history);
    assert.equal(stats.excused, 3);
    assert.equal(stats.attended, 0);
    assert.equal(stats.noShows, 0);
    assert.equal(stats.currentStreak, 0);
});

test('recalculatePlayerStats: cancelled_event does not increment totalEvents', () => {
    loadModule();
    const history = [
        { status: 'cancelled_event', scheduledAt: '2026-01-03' },
        { status: 'attended', scheduledAt: '2026-01-02' },
        { status: 'attended', scheduledAt: '2026-01-01' },
    ];
    const stats = global.DSCoreReliability.recalculatePlayerStats(history);
    assert.equal(stats.totalEvents, 2);
});

test('recalculatePlayerStats: recentHistory truncated to 10 entries', () => {
    loadModule();
    const history = [];
    for (let i = 0; i < 15; i++) {
        history.push({ status: 'attended', scheduledAt: '2026-01-' + String(i + 1).padStart(2, '0') });
    }
    const stats = global.DSCoreReliability.recalculatePlayerStats(history);
    assert.equal(stats.recentHistory.length, 10);
});

test('recalculatePlayerStats: longestNoShowStreak of 3', () => {
    loadModule();
    // newest-first: attended, no_show, no_show, no_show, attended
    const history = [
        { status: 'attended', scheduledAt: '2026-01-05' },
        { status: 'no_show', scheduledAt: '2026-01-04' },
        { status: 'no_show', scheduledAt: '2026-01-03' },
        { status: 'no_show', scheduledAt: '2026-01-02' },
        { status: 'attended', scheduledAt: '2026-01-01' },
    ];
    const stats = global.DSCoreReliability.recalculatePlayerStats(history);
    assert.equal(stats.longestNoShowStreak, 3);
});

test('recalculatePlayerStats: lastEventDate set to most recent non-cancelled entry scheduledAt', () => {
    loadModule();
    const history = [
        { status: 'cancelled_event', scheduledAt: '2026-01-04' },
        { status: 'attended', scheduledAt: '2026-01-03' },
        { status: 'attended', scheduledAt: '2026-01-01' },
    ];
    const stats = global.DSCoreReliability.recalculatePlayerStats(history);
    assert.equal(stats.lastEventDate, '2026-01-03');
});

test('recalculatePlayerStats: empty history returns zeroed stats', () => {
    loadModule();
    const stats = global.DSCoreReliability.recalculatePlayerStats([]);
    assert.equal(stats.totalEvents, 0);
    assert.equal(stats.attended, 0);
    assert.equal(stats.noShows, 0);
    assert.equal(stats.currentStreak, 0);
    assert.equal(stats.longestNoShowStreak, 0);
    assert.equal(stats.lastEventDate, null);
    assert.deepEqual(stats.recentHistory, []);
});
