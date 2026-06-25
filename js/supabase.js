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

window.escapeHtml = escapeHtml;
window.jsStr = jsStr;
window.avatarHtml = avatarHtml;
window.relativeTime = relativeTime;

// Auth state listener
supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('Auth event:', event);
    
    // Get current page
    const currentPage = window.location.pathname;
    const isAuthPage = currentPage === '/' || currentPage === '/index.html' || currentPage === '';
    const isDashboard = currentPage === '/dashboard.html';
    
    if (event === 'SIGNED_IN' && session) {
        // User signed in
        if (isAuthPage) {
            // Redirect to dashboard if on auth page
            window.location.href = '/dashboard.html';
        }
    } else if (event === 'SIGNED_OUT' || !session) {
        // User signed out or no session
        if (isDashboard) {
            // Redirect to auth page if on dashboard
            window.location.href = '/';
        }
    }
});

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

// Export functions for use in other scripts
window.fantasyMarching = {
    supabase: supabaseClient,
    getCurrentUser,
    getUserProfile,
    renderHeaderUser
};

// Load the shared notification bell on every page. It self-checks auth and only
// renders when signed in, so it is a no-op on the login page.
(function () {
    const s = document.createElement('script');
    s.src = '/js/notifications.js';
    s.defer = true;
    document.head.appendChild(s);
})();