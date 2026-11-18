/* "Catch me up": a plain-English season briefing at the top of every team page.
   Built from data the site already has: record and standing, the run of results, best win / worst loss, scoring,
   team leaders, the injury report, the next game with its line, and the current storylines from the news feed. */

const numWord = n => ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] || String(n);
const capFirst = s => s.charAt(0).toUpperCase() + s.slice(1);
const unitOf = t => (t.sport === 'baseball' ? 'runs' : 'points');

/** The arc of the season as a sentence. Short seasons get the whole story; long ones get the last ten. */
function briefRuns(res, finished) {
  if (!res.length) return '';
  const runs = []; res.forEach(r => { const l = runs[runs.length - 1]; if (l && l.r === r) l.n++; else runs.push({ r, n: 1 }); });
  const cur = runs[runs.length - 1], w = res.filter(r => r === 'W').length;
  const longest = r => Math.max(0, ...runs.filter(x => x.r === r).map(x => x.n));
  const verb = (r, n) => `${r === 'W' ? 'won' : 'lost'} ${numWord(n)}${n > 1 ? ' straight' : ''}`;
  const now = `${cur.r === 'W' ? 'have won' : 'have lost'} ${cur.n > 1 ? numWord(cur.n) + ' straight' : 'the last one'}`;
  if (finished) return `Longest winning streak: ${numWord(longest('W'))} games. Longest skid: ${numWord(longest('L'))}.`;
  if (res.length <= 20 && runs.length <= 6) return `${capFirst(verb(runs[0].r, runs[0].n))}${runs.length > 1 ? ', then ' + runs.slice(1).map(x => verb(x.r, x.n)).join(', then ') : ''}.`;
  if (res.length <= 20) return `${capFirst(numWord(w))} wins in ${numWord(res.length)} games, never more than ${numWord(Math.max(longest('W'), longest('L')))} straight either way; ${now}.`;
  const last = res.slice(-10), lw = last.filter(r => r === 'W').length;
  return `${lw}-${last.length - lw} over the last ten; ${now}.`;
}
/** "Home Runs" → "home runs", "Points / Game" → "points a game", but RBI / ERA stay as they are. */
const catTxt = c => c.replace(' / Game', ' a game').split(' ').map(w => (/^[A-Z0-9.()]+$/.test(w) && w.length <= 4 ? w : w.toLowerCase())).join(' ');
const lcFirst = s => s.charAt(0).toLowerCase() + s.slice(1);
const streakPhrase = res => { if (!res.length) return ''; let n = 0; const r = res[res.length - 1]; for (let i = res.length - 1; i >= 0 && res[i] === r; i--) n++; return n >= 2 ? `have ${r === 'W' ? 'won' : 'lost'} ${numWord(n)} straight` : `${r === 'W' ? 'won' : 'lost'} their last game`; };

const gameTxt = (t, g) => `${g.ourScore}-${g.oppScore} ${g.home ? 'vs' : 'at'} ${esc(g.opp.short || g.opp.name)} <span class="dim">(${esc(fmtDate(g.date, { month: 'short', day: 'numeric' }))})</span>`;
const LEAD_PICK = { football: ['Passing Yards', 'Rushing Yards', 'Receiving Yards', 'Sacks', 'Tackles', 'Interceptions'], basketball: ['Points / Game', 'Rebounds / Game', 'Assists / Game', '3-Pointers Made', 'Steals / Game'], baseball: ['Home Runs', 'Batting Avg', 'RBI', 'Wins', 'ERA', 'Strikeouts (P)'] };

async function renderBrief(t, el, alive) {
  const T = ms => p => timeout(p, ms);
  const [info, gs, pic, leaders, injr, news] = await Promise.all([
    T(8000)(safe(API.team(t), null)), T(8000)(safe(API.gameStatus(t), null)), T(8000)(safe(API.picture(t), null)),
    T(8000)(safe(t.league === 'nba' ? API.nbaTable().then(tb => API.leaders(t, tb.fallback ? tb.year : null)) : API.leaders(t), [])),
    T(8000)(safe(API.injuries(t), null)), T(8000)(safe(API.news(t, 14), [])),
  ]);
  if (!alive() || !el) return;
  const games = gs?.games || [], real = games.some(g => g.stype !== 1);
  const done = games.filter(g => g.state === 'post' && (g.stype !== 1 || !real) && g.ourScore != null);
  const reg = done.filter(g => g.stype !== 3), res = reg.map(g => g.result).filter(r => r === 'W' || r === 'L');
  const unit = unitOf(t), off = !!pic?.offseason, rec = info && (info.w + info.l + info.tie) > 0 ? info.summary : null;

  /* Lead sentence */
  let lead;
  if (off) {
    const r = pic.postseasonResult;
    lead = `The ${esc(t.nick)}' season is over. They went <b>${esc(rec || pic.sub.split(' ')[0])}</b> and ${r ? (r.won ? `won the ${esc(r.series.round)}` : `lost the ${esc(r.series.round)} to the ${esc(r.opp.name)} ${r.uw}-${r.ow}`) : 'missed the postseason'}.`;
  } else if (t.college) {
    const rk = (pic?.headline || '').match(/#(\d+) IN THE (CFP|AP|COACHES)/i), us = pic?.us;
    lead = `The Hoosiers are <b>${esc(rec || '0-0')}</b>${rk ? `, ranked <b>#${rk[1]}</b> in the ${rk[2] === 'CFP' ? 'College Football Playoff rankings' : rk[2] === 'AP' ? 'AP poll' : 'coaches poll'}` : ', unranked'}${us?.conf && us.conf !== '0-0' ? `, ${esc(us.conf)} in the ${esc(t.conf)} (${ord(us.divRank)})` : ''}${res.length ? `, and ${streakPhrase(res)}` : ''}.`;
  } else {
    lead = `The ${esc(t.nick)} are <b>${esc(rec || '0-0')}</b>${info?.standingSummary ? `, ${esc(info.standingSummary)}` : ''}${res.length ? `, and ${streakPhrase(res)}` : ''}.`;
  }
  const picLine = pic && !off && !t.college ? `<div class="brief-pic tone-${pic.tone}"><b>${esc(pic.headline)}</b>${pic.sub ? ` · ${esc(pic.sub)}` : ''} <a href="#/team/${t.key}/picture">Full picture ›</a></div>` : t.college && pic?.ranks?.length ? `<div class="brief-pic tone-${pic.tone}"><b>${esc(pic.headline)}</b> · ${esc(pic.sub)} <a href="#/team/${t.key}/picture">Rankings ›</a></div>` : '';

  /* How it's gone */
  const how = [];
  if (res.length) how.push(briefRuns(res, off));
  const wins = done.filter(g => g.result === 'W').sort((a, b) => (b.ourScore - b.oppScore) - (a.ourScore - a.oppScore)), losses = done.filter(g => g.result === 'L').sort((a, b) => (a.ourScore - a.oppScore) - (b.ourScore - b.oppScore));
  if (wins[0] || losses[0]) how.push([wins[0] ? `Best win: <a href="javascript:void(0)" data-game="${gameRef(t, wins[0])}">${gameTxt(t, wins[0])}</a>` : '', losses[0] ? `Worst loss: <a href="javascript:void(0)" data-game="${gameRef(t, losses[0])}">${gameTxt(t, losses[0])}</a>` : ''].filter(Boolean).join('. ') + '.');
  if (done.length >= 3) {
    const pf = sum(done, g => g.ourScore) / done.length, pa = sum(done, g => g.oppScore) / done.length, d = sum(done, g => g.ourScore - g.oppScore);
    const h = done.filter(g => g.home), a = done.filter(g => !g.home), rec2 = l => `${l.filter(g => g.result === 'W').length}-${l.filter(g => g.result === 'L').length}`;
    how.push(`Scoring ${pf.toFixed(1)} ${unit} a game and allowing ${pa.toFixed(1)} (${d > 0 ? '+' : ''}${d} overall). Home ${rec2(h)}, away ${rec2(a)}.`);
  }
  if (!t.college && H.seasons(t.key).length) { const ls = H.seasons(t.key).filter(s => s.year < new Date().getFullYear() || t.league === 'nba').slice(-1)[0]; if (ls) how.push(`Last season: ${H.record(t, ls)}, ${esc(lcFirst(H.outcome(ls)))}.`); }
  if (!done.length) how.push(`No games played yet${gs?.next ? ` — the opener is ${esc(fmtDay(gs.next.date))}` : ''}.`);

  /* Who's carrying them */
  const pick = LEAD_PICK[t.sport] || [], tops = pick.map(c => leaders.find(l => l.cat === c)).filter(Boolean).slice(0, 4);
  const who = tops.map(l => `<li>${l.id || l.mlbId ? `<a href="javascript:void(0)" data-player="${esc(l.id || l.mlbId)}" data-team="${t.key}" data-name="${esc(l.name)}"><b>${esc(l.name)}</b></a>` : `<b>${esc(l.name)}</b>`} <span class="muted">${esc(l.value)} ${esc(catTxt(l.cat))}</span></li>`).join('');

  /* Health */
  const inj = injr?.list || [], outs = inj.filter(x => x.group === 'out'), top3 = inj.slice(0, 3);
  const health = off ? '' : inj.length ? `${inj.length} on the injury report${outs.length ? `, ${outs.length} out or on IR` : ''}: ${top3.map(x => `<a href="javascript:void(0)" data-player="${esc(x.id || '')}" data-team="${t.key}" data-name="${esc(x.name)}">${esc(x.name)}</a> (${esc(x.status.toLowerCase())})`).join(', ')}${inj.length > 3 ? ` and ${inj.length - 3} more` : ''}. <a href="#/team/${t.key}/injuries">Full report ›</a>` : t.college ? 'No injury report is published for college teams.' : 'Nobody is listed as injured right now.';

  /* What's next */
  let next = '';
  const g = gs?.live || gs?.next;
  if (off) next = `Spring training opens in February. Until then the story is the roster: free agency, trades and extensions. The latest moves are listed under <b>Offseason moves</b> on this page, and the full feed is in <a href="#/team/${t.key}/news">News</a>.`;
  else if (g) {
    let proj = '';
    if (!t.mlbId) { const s = await T(6000)(safe(API.gameSummary('espn', t.league, g.id), null)); const p = s?.predict?.[String(t.espnId)]; if (p != null) { const pr = p.toFixed(0); proj = ` · ESPN gives them ${/^(8|11$|18$)/.test(pr) ? 'an' : 'a'} <b>${pr}%</b> chance`; } }
    if (!alive()) return;
    next = gs.live ? `<span class="badge live">Live</span> <b>${g.ourScore ?? 0}–${g.oppScore ?? 0}</b> ${g.home ? 'vs' : 'at'} ${esc(g.opp.name)}, ${esc(g.detail)}. ${watchLink(g.tv, 'Live on')} <a href="javascript:void(0)" data-game="${gameRef(t, g)}">Open the live game ›</a>`
      : `${g.home ? 'vs' : 'at'} <b>${rkTag(g.oppRank)}${esc(g.opp.name)}</b> · ${esc(whenTxt(g.date, g.tbd))}${g.tv ? ` on ${esc(g.tv)}` : ''} <span data-odds="${gameRef(t, g)}"></span>${proj}. <a href="javascript:void(0)" data-game="${gameRef(t, g)}">Preview ›</a>`;
  } else next = 'Nothing on the schedule right now.';

  el.innerHTML = `<div class="brief-head"><div><div class="brief-kicker">Catch me up</div><p class="brief-lead">${lead}</p>${picLine}</div></div>
    <div class="brief-cols">
      <div class="brief-main">
        <h4>How it's gone</h4><ul class="brief-list">${how.map(x => `<li>${x}</li>`).join('')}</ul>
        ${who ? `<h4>Who's carrying them</h4><ul class="brief-list people">${who}</ul>` : ''}
        ${health ? `<h4>Health</h4><p>${health}</p>` : ''}
        <h4>${gs?.live ? 'Right now' : off ? 'The offseason' : "What's next"}</h4><p>${next}</p>
      </div>
      <div class="brief-news" id="briefNews"></div>
    </div>`;
  overviewNews(t, $('#briefNews'), news, off ? 'Offseason moves' : 'Top news');
}
