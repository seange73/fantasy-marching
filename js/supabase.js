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
window.escapeHtml = escapeHtml;
window.jsStr = jsStr;
window.avatarHtml = avatarHtml;

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

// Export functions for use in other scripts
window.fantasyMarching = {
    supabase: supabaseClient,
    getCurrentUser,
    getUserProfile
};