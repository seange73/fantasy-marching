-- One-time cleanup: make the site World Class scored events only.
--
-- Run this in the Supabase SQL Editor with a privileged role. It removes:
-- - all unscored events
-- - any event with no remaining DCI World Class corps/results
-- - Open Class, All Age, DCA, and other non-World-Class corps from scores,
--   rosters, draft picks, rankings, predictions, final_scores, and archives

begin;

create temp table wc_corps(name text primary key);
insert into wc_corps(name) values
  ('Blue Devils'),
  ('Blue Knights'),
  ('Blue Stars'),
  ('Bluecoats'),
  ('Boston Crusaders'),
  ('Carolina Crown'),
  ('Colts'),
  ('Crossmen'),
  ('Genesis'),
  ('Madison Scouts'),
  ('Mandarins'),
  ('Music City'),
  ('Pacific Crest'),
  ('Phantom Regiment'),
  ('Santa Clara Vanguard'),
  ('Seattle Cascades'),
  ('Spartans'),
  ('Spirit of Atlanta'),
  ('The Academy'),
  ('The Cavaliers'),
  ('Troopers');

-- Delete predictions/results tied to events that are unscored or no longer usable.
create temp table doomed_events as
select e.id
from events e
where coalesce(e.is_completed, false) = false
   or coalesce(jsonb_array_length(e.final_scores), 0) = 0
   or not exists (
        select 1
        from event_scores s
        join wc_corps wc on wc.name = s.corps_name
        where s.event_id = e.id
          and coalesce(s.total_score, 0) > 0
      );

delete from prediction_results pr
using predictions p, doomed_events d
where pr.prediction_id = p.id
  and p.event_id = d.id;

delete from predictions p
using doomed_events d
where p.event_id = d.id;

delete from event_scores s
using doomed_events d
where s.event_id = d.id;

delete from league_matchups m
using doomed_events d
where m.event_id = d.id;

delete from events e
using doomed_events d
where e.id = d.id;

-- Remove non-World-Class score rows everywhere.
delete from event_scores s
where not exists (select 1 from wc_corps wc where wc.name = s.corps_name);

delete from archived_event_scores s
where not exists (select 1 from wc_corps wc where wc.name = s.corps_name);

-- Keep only World Class corps in event corps_list arrays.
update events e
set corps_list = coalesce((
  select array_agg(c order by ord)
  from unnest(e.corps_list) with ordinality as u(c, ord)
  join wc_corps wc on wc.name = u.c
), array[]::text[])
where e.corps_list is not null;

update archived_events e
set corps_list = coalesce((
  select array_agg(c order by ord)
  from unnest(e.corps_list) with ordinality as u(c, ord)
  join wc_corps wc on wc.name = u.c
), array[]::text[])
where e.corps_list is not null;

-- Keep only World Class final_scores and re-number placements.
update events e
set final_scores = coalesce((
  select jsonb_agg(
    jsonb_set(item, '{placement}', to_jsonb(rn), true)
    order by rn
  )
  from (
    select item, row_number() over (
      order by coalesce((item->>'score')::numeric, (item->>'total_score')::numeric, 0) desc
    ) as rn
    from jsonb_array_elements(coalesce(e.final_scores, '[]'::jsonb)) item
    join wc_corps wc on wc.name = item->>'corps_name'
  ) kept
), '[]'::jsonb)
where e.final_scores is not null;

update archived_events e
set final_scores = coalesce((
  select jsonb_agg(
    jsonb_set(item, '{placement}', to_jsonb(rn), true)
    order by rn
  )
  from (
    select item, row_number() over (
      order by coalesce((item->>'score')::numeric, (item->>'total_score')::numeric, 0) desc
    ) as rn
    from jsonb_array_elements(coalesce(e.final_scores, '[]'::jsonb)) item
    join wc_corps wc on wc.name = item->>'corps_name'
  ) kept
), '[]'::jsonb)
where e.final_scores is not null;

-- Null out caption winners that point at a non-World-Class corps.
update events e
set caption_winners = jsonb_strip_nulls(jsonb_build_object(
  'brass', case when exists (select 1 from wc_corps wc where wc.name = e.caption_winners->>'brass') then e.caption_winners->>'brass' end,
  'percussion', case when exists (select 1 from wc_corps wc where wc.name = e.caption_winners->>'percussion') then e.caption_winners->>'percussion' end,
  'color_guard', case when exists (select 1 from wc_corps wc where wc.name = e.caption_winners->>'color_guard') then e.caption_winners->>'color_guard' end
))
where e.caption_winners is not null;

update archived_events e
set caption_winners = jsonb_strip_nulls(jsonb_build_object(
  'brass', case when exists (select 1 from wc_corps wc where wc.name = e.caption_winners->>'brass') then e.caption_winners->>'brass' end,
  'percussion', case when exists (select 1 from wc_corps wc where wc.name = e.caption_winners->>'percussion') then e.caption_winners->>'percussion' end,
  'color_guard', case when exists (select 1 from wc_corps wc where wc.name = e.caption_winners->>'color_guard') then e.caption_winners->>'color_guard' end
))
where e.caption_winners is not null;

-- Remove non-World-Class corps from game-owned tables.
delete from caption_rankings_2024 r
where not exists (select 1 from wc_corps wc where wc.name = r.corps_name);

delete from draft_picks p
where not exists (select 1 from wc_corps wc where wc.name = p.corps_name);

delete from league_team_roster r
where not exists (select 1 from wc_corps wc where wc.name = r.corps_name);

delete from global_league_roster r
where not exists (select 1 from wc_corps wc where wc.name = r.corps_name);

-- Remove non-World-Class names from user predictions that remain attached to kept events.
update predictions p
set score_predictions = coalesce((
  select jsonb_object_agg(key, value)
  from jsonb_each(coalesce(p.score_predictions, '{}'::jsonb))
  join wc_corps wc on wc.name = key
), '{}'::jsonb)
where p.score_predictions is not null;

update predictions p
set caption_predictions = jsonb_strip_nulls(jsonb_build_object(
  'brass', case when exists (select 1 from wc_corps wc where wc.name = p.caption_predictions->>'brass') then p.caption_predictions->>'brass' end,
  'percussion', case when exists (select 1 from wc_corps wc where wc.name = p.caption_predictions->>'percussion') then p.caption_predictions->>'percussion' end,
  'guard', case when exists (select 1 from wc_corps wc where wc.name = p.caption_predictions->>'guard') then p.caption_predictions->>'guard' end,
  'color_guard', case when exists (select 1 from wc_corps wc where wc.name = p.caption_predictions->>'color_guard') then p.caption_predictions->>'color_guard' end
))
where p.caption_predictions is not null;

-- After filtering, delete any event/archive row that no longer has World Class scored results.
create temp table empty_events as
select e.id
from events e
where coalesce(jsonb_array_length(e.final_scores), 0) = 0
   or not exists (select 1 from event_scores s where s.event_id = e.id);

delete from prediction_results pr
using predictions p, empty_events d
where pr.prediction_id = p.id
  and p.event_id = d.id;

delete from predictions p
using empty_events d
where p.event_id = d.id;

delete from event_scores s
using empty_events d
where s.event_id = d.id;

delete from league_matchups m
using empty_events d
where m.event_id = d.id;

delete from events e
using empty_events d
where e.id = d.id;

delete from archived_events e
where coalesce(jsonb_array_length(e.final_scores), 0) = 0;

commit;
