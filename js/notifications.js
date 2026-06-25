// Shared notification bell. Loaded on every page by js/supabase.js.
// Self-contained: checks auth, injects the bell into .header-right only when signed in,
// loads recent notifications, marks them read, and updates live via Realtime.
(function () {
    if (window.__notifBellLoaded) return;
    window.__notifBellLoaded = true;

    function svg(paths) {
        return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ' +
            'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
    }
    const BELL_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
        'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
    const ICONS = {
        scores_posted: svg('<line x1="6" y1="20" x2="6" y2="13"/><line x1="12" y1="20" x2="12" y2="7"/><line x1="18" y1="20" x2="18" y2="10"/>'),
        league_join_request: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>'),
        league_join_response: svg('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'),
        matchup_result: svg('<path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 4H4v2a3 3 0 0 0 3 3M17 4h3v2a3 3 0 0 1-3 3M9 21h6M12 14v7"/>'),
        friend_request: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>'),
        chat_message: svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
        default: BELL_SVG
    };

    let bellEl, dropdownEl, badgeEl, listEl, currentUserId = null, notifications = [], channel = null;

    const esc = window.escapeHtml || function (s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    };

    function timeAgo(iso) {
        const then = new Date(iso).getTime();
        if (isNaN(then)) return '';
        const s = Math.floor((Date.now() - then) / 1000);
        if (s < 60) return 'just now';
        const m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
        const h = Math.floor(m / 60); if (h < 24) return h + 'h ago';
        const d = Math.floor(h / 24); if (d < 7) return d + 'd ago';
        return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function injectStyles() {
        const css = `
.notif-wrap { position: relative; display: flex; align-items: center; margin-right: 0.75rem; }
.notif-bell { position: relative; background: transparent; border: none; cursor: pointer; font-size: 1.1rem; line-height: 1; padding: 0.35rem; border-radius: 6px; color: var(--text-2); }
.notif-bell:hover { background: var(--s3); color: var(--text); }
.notif-badge { position: absolute; top: -2px; right: -2px; min-width: 16px; height: 16px; padding: 0 4px; background: #e74c3c; color: #fff; border-radius: 8px; font-size: 0.62rem; font-weight: 700; display: flex; align-items: center; justify-content: center; font-family: var(--body); box-sizing: border-box; }
.notif-dropdown { position: absolute; top: 135%; right: 0; width: 320px; max-width: 86vw; max-height: 420px; overflow-y: auto; background: var(--s1); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); display: none; z-index: 1200; }
.notif-dropdown.open { display: block; }
.notif-head { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); font-size: 0.8rem; font-weight: 700; color: var(--text); position: sticky; top: 0; background: var(--s1); }
.notif-markall { background: transparent; border: none; color: var(--teal); font-size: 0.72rem; cursor: pointer; font-family: var(--body); font-weight: 600; }
.notif-markall:hover { text-decoration: underline; }
.notif-empty { padding: 2rem 1rem; text-align: center; color: var(--text-2); font-size: 0.82rem; }
.notif-item { display: flex; gap: 0.6rem; padding: 0.7rem 1rem; border-bottom: 1px solid var(--border); cursor: pointer; }
.notif-item:last-child { border-bottom: none; }
.notif-item:hover { background: var(--s2); }
.notif-item.unread { background: var(--teal-bg); }
.notif-item.unread:hover { background: rgba(78,205,196,0.12); }
.notif-icon { color: var(--text-2); flex-shrink: 0; display: flex; line-height: 0; padding-top: 1px; }
.notif-body { min-width: 0; }
.notif-title { font-size: 0.8rem; font-weight: 600; color: var(--text); }
.notif-msg { font-size: 0.76rem; color: var(--text-2); margin-top: 0.1rem; line-height: 1.4; word-break: break-word; }
.notif-time { font-size: 0.68rem; color: var(--text-3); margin-top: 0.25rem; }`;
        const tag = document.createElement('style');
        tag.textContent = css;
        document.head.appendChild(tag);
    }

    function buildBell(headerRight) {
        const wrap = document.createElement('div');
        wrap.className = 'notif-wrap';
        wrap.innerHTML =
            '<button class="notif-bell" id="notifBell" aria-label="Notifications" title="Notifications">' + BELL_SVG +
            '<span class="notif-badge" id="notifBadge" style="display:none;">0</span></button>' +
            '<div class="notif-dropdown" id="notifDropdown">' +
            '<div class="notif-head"><span>Notifications</span>' +
            '<button class="notif-markall" id="notifMarkAll">Mark all read</button></div>' +
            '<div id="notifList"></div></div>';
        headerRight.insertBefore(wrap, headerRight.firstChild);

        bellEl = wrap.querySelector('#notifBell');
        dropdownEl = wrap.querySelector('#notifDropdown');
        badgeEl = wrap.querySelector('#notifBadge');
        listEl = wrap.querySelector('#notifList');

        bellEl.addEventListener('click', function (e) { e.stopPropagation(); dropdownEl.classList.toggle('open'); });
        wrap.querySelector('#notifMarkAll').addEventListener('click', markAllRead);
        document.addEventListener('click', function (e) { if (!e.target.closest('.notif-wrap')) dropdownEl.classList.remove('open'); });
    }

    function render() {
        const unread = notifications.filter(n => !n.read).length;
        if (unread > 0) { badgeEl.textContent = unread > 9 ? '9+' : String(unread); badgeEl.style.display = 'flex'; }
        else { badgeEl.style.display = 'none'; }

        if (!notifications.length) {
            listEl.innerHTML = '<div class="notif-empty">No notifications yet</div>';
            return;
        }
        listEl.innerHTML = notifications.map(function (n) {
            const icon = ICONS[n.type] || ICONS.default;
            const link = (n.data && n.data.link) ? n.data.link : '';
            return '<div class="notif-item ' + (n.read ? '' : 'unread') + '" data-id="' + esc(n.id) + '"' +
                (link ? ' data-link="' + esc(link) + '"' : '') + '>' +
                '<span class="notif-icon">' + icon + '</span>' +
                '<div class="notif-body">' +
                '<div class="notif-title">' + esc(n.title || '') + '</div>' +
                '<div class="notif-msg">' + esc(n.message || '') + '</div>' +
                '<div class="notif-time">' + esc(timeAgo(n.created_at)) + '</div>' +
                '</div></div>';
        }).join('');
        listEl.querySelectorAll('.notif-item').forEach(function (el) {
            el.addEventListener('click', function () { onItemClick(el.getAttribute('data-id'), el.getAttribute('data-link')); });
        });
    }

    async function loadNotifications() {
        const { data } = await supabaseClient
            .from('notifications').select('*')
            .eq('user_id', currentUserId)
            .order('created_at', { ascending: false })
            .limit(20);
        notifications = data || [];
        render();
    }

    async function markRead(ids) {
        if (!ids.length) return;
        await supabaseClient.from('notifications').update({ read: true }).in('id', ids).eq('user_id', currentUserId);
        notifications.forEach(function (n) { if (ids.indexOf(n.id) !== -1) n.read = true; });
        render();
    }

    function markAllRead() {
        markRead(notifications.filter(n => !n.read).map(n => n.id));
    }

    async function onItemClick(id, link) {
        await markRead([id]);
        if (link) window.location.href = link;
    }

    function subscribeRealtime() {
        try {
            channel = supabaseClient
                .channel('notif-' + currentUserId)
                .on('postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + currentUserId },
                    function (payload) {
                        notifications.unshift(payload.new);
                        if (notifications.length > 20) notifications.pop();
                        render();
                    })
                .subscribe();
        } catch (e) { console.warn('notif realtime failed:', e); }
    }

    async function init() {
        try {
            if (!window.supabaseClient) return;
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) return; // not signed in -> no bell
            const headerRight = document.querySelector('.header-right');
            if (!headerRight || document.querySelector('.notif-wrap')) return;
            currentUserId = user.id;
            injectStyles();
            buildBell(headerRight);
            await loadNotifications();
            subscribeRealtime();
        } catch (e) { console.warn('notif bell init failed:', e); }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
