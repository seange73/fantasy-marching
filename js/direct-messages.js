// Shared friend direct-messages (DM) messenger. Loaded on every page by js/supabase.js.
// Self-contained: checks auth, injects a floating launcher (bottom-right) only when
// signed in, lists conversations with your friends, and opens a 1:1 thread.
//
// Mirrors the league-chat design (see league-detail.html): all writes go through
// SECURITY DEFINER RPCs (send_direct_message / delete_direct_message), unread is
// DERIVED from dm_reads (never a stored counter), and mark_dm_read is the single
// sync point that clears BOTH the unread badge and the bell notification.
(function () {
    if (window.__dmLoaded) return;
    window.__dmLoaded = true;

    const esc = window.escapeHtml || function (s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    };
    const avatarHtml = window.avatarHtml || function (url, fb) {
        return url ? '<img src="' + esc(url) + '" alt="">' : esc(fb || 'U');
    };

    const GROUP_GAP_MS = 5 * 60 * 1000;   // group same-sender messages within 5 min
    const MSG_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

    let me = null;                 // my user id
    let profileMap = {};           // user_id -> { id, username, avatar_url }
    let friendIds = new Set();     // accepted friends
    let readMap = {};              // other_id -> Date (my last_read_at for that convo)
    let convoMeta = {};            // other_id -> { lastMsg, unread }
    let threadCache = {};          // other_id -> [messages asc]
    let threadIds = {};            // other_id -> Set(message ids) loaded
    let active = null;             // open thread's other_id (or null = list view)
    let open = false;
    let channel = null;
    let pendingDelete = null;      // message id awaiting inline delete confirm

    // ---------- time ----------
    function dmTime(iso) {
        const d = new Date(iso), ms = d.getTime();
        if (isNaN(ms)) return '';
        if (Date.now() - ms < 86400000) {
            return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        }
        return window.relativeTime ? window.relativeTime(iso) : '';
    }

    // ---------- styles ----------
    function injectStyles() {
        const css = `
.dm-wrap { position: fixed; right: 1.25rem; bottom: 1.25rem; z-index: 1090; font-family: var(--body); }
.dm-wrap.dm-stacked { bottom: calc(1.25rem + 52px); }   /* sit above the league-chat launcher */
.dm-launcher { position: relative; display: flex; align-items: center; gap: 0.5rem; background: var(--s2); color: var(--text); border: 1px solid var(--border); border-radius: 24px; padding: 0.6rem 1.05rem; font-weight: 700; font-size: 0.85rem; cursor: pointer; box-shadow: 0 6px 18px rgba(0,0,0,0.35); }
.dm-launcher:hover { border-color: var(--teal); color: var(--teal); }
.dm-launcher svg { width: 18px; height: 18px; }
.dm-badge { position: absolute; top: -6px; right: -6px; min-width: 18px; height: 18px; padding: 0 5px; background: #e74c3c; color: #fff; border-radius: 9px; font-size: 0.66rem; font-weight: 700; display: none; align-items: center; justify-content: center; box-sizing: border-box; }
.dm-panel { position: absolute; right: 0; bottom: 56px; width: 340px; max-width: 88vw; height: 470px; max-height: 72vh; background: var(--s1); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 12px 32px rgba(0,0,0,0.45); display: flex; flex-direction: column; overflow: hidden; }
.dm-panel[hidden] { display: none; }
.dm-head { display: flex; align-items: center; gap: 0.5rem; padding: 0.7rem 0.9rem; border-bottom: 1px solid var(--border); }
.dm-back { background: transparent; border: none; color: var(--text-2); font-size: 1.35rem; line-height: 1; cursor: pointer; padding: 0 0.15rem; }
.dm-back:hover { color: var(--text); }
.dm-title { flex: 1; font-size: 0.85rem; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dm-close { background: transparent; border: none; color: var(--text-2); font-size: 1.2rem; line-height: 1; cursor: pointer; padding: 0 0.2rem; }
.dm-close:hover { color: var(--text); }
/* conversation list */
.dm-list { flex: 1; overflow-y: auto; }
.dm-empty { margin: 2rem 1rem; text-align: center; color: var(--text-2); font-size: 0.82rem; line-height: 1.5; }
.dm-convo { display: flex; align-items: center; gap: 0.65rem; padding: 0.7rem 0.9rem; border-bottom: 1px solid var(--border); cursor: pointer; }
.dm-convo:hover { background: var(--s2); }
.dm-convo.dm-unread { background: var(--teal-bg); }
.dm-convo.dm-unread:hover { background: rgba(78,205,196,0.12); }
.dm-cv-avatar { width: 38px; height: 38px; flex-shrink: 0; border-radius: 50%; overflow: hidden; background: var(--s3); color: var(--teal); display: flex; align-items: center; justify-content: center; font-size: 0.82rem; font-weight: 700; border: 1.5px solid var(--teal-dim); }
.dm-cv-avatar img { width: 100%; height: 100%; object-fit: cover; }
.dm-cv-body { flex: 1; min-width: 0; }
.dm-cv-top { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; }
.dm-cv-name { font-size: 0.85rem; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dm-cv-time { font-size: 0.66rem; color: var(--text-3); flex-shrink: 0; }
.dm-cv-preview { font-size: 0.76rem; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 0.1rem; }
.dm-convo.dm-unread .dm-cv-preview { color: var(--text); font-weight: 600; }
.dm-cv-dot { width: 18px; height: 18px; flex-shrink: 0; border-radius: 9px; background: #e74c3c; color: #fff; font-size: 0.62rem; font-weight: 700; display: flex; align-items: center; justify-content: center; }
/* thread */
.dm-thread { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.dm-thread[hidden] { display: none; }
.dm-messages { flex: 1; overflow-y: auto; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.55rem; }
.dm-msg { display: flex; gap: 0.5rem; align-items: flex-start; }
.dm-msg.dm-mine { flex-direction: row-reverse; }
.dm-msg.dm-cont { margin-top: -0.34rem; }
.dm-avatar { width: 30px; height: 30px; flex-shrink: 0; border-radius: 50%; overflow: hidden; background: var(--s3); color: var(--text); display: flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 700; }
.dm-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.dm-avatar.dm-spacer { background: transparent; }
.dm-bubble { max-width: 76%; }
.dm-msg.dm-mine .dm-bubble { text-align: right; }
.dm-meta { display: flex; align-items: center; gap: 0.4rem; font-size: 0.66rem; color: var(--text-3); margin-bottom: 0.12rem; }
.dm-msg.dm-mine .dm-meta { flex-direction: row-reverse; }
.dm-text { display: inline-block; background: var(--s2); border: 1px solid var(--border); color: var(--text); padding: 0.4rem 0.6rem; border-radius: 10px; font-size: 0.8rem; line-height: 1.35; word-break: break-word; white-space: pre-wrap; text-align: left; }
.dm-msg.dm-mine .dm-text { background: var(--teal-bg); border-color: rgba(78,205,196,0.4); }
.dm-msg.dm-cont:not(.dm-mine) .dm-text { border-top-left-radius: 4px; }
.dm-msg.dm-cont.dm-mine .dm-text { border-top-right-radius: 4px; }
.dm-del { align-self: center; background: transparent; border: none; color: var(--text-3); cursor: pointer; font-size: 1.05rem; line-height: 1; padding: 0 2px; opacity: 0; transition: opacity 0.12s; flex-shrink: 0; }
.dm-msg:hover .dm-del { opacity: 1; }
.dm-del:hover { color: #e74c3c; }
.dm-confirm { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.3rem; font-size: 0.72rem; color: var(--text-2); }
.dm-msg.dm-mine .dm-confirm { justify-content: flex-end; }
.dm-confirm button { border: 1px solid var(--border); background: var(--s2); color: var(--text); border-radius: 6px; padding: 0.12rem 0.5rem; font-size: 0.72rem; cursor: pointer; font-family: var(--body); }
.dm-confirm .dm-confirm-yes { background: #e74c3c; border-color: #e74c3c; color: #fff; }
.dm-thread-empty { margin: auto; text-align: center; color: var(--text-2); font-size: 0.8rem; padding: 1rem; }
.dm-composer { display: flex; gap: 0.45rem; padding: 0.6rem; border-top: 1px solid var(--border); }
.dm-composer input { flex: 1; background: var(--s2); border: 1px solid var(--border); border-radius: 18px; color: var(--text); padding: 0.5rem 0.8rem; font-size: 0.8rem; font-family: var(--body); outline: none; }
.dm-composer input:focus { border-color: var(--teal); }
.dm-composer button { background: var(--teal); color: #06231f; border: none; border-radius: 18px; padding: 0 0.95rem; font-weight: 700; font-size: 0.78rem; cursor: pointer; }
.dm-composer button:disabled { opacity: 0.5; cursor: default; }`;
        const tag = document.createElement('style');
        tag.textContent = css;
        document.head.appendChild(tag);
    }

    // ---------- DOM ----------
    function buildDom() {
        const wrap = document.createElement('div');
        wrap.className = 'dm-wrap';
        wrap.id = 'directMessages';
        wrap.innerHTML =
            '<div class="dm-panel" id="dmPanel" hidden>' +
              '<div class="dm-head">' +
                '<button class="dm-back" id="dmBack" hidden aria-label="Back">&lsaquo;</button>' +
                '<span class="dm-title" id="dmTitle">Messages</span>' +
                '<button class="dm-close" id="dmClose" aria-label="Close">&times;</button>' +
              '</div>' +
              '<div class="dm-list" id="dmList"></div>' +
              '<div class="dm-thread" id="dmThread" hidden>' +
                '<div class="dm-messages" id="dmMessages"></div>' +
                '<form class="dm-composer" id="dmForm" autocomplete="off">' +
                  '<input id="dmInput" maxlength="2000" placeholder="Write a message..." aria-label="Message" />' +
                  '<button type="submit">Send</button>' +
                '</form>' +
              '</div>' +
            '</div>' +
            '<button class="dm-launcher" id="dmLauncher">' + MSG_ICON + '<span>Messages</span>' +
              '<span class="dm-badge" id="dmBadge">0</span></button>';
        document.body.appendChild(wrap);
        document.getElementById('dmLauncher').addEventListener('click', togglePanel);
        document.getElementById('dmClose').addEventListener('click', closePanel);
        document.getElementById('dmBack').addEventListener('click', backToList);
        document.getElementById('dmForm').addEventListener('submit', sendDm);
        positionForLeagueChat();
        // The league-chat launcher mounts asynchronously on league-detail; restack when it appears/leaves.
        try {
            const obs = new MutationObserver(positionForLeagueChat);
            obs.observe(document.body, { childList: true });
        } catch (e) {}
    }

    function positionForLeagueChat() {
        const wrap = document.getElementById('directMessages');
        if (wrap) wrap.classList.toggle('dm-stacked', !!document.getElementById('leagueChat'));
    }

    // ---------- data ----------
    async function loadData() {
        // Accepted friends (two parameterized queries, merged -- never a .or() string).
        const [fa, fb] = await Promise.all([
            supabaseClient.from('friendships').select('addressee_id').eq('requester_id', me).eq('status', 'accepted'),
            supabaseClient.from('friendships').select('requester_id').eq('addressee_id', me).eq('status', 'accepted')
        ]);
        friendIds = new Set();
        (fa.data || []).forEach(r => friendIds.add(r.addressee_id));
        (fb.data || []).forEach(r => friendIds.add(r.requester_id));

        // Recent messages, both directions (two eq queries, merged).
        const [m1, m2] = await Promise.all([
            supabaseClient.from('direct_messages').select('id,sender_id,recipient_id,body,created_at').eq('sender_id', me).order('created_at', { ascending: false }).limit(200),
            supabaseClient.from('direct_messages').select('id,sender_id,recipient_id,body,created_at').eq('recipient_id', me).order('created_at', { ascending: false }).limit(200)
        ]);
        const all = [].concat(m1.data || [], m2.data || []);

        // My read markers.
        const { data: reads } = await supabaseClient.from('dm_reads').select('other_user_id,last_read_at').eq('user_id', me);
        readMap = {};
        (reads || []).forEach(r => { readMap[r.other_user_id] = new Date(r.last_read_at); });

        // Conversation metadata: last message + unread per other-user.
        convoMeta = {};
        for (const msg of all) {
            const other = msg.sender_id === me ? msg.recipient_id : msg.sender_id;
            if (!convoMeta[other]) convoMeta[other] = { lastMsg: null, unread: 0 };
            const cur = convoMeta[other].lastMsg;
            if (!cur || new Date(msg.created_at) > new Date(cur.created_at)) convoMeta[other].lastMsg = msg;
        }
        for (const msg of all) {
            if (msg.sender_id === me) continue;        // unread = incoming only
            const other = msg.sender_id;
            const rd = readMap[other];
            if (!rd || new Date(msg.created_at) > rd) convoMeta[other].unread++;
        }

        // Profiles for friends + anyone with an existing conversation.
        const ids = new Set(friendIds);
        Object.keys(convoMeta).forEach(id => ids.add(id));
        ids.delete(me);
        if (ids.size) {
            const { data: profs } = await supabaseClient.from('profiles').select('id,username,avatar_url').in('id', [...ids]);
            (profs || []).forEach(p => { profileMap[p.id] = p; });
        }
        renderList();
        updateBadge();
    }

    function prof(id) { return profileMap[id] || { username: 'User', avatar_url: '' }; }

    // ---------- conversation list ----------
    function renderList() {
        const box = document.getElementById('dmList');
        if (!box) return;
        const ids = new Set(friendIds);
        Object.keys(convoMeta).forEach(id => ids.add(id));
        ids.delete(me);

        const entries = [...ids].map(id => {
            const meta = convoMeta[id] || { lastMsg: null, unread: 0 };
            return { id, name: prof(id).username || 'User', meta };
        });
        // Conversations with messages first (most recent), then remaining friends A-Z.
        entries.sort((a, b) => {
            const at = a.meta.lastMsg ? new Date(a.meta.lastMsg.created_at).getTime() : 0;
            const bt = b.meta.lastMsg ? new Date(b.meta.lastMsg.created_at).getTime() : 0;
            if (at !== bt) return bt - at;
            return a.name.localeCompare(b.name);
        });

        if (!entries.length) {
            box.innerHTML = '<div class="dm-empty">No friends yet.<br>Add friends from a profile to start messaging.</div>';
            return;
        }
        box.innerHTML = entries.map(e => {
            const p = prof(e.id);
            const initial = (p.username || 'U').charAt(0).toUpperCase();
            const lm = e.meta.lastMsg;
            let preview = 'Say hello — start the conversation';
            if (lm) preview = (lm.sender_id === me ? 'You: ' : '') + lm.body;
            const time = lm ? dmTime(lm.created_at) : '';
            const unread = e.meta.unread > 0;
            const dot = unread ? '<span class="dm-cv-dot">' + (e.meta.unread > 9 ? '9+' : e.meta.unread) + '</span>' : '';
            return '<div class="dm-convo' + (unread ? ' dm-unread' : '') + '" data-id="' + esc(e.id) + '">' +
                '<div class="dm-cv-avatar">' + avatarHtml(p.avatar_url, initial) + '</div>' +
                '<div class="dm-cv-body">' +
                  '<div class="dm-cv-top"><span class="dm-cv-name">' + esc(p.username || 'User') + '</span>' +
                    '<span class="dm-cv-time">' + esc(time) + '</span></div>' +
                  '<div class="dm-cv-preview">' + esc(preview) + '</div>' +
                '</div>' + dot + '</div>';
        }).join('');
        box.querySelectorAll('.dm-convo').forEach(el =>
            el.addEventListener('click', () => openThread(el.getAttribute('data-id'))));
    }

    // ---------- thread ----------
    async function loadThread(otherId) {
        const [a, b] = await Promise.all([
            supabaseClient.from('direct_messages').select('id,sender_id,recipient_id,body,created_at').eq('sender_id', me).eq('recipient_id', otherId).order('created_at', { ascending: false }).limit(50),
            supabaseClient.from('direct_messages').select('id,sender_id,recipient_id,body,created_at').eq('sender_id', otherId).eq('recipient_id', me).order('created_at', { ascending: false }).limit(50)
        ]);
        const msgs = [].concat(a.data || [], b.data || []);
        msgs.sort((x, y) => new Date(x.created_at) - new Date(y.created_at));
        threadCache[otherId] = msgs;
        threadIds[otherId] = new Set(msgs.map(m => m.id));
    }

    function threadRowHtml(m, cont) {
        const mine = m.sender_id === me;
        const p = prof(m.sender_id);
        const initial = (p.username || 'U').charAt(0).toUpperCase();
        const pending = (m.id === pendingDelete);
        const avatar = cont
            ? '<div class="dm-avatar dm-spacer"></div>'
            : '<div class="dm-avatar">' + avatarHtml(p.avatar_url, initial) + '</div>';
        const meta = cont ? '' :
            '<div class="dm-meta"><span class="dm-time">' + esc(dmTime(m.created_at)) + '</span></div>';
        const confirm = pending
            ? '<div class="dm-confirm">Delete?' +
              '<button class="dm-confirm-yes" data-cyes="' + esc(m.id) + '">Delete</button>' +
              '<button class="dm-confirm-no" data-cno="' + esc(m.id) + '">Cancel</button></div>'
            : '';
        const del = (mine && !pending)
            ? '<button class="dm-del" data-del="' + esc(m.id) + '" title="Delete message" aria-label="Delete message">&times;</button>'
            : '';
        return '<div class="dm-msg' + (mine ? ' dm-mine' : '') + (cont ? ' dm-cont' : '') + '" data-id="' + esc(m.id) + '">' +
            avatar +
            '<div class="dm-bubble">' + meta + '<div class="dm-text">' + esc(m.body) + '</div>' + confirm + '</div>' +
            del + '</div>';
    }

    function renderThread() {
        const box = document.getElementById('dmMessages');
        if (!box || active == null) return;
        const msgs = threadCache[active] || [];
        if (!msgs.length) {
            box.innerHTML = '<div class="dm-thread-empty">No messages yet. Say hi!</div>';
            return;
        }
        const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 50;
        const prevTop = box.scrollTop;
        let html = '';
        for (let i = 0; i < msgs.length; i++) {
            const m = msgs[i], prev = msgs[i - 1];
            const cont = !!prev && prev.sender_id === m.sender_id &&
                (new Date(m.created_at) - new Date(prev.created_at)) <= GROUP_GAP_MS;
            html += threadRowHtml(m, cont);
        }
        box.innerHTML = html;
        box.querySelectorAll('.dm-del[data-del]').forEach(btn =>
            btn.addEventListener('click', () => { pendingDelete = btn.getAttribute('data-del'); renderThread(); }));
        box.querySelectorAll('[data-cyes]').forEach(btn =>
            btn.addEventListener('click', () => deleteDm(btn.getAttribute('data-cyes'))));
        box.querySelectorAll('[data-cno]').forEach(btn =>
            btn.addEventListener('click', () => { pendingDelete = null; renderThread(); }));
        box.scrollTop = atBottom ? box.scrollHeight : prevTop;
    }

    async function openThread(otherId) {
        active = otherId;
        pendingDelete = null;
        window.__activeDmThread = otherId;
        document.getElementById('dmList').hidden = true;
        document.getElementById('dmThread').hidden = false;
        document.getElementById('dmBack').hidden = false;
        document.getElementById('dmTitle').textContent = prof(otherId).username || 'User';
        document.getElementById('dmMessages').innerHTML = '<div class="dm-thread-empty">Loading…</div>';
        if (!threadCache[otherId]) await loadThread(otherId);
        renderThread();
        const box = document.getElementById('dmMessages');
        if (box) box.scrollTop = box.scrollHeight;
        markRead(otherId);
        const inp = document.getElementById('dmInput');
        if (inp) inp.focus();
    }

    function backToList() {
        active = null;
        window.__activeDmThread = null;
        document.getElementById('dmThread').hidden = true;
        document.getElementById('dmList').hidden = false;
        document.getElementById('dmBack').hidden = true;
        document.getElementById('dmTitle').textContent = 'Messages';
        renderList();
        updateBadge();
    }

    async function sendDm(e) {
        e.preventDefault();
        if (active == null) return;
        const inp = document.getElementById('dmInput');
        const body = (inp.value || '').trim();
        if (!body) return;
        inp.value = '';
        inp.disabled = true;
        const other = active;
        try {
            const { data, error } = await supabaseClient.rpc('send_direct_message', { p_recipient: other, p_body: body });
            if (error) {
                if (window.showNotification) showNotification('Messages', error.message || 'Could not send', 'error');
                inp.value = body;
            } else if (data) {
                ingest(data);
                markRead(other);
            }
        } catch (err) {
            if (window.showNotification) showNotification('Messages', 'Could not send message', 'error');
            inp.value = body;
        }
        inp.disabled = false;
        inp.focus();
    }

    async function deleteDm(id) {
        pendingDelete = null;
        try {
            const { error } = await supabaseClient.rpc('delete_direct_message', { p_message_id: id });
            if (error) {
                if (window.showNotification) showNotification('Messages', error.message || 'Could not delete', 'error');
                renderThread();
                return;
            }
            removeMessage(id);
        } catch (e) {
            if (window.showNotification) showNotification('Messages', 'Could not delete message', 'error');
            renderThread();
        }
    }

    // Add a message to caches + UI (used by own sends and realtime inserts).
    function ingest(m) {
        const other = m.sender_id === me ? m.recipient_id : m.sender_id;
        if (threadIds[other] && threadIds[other].has(m.id)) return;
        if (threadCache[other]) {
            threadCache[other].push(m);
            threadIds[other].add(m.id);
        }
        if (!convoMeta[other]) convoMeta[other] = { lastMsg: null, unread: 0 };
        convoMeta[other].lastMsg = m;
        if (active === other) {
            renderThread();
            const box = document.getElementById('dmMessages');
            if (box) box.scrollTop = box.scrollHeight;
        } else if (m.sender_id !== me) {
            convoMeta[other].unread++;
        }
        if (active == null) renderList();
        updateBadge();
    }

    function removeMessage(id) {
        for (const other in threadCache) {
            const arr = threadCache[other];
            const idx = arr.findIndex(x => x.id === id);
            if (idx !== -1) {
                arr.splice(idx, 1);
                if (threadIds[other]) threadIds[other].delete(id);
                if (convoMeta[other]) convoMeta[other].lastMsg = arr.length ? arr[arr.length - 1] : null;
                if (active === other) renderThread();
            }
        }
        if (active == null) renderList();
        updateBadge();
    }

    function updateBadge() {
        const badge = document.getElementById('dmBadge');
        if (!badge) return;
        let total = 0;
        for (const id in convoMeta) {
            if (open && active === id) continue;        // currently reading this thread
            total += convoMeta[id].unread || 0;
        }
        if (total > 0) { badge.textContent = total > 9 ? '9+' : String(total); badge.style.display = 'flex'; }
        else { badge.style.display = 'none'; }
    }

    async function markRead(otherId) {
        if (convoMeta[otherId]) convoMeta[otherId].unread = 0;
        readMap[otherId] = new Date();
        updateBadge();
        if (active == null) renderList();
        try { await supabaseClient.rpc('mark_dm_read', { p_other: otherId }); } catch (e) {}
    }

    // ---------- open / close ----------
    function openPanel() {
        const panel = document.getElementById('dmPanel');
        if (!panel) return;
        panel.hidden = false;
        open = true;
        backToList();
        loadData();
    }
    function closePanel() {
        const panel = document.getElementById('dmPanel');
        if (panel) panel.hidden = true;
        open = false;
        active = null;
        window.__activeDmThread = null;
        updateBadge();
    }
    function togglePanel() { open ? closePanel() : openPanel(); }

    // Entry point for clicking a dm notification in the bell (notifications.js).
    window.openDirectMessageThread = function (fromId) {
        if (!fromId) return;
        const panel = document.getElementById('dmPanel');
        if (!panel) return;
        panel.hidden = false;
        open = true;
        // Ensure profile/data is present, then open the thread.
        if (profileMap[fromId]) { openThread(fromId); }
        else { loadData().then(() => openThread(fromId)); }
    };

    // ---------- realtime ----------
    function subscribe() {
        try {
            channel = supabaseClient
                .channel('dm-' + me)
                .on('postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: 'recipient_id=eq.' + me },
                    async function (payload) {
                        const m = payload.new;
                        if (!profileMap[m.sender_id]) {
                            const { data } = await supabaseClient.from('profiles').select('id,username,avatar_url').eq('id', m.sender_id).maybeSingle();
                            if (data) profileMap[m.sender_id] = data;
                        }
                        ingest(m);
                        if (open && active === m.sender_id && document.hasFocus()) markRead(m.sender_id);
                    })
                .on('postgres_changes',
                    { event: 'DELETE', schema: 'public', table: 'direct_messages' },
                    function (payload) {
                        const gone = payload.old && payload.old.id;
                        if (gone) removeMessage(gone);
                    })
                .subscribe();
        } catch (e) { console.warn('dm realtime failed:', e); }
    }

    // ---------- init ----------
    async function init() {
        try {
            if (!window.supabaseClient) return;
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) return;                       // signed out -> no messenger
            if (document.getElementById('directMessages')) return;
            me = user.id;
            injectStyles();
            buildDom();
            await loadData();
            subscribe();
            // Deep link: /dashboard.html#dm=<friendId> (from a dm notification click on another page).
            const hash = window.location.hash || '';
            const mt = hash.match(/[#&]dm=([0-9a-f-]+)/i);
            if (mt) window.openDirectMessageThread(mt[1]);
        } catch (e) { console.warn('dm init failed:', e); }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
