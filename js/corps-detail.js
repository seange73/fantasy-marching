// Shared corps-detail popup. Loaded on every page by js/supabase.js.
// Click any element with a data-corps-info="<Corps Name>" attribute to open it
// (or call window.showCorpsDetail(name) directly).
// Season-aware: shows the most recent season that has scores, so during the
// preseason (no current-year scores yet) it falls back to last year's stats --
// which is exactly the scouting data you want on the draft page.
(function () {
    if (window.__corpsDetailLoaded) return;
    window.__corpsDetailLoaded = true;

    const esc = window.escapeHtml || function (s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    };

    const CAPTIONS = [
        ['brass_score', 'Brass'], ['percussion_score', 'Percussion'], ['color_guard_score', 'Color Guard'],
        ['general_effect_score', 'General Effect'], ['visual_score', 'Visual'], ['music_score', 'Music']
    ];

    let overlay, body, stylesInjected = false;

    function injectStyles() {
        if (stylesInjected) return;
        stylesInjected = true;
        const css = `
.corps-link { cursor: pointer; }
.corps-link:hover { color: var(--teal); text-decoration: underline dotted; }
.cd-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: none; align-items: center; justify-content: center; z-index: 1300; padding: 1rem; }
.cd-overlay.open { display: flex; }
.cd-modal { background: var(--s1); border: 1px solid var(--border); border-radius: 10px; width: 480px; max-width: 96vw; max-height: 88vh; overflow-y: auto; box-shadow: 0 16px 40px rgba(0,0,0,0.5); font-family: var(--body); }
.cd-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; padding: 1.1rem 1.25rem; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--s1); }
.cd-name { font-size: 1.15rem; font-weight: 800; color: var(--text); }
.cd-season { font-size: 0.72rem; color: var(--text-3); margin-top: 0.2rem; }
.cd-close { background: transparent; border: none; color: var(--text-2); font-size: 1.4rem; line-height: 1; cursor: pointer; padding: 0 0.2rem; }
.cd-close:hover { color: var(--text); }
.cd-section { padding: 1rem 1.25rem; border-bottom: 1px solid var(--border); }
.cd-section:last-child { border-bottom: none; }
.cd-section h3 { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-3); margin: 0 0 0.7rem; }
.cd-avg-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; }
.cd-stat { background: var(--s2); border: 1px solid var(--border); border-radius: 7px; padding: 0.55rem; text-align: center; }
.cd-stat .lbl { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-3); }
.cd-stat .val { font-size: 1.05rem; font-weight: 700; color: var(--text); font-family: var(--mono, monospace); margin-top: 0.15rem; }
.cd-total { margin-top: 0.6rem; display: flex; align-items: baseline; justify-content: space-between; background: var(--teal-bg); border: 1px solid var(--teal-dim); border-radius: 7px; padding: 0.6rem 0.85rem; }
.cd-total .lbl { font-size: 0.74rem; color: var(--text-2); font-weight: 600; }
.cd-total .val { font-size: 1.25rem; font-weight: 800; color: var(--teal); font-family: var(--mono, monospace); }
.cd-list { display: flex; flex-direction: column; gap: 0.35rem; }
.cd-row { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; background: var(--s2); border: 1px solid var(--border); border-radius: 6px; padding: 0.5rem 0.7rem; }
.cd-row .ev { min-width: 0; }
.cd-row .en { font-size: 0.82rem; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cd-row .ed { font-size: 0.68rem; color: var(--text-3); margin-top: 0.1rem; }
.cd-row .es { font-size: 0.95rem; font-weight: 700; color: var(--text); font-family: var(--mono, monospace); flex-shrink: 0; }
.cd-empty { color: var(--text-2); font-size: 0.82rem; }
.cd-loading { padding: 2.5rem 1rem; text-align: center; color: var(--text-2); font-size: 0.85rem; }`;
        const tag = document.createElement('style');
        tag.textContent = css;
        document.head.appendChild(tag);
    }

    function ensureModal() {
        if (overlay) return;
        injectStyles();
        overlay = document.createElement('div');
        overlay.className = 'cd-overlay';
        overlay.innerHTML = '<div class="cd-modal" id="cdModal"></div>';
        document.body.appendChild(overlay);
        body = overlay.querySelector('#cdModal');
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    }

    function close() { if (overlay) overlay.classList.remove('open'); }

    function fmtDate(d) {
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return '';
        return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    function num(v, dp) { return (v == null || isNaN(v)) ? '--' : Number(v).toFixed(dp); }

    function weekBounds() {
        const now = new Date();
        const dow = (now.getDay() + 6) % 7;            // 0 = Monday
        const mon = new Date(now); mon.setDate(now.getDate() - dow);
        const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
        const fmt = d => d.toISOString().slice(0, 10);
        return [fmt(mon), fmt(sun)];
    }

    async function loadData(corpsName) {
        // Pull from both live and archived tables so retired seasons' history (e.g. 2025,
        // archived out of the live events tables) still shows for draft reference.
        const scoreCols = 'brass_score,percussion_score,color_guard_score,general_effect_score,visual_score,music_score,total_score,event_id';
        const [scLive, scArch] = await Promise.all([
            supabaseClient.from('event_scores').select(scoreCols).eq('corps_name', corpsName),
            supabaseClient.from('archived_event_scores').select(scoreCols).eq('corps_name', corpsName)
        ]);
        const scores = [...(scLive.data || []), ...(scArch.data || [])];
        const ids = [...new Set(scores.map(s => s.event_id).filter(Boolean))];
        let evById = {};
        if (ids.length) {
            const [evLive, evArch] = await Promise.all([
                supabaseClient.from('events').select('id,name,date,location').in('id', ids),
                supabaseClient.from('archived_events').select('id,name,date,location').in('id', ids)
            ]);
            [...(evLive.data || []), ...(evArch.data || [])].forEach(e => { evById[e.id] = e; });
        }
        const rows = scores.map(s => ({ s, e: evById[s.event_id] })).filter(r => r.e && r.e.date);

        let season = null, avg = {}, totalAvg = null, recent = [], count = 0;
        if (rows.length) {
            season = Math.max(...rows.map(r => new Date(r.e.date).getFullYear()));
            const sr = rows.filter(r => new Date(r.e.date).getFullYear() === season);
            count = sr.length;
            CAPTIONS.forEach(([k]) => {
                const v = sr.map(r => r.s[k]).filter(x => x != null).map(Number);
                avg[k] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
            });
            const tv = sr.map(r => r.s.total_score).filter(x => x != null).map(Number);
            totalAvg = tv.length ? tv.reduce((a, b) => a + b, 0) / tv.length : null;
            recent = sr.slice().sort((a, b) => new Date(b.e.date) - new Date(a.e.date));
        }

        const [ws, we] = weekBounds();
        let thisWeek = [];
        try {
            const wk = await supabaseClient.from('events')
                .select('id,name,date,location')
                .contains('corps_list', [corpsName])
                .gte('date', ws).lte('date', we)
                .order('date', { ascending: true });
            thisWeek = wk.data || [];
        } catch (e) { /* corps_list may be absent on some rows */ }

        return { season, avg, totalAvg, recent, count, thisWeek };
    }

    function render(corpsName, d) {
        const curYear = new Date().getFullYear();
        const seasonNote = (d.season && d.season < curYear)
            ? `${d.season} season — current season hasn't started yet`
            : (d.season ? `${d.season} season` : 'No scores on record');

        let html =
            '<div class="cd-head"><div><div class="cd-name">' + esc(corpsName) + '</div>' +
            '<div class="cd-season">' + esc(seasonNote) + (d.count ? ' · ' + d.count + ' shows' : '') + '</div></div>' +
            '<button class="cd-close" id="cdClose" aria-label="Close">&times;</button></div>';

        if (!d.season) {
            html += '<div class="cd-section"><div class="cd-empty">No scores recorded for this corps yet.</div></div>';
        } else {
            // averages
            html += '<div class="cd-section"><h3>Season averages by caption</h3><div class="cd-avg-grid">' +
                CAPTIONS.map(([k, label]) =>
                    '<div class="cd-stat"><div class="lbl">' + esc(label) + '</div><div class="val">' + num(d.avg[k], 2) + '</div></div>'
                ).join('') +
                '</div><div class="cd-total"><span class="lbl">Average total</span><span class="val">' + num(d.totalAvg, 3) + '</span></div></div>';

            // recent results
            html += '<div class="cd-section"><h3>Recent results</h3><div class="cd-list">' +
                (d.recent.length ? d.recent.slice(0, 10).map(r =>
                    '<div class="cd-row"><div class="ev"><div class="en">' + esc(r.e.name || 'Event') + '</div>' +
                    '<div class="ed">' + esc(fmtDate(r.e.date)) + (r.e.location ? ' · ' + esc(r.e.location) : '') + '</div></div>' +
                    '<div class="es">' + num(r.s.total_score, 3) + '</div></div>'
                ).join('') : '<div class="cd-empty">No results.</div>') +
                '</div></div>';
        }

        // this week
        html += '<div class="cd-section"><h3>Competitions this week</h3><div class="cd-list">' +
            (d.thisWeek.length ? d.thisWeek.map(e =>
                '<div class="cd-row"><div class="ev"><div class="en">' + esc(e.name || 'Event') + '</div>' +
                '<div class="ed">' + esc(fmtDate(e.date)) + (e.location ? ' · ' + esc(e.location) : '') + '</div></div></div>'
            ).join('') : '<div class="cd-empty">No competitions scheduled this week.</div>') +
            '</div></div>';

        body.innerHTML = html;
        body.querySelector('#cdClose').addEventListener('click', close);
    }

    async function showCorpsDetail(corpsName) {
        if (!corpsName || !window.supabaseClient) return;
        ensureModal();
        body.innerHTML = '<div class="cd-head"><div class="cd-name">' + esc(corpsName) + '</div>' +
            '<button class="cd-close" id="cdClose" aria-label="Close">&times;</button></div>' +
            '<div class="cd-loading">Loading stats…</div>';
        body.querySelector('#cdClose').addEventListener('click', close);
        overlay.classList.add('open');
        try {
            const d = await loadData(corpsName);
            if (overlay.classList.contains('open')) render(corpsName, d);
        } catch (e) {
            console.warn('corps detail failed:', e);
            body.innerHTML += '<div class="cd-section"><div class="cd-empty">Could not load stats.</div></div>';
        }
    }

    // Delegated: any element with data-corps-info opens the popup.
    document.addEventListener('click', function (e) {
        const el = e.target.closest('[data-corps-info]');
        if (!el) return;
        e.preventDefault();
        e.stopPropagation();
        showCorpsDetail(el.getAttribute('data-corps-info'));
    });

    window.showCorpsDetail = showCorpsDetail;
    if (window.fantasyMarching) window.fantasyMarching.showCorpsDetail = showCorpsDetail;
})();
