// Central registry of contextual help snippets. Single source of truth: both the
// in-page info popovers (js/info-tips.js) and the slim Information glossary
// (information.html) render from this, so the wording can never drift between them.
//
// Each topic is { title, html }. The html is authored, trusted content (no user
// input), so it is injected as-is. Keep entries short; they show in a small popover.
window.INFO_TOPICS = {
  'predictions-scoring': {
    title: 'Predictions Scoring',
    html: `
      <p>Every prediction gives you a <strong>total points</strong> score for the leaderboard and an <strong>accuracy</strong> percentage.</p>
      <p><strong>Points</strong></p>
      <ul>
        <li>20 for a correct placement, 10 if you're one place off, 5 if you're two off</li>
        <li>5 for each caption award you call right</li>
        <li>A bonus for how close your raw score is. Within 0.5 earns 1, within 0.25 earns 2, within 0.1 earns 3</li>
      </ul>
      <p>Accuracy only looks at placements and caption winners, so you can still hit 100% even if your raw scores aren't exact. The closeness bonus adds points but doesn't affect accuracy.</p>`
  },
  'starting-league': {
    title: 'Starting a League',
    html: `
      <p>From the League tab, choose <strong>Create a League</strong>. You can make it <strong>public</strong> so anyone can find and join it, or <strong>private</strong> so people need the invite code to get in.</p>
      <p>Share your league's <strong>invite code</strong> to bring friends in. As the owner you can require approval for new members and regenerate the code whenever you want from the league's settings.</p>
      <p>Leagues need an even number of players, so 2, 4, 6, 8, or 10.</p>`
  },
  'draft-rules': {
    title: 'How the Draft Works',
    html: `
      <p>The league owner can start the draft right away or schedule it for later. A scheduled time isn't set in stone and can be changed.</p>
      <p>Everyone gets a random draft slot. The draft snakes, so the order runs first to last, then flips and runs last to first, back and forth until every lineup has 11 corps across the captions.</p>
      <p>You get a set amount of time on each pick. If it runs out, the best available corps in a random open caption is picked for you.</p>`
  },
  'lineup-captions': {
    title: 'Your Lineup',
    html: `
      <p>There are six captions. Three are major (Brass, Percussion, Color Guard) and three are minor (General Effect, Visual, Music).</p>
      <p>Your active lineup holds two corps in each major caption and one in each minor, which comes out to nine corps. Anyone else you've drafted sits on your bench.</p>`
  },
  'weekly-matchup': {
    title: 'Weekly Matchups',
    html: `
      <p>Each week you go head to head with another player in your league. Your active lineup scores all week, and whoever has more points after Saturday night's competitions wins.</p>
      <p>You can swap a benched corps into your lineup during the week, as long as a corps in that slot hasn't competed yet that week.</p>
      <p>When the season ends, the best win-loss record wins the league. If two players tie, it comes down to who scored more points overall.</p>`
  },
  'league-scoring': {
    title: 'How Corps Are Scored',
    html: `
      <p>If a corps performs more than once in a week, we average those shows for its weekly score. Each caption comes straight off the official DCI sheets.</p>
      <ul>
        <li><strong>Brass</strong> is the brass column on the Music tab</li>
        <li><strong>Percussion</strong> is the percussion column on the Percussion tab</li>
        <li><strong>Color Guard</strong> is the color guard column on the Visual tab</li>
        <li><strong>General Effect</strong> is the averaged GE column</li>
        <li><strong>Visual</strong> is the average of the proficiency and analysis scores on the Visual tab</li>
        <li><strong>Music</strong> is the Music Analysis score, averaged if there's more than one judge</li>
      </ul>`
  },
  'trades': {
    title: 'Trading',
    html: `
      <p>Open another player's roster with <strong>View Lineup</strong> and hit <strong>Request Trade</strong> on a corps you want, then offer one of yours in the <strong>same caption</strong>. Every trade is one corps for one corps within a caption.</p>
      <p>Your request shows up in the other player's notifications, and they can accept or decline it. You can take back a pending request any time.</p>
      <p>If either lineup changes and the trade no longer works, it won't go through.</p>`
  },
  'free-agents': {
    title: 'Free Agents',
    html: `
      <p>Any corps that didn't get drafted is a free agent. Head to the <strong>Free Agents</strong> tab, drop a corps from your roster, and pick one up in its place.</p>
      <p>You get one free-agent move a week, and you can only make it on a <strong>Monday</strong>.</p>`
  },
  'global-league': {
    title: 'Global League',
    html: `
      <p>Pick any corps you want and build your dream lineup. It's one lineup for the whole season, with no draft involved.</p>
      <p>You're ranked on the Global League leaderboard by weekly average and total score. The scoring is the same as a regular league.</p>`
  }
};
