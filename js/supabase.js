// Password-recovery links carry a recovery token in the URL hash. If one lands on
// any page other than the reset screen (e.g. the redirect fell back to the Site URL),
// reroute to the reset screen BEFORE the client below can consume the token and just
// log the user in.
(function () {
    try {
        var h = window.location.hash || '';
        if (h.indexOf('type=recovery') !== -1 && !/\/reset-password\.html$/.test(window.location.pathname)) {
            window.location.replace('/reset-password.html' + h);
        }
    } catch (e) {}
})();

// Replace these with your actual Supabase credentials
const SUPABASE_URL = 'https://vonqrnoiroixdlgndofw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvbnFybm9pcm9peGRsZ25kb2Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg0MDIyOTcsImV4cCI6MjA2Mzk3ODI5N30.vGk9soB66Rs6Kt8fC8oHPYfZYu9Og8zndIiuIV2ZIYM';

// Initialize Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Make it globally available
window.supabaseClient = supabaseClient;

// Escape user-controlled text before injecting into innerHTML (prevents stored XSS).
// Available globally on every page that loads this module.
function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// Escape a value for a single-quoted JS string inside an HTML attribute, e.g. onclick="f('...')".
function jsStr(s) {
    return escapeHtml(String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
}
// Build avatar inner HTML: an <img> when a URL is present, else the escaped fallback initial.
function avatarHtml(url, fallback) {
    return url ? `<img src="${escapeHtml(url)}" alt="">` : escapeHtml(fallback || 'U');
}
// Relative ("time ago") formatting, shared site-wide for recency timestamps
// (chat, notifications). Never falls back to an absolute date/time once past a
// day; it rolls up through days -> months -> years. For scheduled/future dates
// (events, drafts, deadlines) keep using absolute formatting, not this.
function relativeTime(iso) {
    const ms = new Date(iso).getTime();
    if (isNaN(ms)) return '';
    let s = Math.floor((Date.now() - ms) / 1000);
    if (s < 0) s = 0;
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60); if (m < 60) return m + (m === 1 ? ' minute ago' : ' minutes ago');
    const h = Math.floor(m / 60); if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
    const d = Math.floor(h / 24); if (d < 30) return d + (d === 1 ? ' day ago' : ' days ago');
    const mo = Math.floor(d / 30); if (mo < 12) return mo + (mo === 1 ? ' month ago' : ' months ago');
    const y = Math.floor(d / 365); return y + (y === 1 ? ' year ago' : ' years ago');
}

// Current DCI World Class roster, verified against DCI's corps directory for the
// 2026 season. Keep every event, draft pool, score import, and stats view scoped
// to this list.
const DCI_WORLD_CLASS_CORPS = [
    'Blue Devils',
    'Blue Knights',
    'Blue Stars',
    'Bluecoats',
    'Boston Crusaders',
    'Carolina Crown',
    'Colts',
    'Crossmen',
    'Genesis',
    'Madison Scouts',
    'Mandarins',
    'Music City',
    'Pacific Crest',
    'Phantom Regiment',
    'Santa Clara Vanguard',
    'Seattle Cascades',
    'Spartans',
    'Spirit of Atlanta',
    'The Academy',
    'The Cavaliers',
    'Troopers'
];

function normalizeCorpsName(name) {
    return String(name || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
}

const _worldClassByNorm = new Map(DCI_WORLD_CLASS_CORPS.map(name => [normalizeCorpsName(name), name]));
const _worldClassAliases = new Map([
    ['cavaliers', 'The Cavaliers'],
    ['academy', 'The Academy'],
    ['scv', 'Santa Clara Vanguard'],
    ['santa clara vanguard cadets', null],
    ['vanguard cadets', null]
]);

function canonicalWorldClassCorpsName(name) {
    const norm = normalizeCorpsName(name);
    if (_worldClassByNorm.has(norm)) return _worldClassByNorm.get(norm);
    if (_worldClassAliases.has(norm)) return _worldClassAliases.get(norm);
    return null;
}

function isWorldClassCorps(name) {
    return !!canonicalWorldClassCorpsName(name);
}

function filterWorldClassCorps(list) {
    const seen = new Set();
    const out = [];
    (Array.isArray(list) ? list : []).forEach(name => {
        const canonical = canonicalWorldClassCorpsName(name);
        if (!canonical || seen.has(canonical)) return;
        seen.add(canonical);
        out.push(canonical);
    });
    return out;
}

function filterWorldClassScoreRows(rows, nameKey) {
    return (Array.isArray(rows) ? rows : []).filter(row => isWorldClassCorps(row && row[nameKey || 'corps_name']));
}

function filterWorldClassScoreMap(scoreMap) {
    const out = {};
    Object.entries(scoreMap || {}).forEach(([name, value]) => {
        const canonical = canonicalWorldClassCorpsName(name);
        if (canonical) out[canonical] = value;
    });
    return out;
}

function isScoredCompetitionEvent(event) {
    if (!event) return false;
    const corps = filterWorldClassCorps(event.corps_list || []);
    if (!corps.length) return false;
    if (!event.is_completed) return true;
    const scores = filterWorldClassScoreRows(event.final_scores || [], 'corps_name');
    return scores.some(s => Number(s.score) > 0 || Number(s.total_score) > 0);
}

window.escapeHtml = escapeHtml;
window.jsStr = jsStr;
window.avatarHtml = avatarHtml;
window.relativeTime = relativeTime;
window.DCI_WORLD_CLASS_CORPS = DCI_WORLD_CLASS_CORPS;
window.normalizeCorpsName = normalizeCorpsName;
window.canonicalWorldClassCorpsName = canonicalWorldClassCorpsName;
window.isWorldClassCorps = isWorldClassCorps;
window.filterWorldClassCorps = filterWorldClassCorps;
window.filterWorldClassScoreRows = filterWorldClassScoreRows;
window.filterWorldClassScoreMap = filterWorldClassScoreMap;
window.isScoredCompetitionEvent = isScoredCompetitionEvent;

// Same-site relative return path only (guards against open-redirect via ?next=).
function safeNext(value, fallback) {
    if (value && value.startsWith('/') && !value.startsWith('//')) return value;
    return fallback || '/dashboard.html';
}

// Auth state listener. The app is browse-first: logged-out visitors can view the
// public pages, so we no longer force them to the login screen here. We only bounce
// OFF the login page once a session exists.
supabaseClient.auth.onAuthStateChange((event, session) => {
    const path = window.location.pathname;
    const isLoginPage = path === '/login.html';
    if (event === 'SIGNED_IN' && session && isLoginPage) {
        const next = new URLSearchParams(window.location.search).get('next');
        window.location.href = safeNext(next, '/dashboard.html');
    }
});

// Gate an action behind auth. Call from a write handler; if the user is signed out
// it sends them to the login page and returns false (so the caller can bail).
// Comes back to where they were via ?next=.
async function requireAuth(next) {
    // getSession() is a reliable local read; getUser() does a network round-trip
    // and concurrent getUser() calls (page init + header) can race to inconsistent
    // results, so use the session for the logged-in check.
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session && session.user) return true;
    const dest = next || (window.location.pathname + window.location.search);
    window.location.href = '/login.html?next=' + encodeURIComponent(dest);
    return false;
}

// Helper function to get current user
async function getCurrentUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
}

// Helper function to get user profile
async function getUserProfile(userId) {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (error) {
        console.error('Error fetching profile:', error);
        return null;
    }
    
    return data;
}

// Render the signed-in user's header block (avatar, name, admin link) the same
// way on every page. This is the single source of truth for that block: pages
// call it instead of re-implementing the fetch + render, which is what caused the
// avatar to load on some pages but not others. Returns the profile row so callers
// can still use is_admin and other fields.
async function renderHeaderUser(user) {
    if (!user) return null;

    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('username, avatar_url, is_admin')
        .eq('id', user.id)
        .single();

    const name = (profile && profile.username) || (user.email ? user.email.split('@')[0] : 'User');
    const initial = (name[0] || 'U').toUpperCase();

    const nameEl = document.getElementById('userName');
    if (nameEl) nameEl.textContent = name;

    const avatarEl = document.getElementById('userAvatar');
    if (avatarEl) avatarEl.innerHTML = avatarHtml(profile && profile.avatar_url, initial);

    if (profile && profile.is_admin) {
        const link = document.getElementById('adminLink');
        const divider = document.getElementById('adminDivider');
        if (link) link.style.display = 'flex';
        if (divider) divider.style.display = 'block';
    }

    return profile || null;
}

// ── Season week config ────────────────────────────────────────────────────
// Single source of truth for the season's week boundaries, mirrored from the
// public.season_settings row (is_current). Replaces the 2025 dates that used to
// be hardcoded across dashboard/profile/league-detail/global-draft. Call
// loadSeasonConfig() (await) before using getCurrentWeek()/getWeekRange().
let _seasonCfg = null, _seasonCfgPromise = null;
async function loadSeasonConfig() {
    if (_seasonCfg) return _seasonCfg;
    if (!_seasonCfgPromise) {
        _seasonCfgPromise = supabaseClient
            .from('season_settings')
            .select('season, week1_start, total_weeks')
            .eq('is_current', true)
            .maybeSingle()
            .then(({ data }) => {
                _seasonCfg = data || { season: null, week1_start: null, total_weeks: 6 };
                return _seasonCfg;
            })
            .catch(() => { _seasonCfg = { season: null, week1_start: null, total_weeks: 6 }; return _seasonCfg; });
    }
    return _seasonCfgPromise;
}
const _DAY_MS = 86400000;
// Calendar dates are handled in UTC throughout so they don't shift by the
// viewer's timezone (and so getWeekRange().toISOString() yields the right day).
function _utcDateMs(d) {
    if (d instanceof Date) return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    const p = String(d).slice(0, 10).split('-');
    return Date.UTC(+p[0], (+p[1]) - 1, +p[2]);
}
function _seasonStartMs() {
    if (!_seasonCfg || !_seasonCfg.week1_start) return null;
    return _utcDateMs(_seasonCfg.week1_start);
}
// Week number (1-based) for a Date or 'YYYY-MM-DD' string, from the cached config.
function weekNumberForDate(d) {
    const start = _seasonStartMs();
    if (start == null) return 1;
    const day = _utcDateMs(d);
    if (day < start) return 1;
    if (day <= start + _DAY_MS) return 1;           // 2-day opening weekend = week 1
    const wk2 = start + 2 * _DAY_MS;
    const diffDays = Math.floor((day - wk2) / _DAY_MS);
    return Math.min(Math.floor(diffDays / 7) + 2, (_seasonCfg.total_weeks || 6));
}
function getCurrentWeek() { return weekNumberForDate(new Date()); }
// [start, end] Date range for a 1-based week number (null if no config loaded).
function getWeekRange(week) {
    const start = _seasonStartMs();
    if (start == null) return null;
    if (week <= 1) return { start: new Date(start), end: new Date(start + _DAY_MS) };
    const s = start + 2 * _DAY_MS + (week - 2) * 7 * _DAY_MS;
    return { start: new Date(s), end: new Date(s + 6 * _DAY_MS) };
}
// Warm the cache as soon as the module loads.
loadSeasonConfig();

// Export functions for use in other scripts
window.fantasyMarching = {
    supabase: supabaseClient,
    getCurrentUser,
    getUserProfile,
    renderHeaderUser,
    requireAuth,
    loadSeasonConfig,
    getCurrentWeek,
    getWeekRange,
    weekNumberForDate,
    DCI_WORLD_CLASS_CORPS,
    normalizeCorpsName,
    canonicalWorldClassCorpsName,
    isWorldClassCorps,
    filterWorldClassCorps,
    filterWorldClassScoreRows,
    filterWorldClassScoreMap,
    isScoredCompetitionEvent
};
window.requireAuth = requireAuth;

// On a public page, a signed-out visitor gets a "Log In" button in the header in
// place of the user menu. Centralized here so individual pages don't each have to
// add it (mirrors how the notification bell injects itself when signed in).
(function () {
    async function renderLoggedOutHeader() {
        try {
            if (!window.supabaseClient) return;
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session && session.user) return;           // signed in: page renders its own user block
            const hr = document.querySelector('.header-right');
            if (!hr || hr.querySelector('.login-cta')) return;
            const profile = hr.querySelector('.user-profile');
            if (profile) profile.style.display = 'none';   // hide the empty avatar/name menu
            if (!document.getElementById('loginCtaStyle')) {
                const st = document.createElement('style');
                st.id = 'loginCtaStyle';
                st.textContent =
                    '.login-cta{display:inline-flex;align-items:center;gap:0.4rem;background:var(--teal);color:var(--bg);' +
                    'font-family:var(--body);font-weight:700;font-size:0.82rem;padding:0.45rem 1rem;border-radius:6px;' +
                    'text-decoration:none;white-space:nowrap;}.login-cta:hover{opacity:0.9;}';
                document.head.appendChild(st);
            }
            const a = document.createElement('a');
            a.className = 'login-cta';
            a.href = '/login.html?next=' + encodeURIComponent(window.location.pathname + window.location.search);
            a.textContent = 'Log In';
            hr.appendChild(a);
        } catch (e) { /* no-op on the login page etc. */ }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderLoggedOutHeader);
    else renderLoggedOutHeader();
})();

// Load the shared notification bell on every page. It self-checks auth and only
// renders when signed in, so it is a no-op on the login page.
(function () {
    const s = document.createElement('script');
    s.src = '/js/notifications.js';
    s.defer = true;
    document.head.appendChild(s);
})();

// On narrow screens the header nav scrolls horizontally; bring the active
// page's link into view so it never sits scrolled off-screen.
(function () {
    function revealActiveNav() {
        const active = document.querySelector('.nav a.active');
        if (active && active.scrollIntoView) {
            try { active.scrollIntoView({ inline: 'center', block: 'nearest' }); } catch (e) {}
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', revealActiveNav);
    } else {
        revealActiveNav();
    }
})();

// Load the shared corps-detail popup (window.showCorpsDetail / fantasyMarching.showCorpsDetail).
// Self-contained: injects its own styles + modal on first use.
(function () {
    const s = document.createElement('script');
    s.src = '/js/corps-detail.js';
    s.defer = true;
    document.head.appendChild(s);
})();

// Load the shared friend direct-messages messenger on every page. It self-checks
// auth and only renders when signed in, so it is a no-op on the login page.
(function () {
    const s = document.createElement('script');
    s.src = '/js/direct-messages.js';
    s.defer = true;
    document.head.appendChild(s);
})();

// Load the contextual help system: the content registry (window.INFO_TOPICS) and
// the popover component that renders it for any [data-info] / .info-tip trigger.
['/js/info-content.js', '/js/info-tips.js'].forEach(function (src) {
    const s = document.createElement('script');
    s.src = src;
    s.defer = true;
    document.head.appendChild(s);
});
