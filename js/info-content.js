// Central registry of contextual help snippets. Single source of truth: both the
// in-page info popovers (js/info-tips.js) and the slim Information glossary
// (information.html) render from this, so the wording can never drift between them.
//
// Each topic: { title, html }. The html is authored, trusted content (no user input),
// so it is injected as-is. Keep entries concise — they render in a small popover.
window.INFO_TOPICS = {
  'predictions-scoring': {
    title: 'Predictions Scoring',
    html: `
      <p>Every prediction earns two numbers: a <strong>total points</strong> score (your leaderboard rank) and an <strong>accuracy</strong> percentage.</p>
      <p><strong>Points</strong></p>
      <ul>
        <li>20 for a correct placement, 10 for one place off, 5 for two off</li>
        <li>5 for each correct caption-award pick</li>
        <li>Closeness bonus on each corps' raw score — within 0.5: <strong>+1</strong>, within 0.25: <strong>+2</strong>, within 0.1: <strong>+3</strong></li>
      </ul>
      <p><strong>Accuracy</strong> counts only the skill calls — placements and caption winners. Nail every one and you read 100%, even if your raw-score guesses aren't exact. The closeness bonus adds points but never moves your accuracy.</p>`
  },
  'starting-league': {
    title: 'Starting a League',
    html: `
      <p>From the League tab, choose <strong>Create a League</strong>. Make it <strong>public</strong> (listed for anyone to find and join) or <strong>private</strong> (joinable only with the invite code).</p>
      <p>Share your league's <strong>invite code</strong> to bring friends in. As owner you can require approval for new members and regenerate the code at any time from the league's settings.</p>
      <p>Leagues run with an even number of players — 2, 4, 6, 8, or 10.</p>`
  },
  'draft-rules': {
    title: 'How the Draft Works',
    html: `
      <p>The league owner can start the draft right away or schedule it for later. A scheduled time is flexible and can be changed.</p>
      <p>Everyone is given a random draft slot, and the draft <strong>snakes</strong>: pick order runs 1 to last, then reverses last to 1, back and forth, until every lineup holds 11 corps across the captions.</p>
      <p>You have a set time on each pick. If it runs out, the best available corps in a random unfilled caption is auto-picked for you.</p>`
  },
  'lineup-captions': {
    title: 'Your Lineup',
    html: `
      <p>There are six captions — three <strong>major</strong> (Brass, Percussion, Color Guard) and three <strong>minor</strong> (General Effect, Visual, Music).</p>
      <p>Your active lineup starts <strong>two</strong> corps in each major caption and <strong>one</strong> in each minor — nine corps in all. The rest sit on your bench.</p>`
  },
  'weekly-matchup': {
    title: 'Weekly Matchups',
    html: `
      <p>Each week you're matched against another player in your league. Your active lineup scores all week, and whoever has more points once Saturday night's competitions finish wins the matchup.</p>
      <p>You can swap a benched corps into your lineup mid-week, as long as a corps in that caption slot hasn't competed yet that week.</p>
      <p>At season's end the best win–loss record takes the league; ties break on total points scored across the season.</p>`
  },
  'league-scoring': {
    title: 'How Corps Are Scored',
    html: `
      <p>A corps that performs several times in a week is scored on the <strong>average</strong> of those shows. Each caption is pulled from the official DCI sheets:</p>
      <ul>
        <li><strong>Brass</strong> — brass column, Music tab</li>
        <li><strong>Percussion</strong> — percussion column, Percussion tab</li>
        <li><strong>Color Guard</strong> — color guard column, Visual tab</li>
        <li><strong>General Effect</strong> — averaged GE column</li>
        <li><strong>Visual</strong> — average of proficiency and analysis, Visual tab</li>
        <li><strong>Music</strong> — Music Analysis (averaged if multiple judges)</li>
      </ul>`
  },
  'trades': {
    title: 'Trading',
    html: `
      <p>Open a teammate's roster with <strong>View Lineup</strong> and hit <strong>Request Trade</strong> on the corps you want, offering one of your own corps in the <strong>same caption</strong>. Trades are one-for-one within a caption.</p>
      <p>The other player gets your request in their notifications and can accept or decline. You can revoke a pending request any time.</p>
      <p>If either lineup changes so the trade no longer fits, it simply won't go through.</p>`
  },
  'free-agents': {
    title: 'Free Agents',
    html: `
      <p>Any corps not drafted stays a free agent. In the <strong>Free Agents</strong> tab, drop a corps from your roster to pick one up.</p>
      <p>You get one free-agent move per week, and pickups happen on <strong>Mondays</strong>.</p>`
  },
  'global-league': {
    title: 'Global League',
    html: `
      <p>Build your dream lineup with any corps you like — one set for the whole season, no draft required.</p>
      <p>You're ranked on the Global League leaderboard by weekly average and total score. Scoring works exactly like a regular league.</p>`
  }
};
