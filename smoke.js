/*
  Tux's Take - offline smoke test.

  Runs the REAL index.html in headless Chromium with every ArcGIS request MOCKED,
  so it needs no network and no live service. Fails on any page error, renders
  every page, exercises presets / sorts / week selector / drawer / map, and
  measures horizontal overflow on a 390px phone.

      npm i playwright     (once)
      node smoke.js

  The FIXTURE deliberately includes the awkward cases: a game with no betting
  line, one with no excitement index, an overtime game, a neutral site, a game
  whose home team has no coordinates, a templated recap, and a null crowd.
*/
const { chromium } = require('playwright');
const path = require('path');

const BROWSER = process.env.PW_CHROME ||
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const PH = { n:-1, f:-1.0, r:-999.0, s:'N/A' };

function game(o){
  return Object.assign({
    game_id:1, season:2025, week:12, season_type:'regular', week_key:'2025-0-12',
    week_label:'Week 12', is_latest:1, start_date:Date.parse('2025-11-15T19:00:00Z'),
    home_id:100, away_id:200, home_team:'Home State', away_team:'Away Tech',
    home_conference:'Big Test', away_conference:'Test American',
    home_division:'FBS', away_division:'FBS',
    home_points:24, away_points:21, home_line_scores:'7^3^7^7', away_line_scores:'10^0^7^4',
    total_points:45, margin:3, winner_id:100, winner_team:'Home State',
    excitement_index:7.4, excitement_pctile:81, aftermath_index:74,
    index_why:'excitement 81, drama 91, swing 60', elo_swing:22.0,
    attendance:64000, capacity:70000, pct_capacity:91, venue:'Test Field',
    host_city:'Testville', host_state:'TS', neutral_site:0, conference_game:1,
    closing_spread:-3.5, over_under:47.5, line_provider:'consensus',
    cover_result:'Push', ou_result:'Under', home_rank:PH.n, away_rank:PH.n,
    upset:0, rivalry:0, road_miles:410.0,
    pass_leader:'Q Back^Home State^22/31, 260 YDS, 2 TD',
    rush_leader:'R Unner^Away Tech^18 CAR, 96 YDS',
    recv_leader:PH.s,
    home_logo_url:'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=',
    away_logo_url:PH.s, home_color:'#0021A5', away_color:'#000000',
    home_text_on:'#FFFFFF', away_text_on:'#FFFFFF', data_tier:'FBS',
    home_ml:-165, away_ml:140, ml_payout:60.6, fav_won:1, fav_covered:0,
    home_won:1, one_score:1, went_ot:0, ranked_matchup:0, comeback:1
  }, o);
}
const RESULTS = [
  game({ game_id:1 }),
  game({ game_id:2, home_team:'Ranked U', away_team:'Also Ranked', home_rank:4, away_rank:11,
         ranked_matchup:1, aftermath_index:88, margin:1, home_points:28, away_points:27,
         home_line_scores:'7^7^7^7', away_line_scores:'14^3^7^3', total_points:55,
         upset:1, rivalry:1, fav_won:0, fav_covered:0, ml_payout:210.0, home_id:101 }),
  /* no betting line at all - every market field is a placeholder */
  game({ game_id:3, home_team:'No Line State', away_team:'Nobody Booked', closing_spread:PH.r,
         over_under:PH.r, cover_result:'No line', ou_result:'No line', line_provider:PH.s,
         home_ml:PH.n, away_ml:PH.n, ml_payout:PH.f, fav_won:PH.n, fav_covered:PH.n,
         aftermath_index:41, home_id:102 }),
  /* no excitement index -> no grade, and the index runs on fewer components */
  game({ game_id:4, home_team:'Dark Data Tech', away_team:'Unmeasured A&M',
         excitement_index:PH.r, excitement_pctile:PH.n, aftermath_index:38,
         index_why:'drama 74, stakes 45 (4 of 7 components had data)', home_id:103 }),
  /* overtime: five periods */
  /* the only game in the fixture that actually SETTLES against the spread. Every
     other one is a Push or unpriced, so without this the conference ledger's ATS
     column was permanently a dash and the arithmetic went untested. */
  game({ game_id:5, home_team:'Overtime U', away_team:'Free Football St',
         home_line_scores:'7^7^7^7^6', away_line_scores:'7^7^7^7^0',
         home_points:34, away_points:28, total_points:62, margin:6, went_ot:1,
         cover_result:'Home covered', ou_result:'Over', fav_covered:1,
         aftermath_index:79, home_id:104 }),
  /* neutral site: capacity, city and travel deliberately blank. Also the first
     NON-CONFERENCE game in the fixture - the conference ledger's head-to-head board
     has nothing to compute without one, and every game used to be conference_game:1. */
  game({ game_id:6, home_team:'Neutral Home', away_team:'Neutral Away', neutral_site:1,
         capacity:PH.n, pct_capacity:PH.n, host_city:PH.s, host_state:PH.s,
         conference_game:0,
         road_miles:PH.f, aftermath_index:66, home_id:105 }),
  /* home team with no coordinates - must not break the map */
  game({ game_id:7, home_team:'Nowhere College', away_team:'Off Grid U', home_id:999,
         conference_game:0,
         aftermath_index:23, margin:35, home_points:45, away_points:10, one_score:0,
         comeback:0, total_points:55, home_line_scores:'14^14^10^7', away_line_scores:'3^0^7^0' }),
  /* previous week, so the week selector has something to switch to */
  game({ game_id:8, week:11, week_key:'2025-0-11', week_label:'Week 11', is_latest:0,
         home_team:'Last Week St', away_team:'Old News U', aftermath_index:52,
         attendance:PH.n, pct_capacity:PH.n, home_id:106 })
];
const RECAPS = RESULTS.map((g,i)=>({
  game_id:g.game_id, week_key:g.week_key, week_label:g.week_label, is_latest:g.is_latest,
  headline: i===2 ? 'NO LINE STATE 24, NOBODY BOOKED 21' : 'TEST HEADLINE FOR GAME '+g.game_id,
  recap_body: i===2
    ? 'No Line State beat Nobody Booked 24-21. The fourth quarter went 7-4. 64,000 in the building.'
    : 'AROOOOO. A recap body for game '+g.game_id+' that says some things about football and stops.',
  money_line: i===2 ? 'No Line State beat Nobody Booked 24-21.' : 'A quotable sentence for game '+g.game_id+'.',
  angle: ['nailbiter','upset','chalk','chalk','shootout','revenge','blowout','comeback'][i],
  tux_grade: g.excitement_pctile>0 ? 'A' : PH.s,
  voice_engine: i===2 ? 'template' : 'groq',
  voice_model: i===2 ? 'deterministic' : 'openai/gpt-oss-120b',
  style_version:'1.1', gen_status: i===2 ? 'template' : 'voiced',
  recap_generated: Date.parse('2026-08-27T05:00:00Z'), aftermath_index:g.aftermath_index
}));
/* Teams now carries name / conference / logo as well, because the Top 25 in poll mode
   has to name a team that is RANKED BUT HAS NO ARCHIVED GAME. Team 700 is exactly that
   case: it exists in Teams, it is ranked, and it never played. */
const TEAMS = [100,101,102,103,104,105,106,700].map((id,i)=>({
  team_id:id, latitude:33+i*1.6, longitude:-97+i*2.1,
  school: id===700 ? 'Bye Week Poly' : 'Team '+id,
  mascot:'Testers', conference: i%2 ? 'Big Test' : 'Test American',
  division:'FBS', logo_url:PH.s, primary_color:'#0021A5', text_color:'#FFFFFF' }));

/* Two poll snapshots so the movement arrows and the week picker both have something
   real to do: week 12 is the current one, week 11 is what it moved from. A poll ranks
   25 teams but the fixture only has eight, so the rest of the ranks are filled with
   ids that are in NEITHER Teams nor the archive - the ugliest case, and the board has
   to render it without a blank row or a crash. */
function pollRows(week, poll, order){
  return order.map((id, i) => ({
    season:2025, week, poll, rank:i+1, team_id:id,
    school: id===700 ? 'Bye Week Poly' : 'Team '+id,
    conference: i%2 ? 'Big Test' : 'Test American',
    points: 1500 - i*40, first_votes: i===0 ? 52 : 0 }));
}
/* 200 is the AWAY team in game 1 and it LOST, so the board has to show a loss as well
   as a win. It is also absent from the Teams fixture on purpose, which exercises the
   fall back to the name the poll row itself carries. 106 only played in week 11, so in
   a week-12 poll it is a ranked team with no game that week - a third distinct case. */
const ORDER_W12 = [101,100,700,104,105,102,103,200,106,801,802,803,804,805,806,807,
                   808,809,810,811,812,813,814,815,816];
const ORDER_W11 = [100,101,104,700,102,105,200,103,106,801,802,803,804,805,806,807,
                   808,809,810,811,812,813,814,815,816];
const RANKINGS = [].concat(
  pollRows(12,'AP Top 25', ORDER_W12),
  pollRows(11,'AP Top 25', ORDER_W11),
  pollRows(12,'Coaches Poll', ORDER_W12),
  pollRows(12,'AFCA Division III Coaches Poll', ORDER_W12)
);

(async () => {
  const browser = await chromium.launch({ executablePath: BROWSER });
  const page = await browser.newPage({ viewport:{ width:1280, height:900 } });
  const errors = [], consoleErrors = [];
  page.on('pageerror', e => errors.push((e.stack||String(e)).split('\n').slice(0,4).join(' >> ')));
  page.on('console', m => { if (m.type()==='error') consoleErrors.push(m.text()); });

  await page.route('**services.arcgisonline.com/**', r => r.abort());
  await page.route('**/query**', route => {
    const u = route.request().url();
    const body = route.request().postData() || '';
    const off = +((body.match(/resultOffset=(\d+)/) || [])[1] || 0);
    /* ORDER MATTERS. CFB_Atlas_Stats/FeatureServer/1 is Rankings and
       CFB_Atlas_Recaps/FeatureServer/1 is GameRecaps - the old router tested only the
       sublayer number, so the rankings query was answered with recap rows. Match the
       SERVICE first, the sublayer second. */
    let data = /CFB_Atlas_Stats/.test(u) ? RANKINGS
             : /CFB_Atlas_Teams/.test(u) ? TEAMS
             : /FeatureServer\/1\//.test(u) ? RECAPS : RESULTS;
    const slice = off === 0 ? data : [];
    route.fulfill({ contentType:'application/json', body: JSON.stringify({
      exceededTransferLimit:false, features: slice.map(a=>({ attributes:a })) })});
  });

  const ok = [], bad = [];
  const check = (cond, label) => (cond ? ok : bad).push(label);

  await page.goto('file://' + path.resolve(__dirname, 'index.html'));
  await page.waitForFunction("document.querySelector('#loadstate').textContent.indexOf('games recapped')>=0",
                             null, { timeout:15000 });
  const stamp = await page.textContent('#loadstate');
  check(/8 games recapped/.test(stamp), 'header stamp counts 8 games: ' + stamp.trim());
  check(/Week 12/.test(stamp), 'header names the latest week');

  const PAGES = ['home','aftermath','dig','yard','season','couch'];

  /* HEADER PARITY WITH ASK THE ATLAS. Those values are lifted from the published
     file; if someone tweaks this header in isolation the family stops matching. */
  const hdr = await page.evaluate(() => {
    const g = (s,k) => { const e = document.querySelector(s); return e ? getComputedStyle(e)[k] : null; };
    return {
      wrapPad:  g('.topwrap','padding'),
      wrapGap:  g('.topwrap','gap'),
      navGap:   g('nav.modes','gap'),
      btnPad:   g('nav.modes button','padding'),
      btnSize:  g('nav.modes button','fontSize'),
      btnRad:   g('nav.modes button','borderRadius'),
      t1:       g('.brand .t1','fontSize'),
      t2:       g('.brand .t2','fontSize'),
      mark:     g('.brand img','width'),
      stampIn:  !!document.querySelector('.topwrap .loadstate'),
      activeBg: (() => { const b = document.querySelector('nav.modes button[aria-selected="true"]');
                         return b ? getComputedStyle(b).backgroundColor : null; })()
    };
  });
  check(hdr.wrapPad === '10px 18px' && hdr.wrapGap === '18px', 'topwrap padding/gap match Ask the Atlas: ' + hdr.wrapPad + ' / ' + hdr.wrapGap);
  check(hdr.navGap === '4px' && hdr.btnPad === '8px 14px' && hdr.btnSize === '11px' && hdr.btnRad === '999px',
        'nav pills match Ask the Atlas: ' + [hdr.navGap,hdr.btnPad,hdr.btnSize,hdr.btnRad].join(' '));
  check(hdr.t1 === '15px' && hdr.t2 === '10px' && hdr.mark === '34px',
        'brand type and mark match: ' + [hdr.t1,hdr.t2,hdr.mark].join(' '));
  check(hdr.stampIn, 'the load stamp lives inside .topwrap and wraps, as it does on Ask the Atlas');
  check(/77,\s*195,\s*232/.test(hdr.activeBg || ''),
        'the selected tab is a SOLID accent pill, not an outline: ' + hdr.activeBg);
  check(await page.locator('nav.modes button em').count() === 4, 'the four Q prefixes are <em>, muted like Ask the Atlas');

  /* Shell geometry must match Ask the Atlas: same column, same footer rule. */
  const geo = await page.evaluate(() => {
    const g = s => { const e = document.querySelector(s); return e ? getComputedStyle(e).maxWidth : null; };
    return { main:g('main'), top:g('.topwrap'), foot:g('footer .fw') };
  });
  check(geo.main === '1560px' && geo.top === '1560px' && geo.foot === '1560px',
        'shell column is 1560px everywhere, like Ask the Atlas: ' + JSON.stringify(geo));

  /* home: the intro, the question cards and the three sibling apps */
  const hTxt = await page.textContent('#m-home');
  check(/The dog has notes/.test(hTxt), 'home leads with the intro, not a page question');
  check(/The dog is real/.test(hTxt), 'home states the fictional-analyst line up front');
  const qc = await page.locator('#m-home .qcard').count();
  check(qc === 4, 'home shows 4 question cards (got ' + qc + ')');
  const qstats = await page.locator('#m-home .qcard .qstat b').allTextContents();
  check(qstats.length === 4 && qstats.every(t=>/\d/.test(t)),
        'every question card carries a live number: ' + qstats.join(' / '));
  check(await page.locator('#m-home .sib').count() === 3, 'three sibling-app cards');
  const sibs = await page.locator('#m-home .sib h4').allTextContents();
  check(sibs[0].includes('Experience') && sibs[1].includes('Ask the Atlas') && sibs[2].includes('Tux'),
        'sibling order is Experience, Ask the Atlas, Tux: ' + sibs.join(' | '));
  check(await page.locator('#m-home .sib.youarehere h4').count() === 1, 'Tux card is flagged "you are here"');

  /* ---- the Top 25, POLL MODE (the default) ------------------------------
     Two boards share one grid, so both get tested: the poll first because that is
     what a first-time visitor sees, then Tux's own after switching the picker. */
  check(await page.locator('#top25').count() === 1, 'the Top 25 board is its own addressable card');
  const t25head = (await page.textContent('#top25 .qh')) || '';
  check(/The Top 25/.test(t25head) && /AP Top 25/.test(t25head),
        'the board opens on the AP poll: ' + t25head.replace(/\s+/g,' ').trim().slice(0,90));
  const pollOpts = await page.locator('#tp-poll option').allTextContents();
  /* the fixture publishes AP, Coaches and D3. The Coaches Poll is hidden on purpose -
     it is a near-duplicate of the AP for the same division - so three options remain. */
  check(pollOpts.length === 3, 'the picker offers one poll per division plus Tux (got ' + pollOpts.length + ')');
  check(!/Coaches Poll \(FBS\)/.test(pollOpts.join(' | ')),
        'the FBS Coaches Poll is not offered: ' + pollOpts.join(' | '));
  check(/Tux/.test(pollOpts[pollOpts.length-1] || ''),
        'Tux sorts last, after the real polls: ' + pollOpts.join(' | '));
  check(/Division III/.test(pollOpts.join(' ')), 'the D3 coaches poll is selectable');
  check(await page.locator('#tp-week option').count() === 2,
        'the week filter lists every snapshot that poll has published');
  const prows = await page.locator('#top25 .brow').count();
  check(prows === 25, 'a poll board is 25 rows even when the archive is shorter (got ' + prows + ')');
  /* the fixture ranks 17 teams that never played - those rows must render, not crash,
     and must say WHY there is nothing to open */
  check(await page.locator('#top25 .brow.noop').count() === 18,
        'ranked teams with no archived game are greyed rather than blank (got ' +
        (await page.locator('#top25 .brow.noop').count()) + ')');
  check(await page.locator('#top25 .brow.noop[disabled]').count() === 18,
        'and they are not clickable');
  const noGame = await page.locator('#top25 .brow.noop .hl.none').first().textContent();
  check(/No archived game/.test(noGame || ''), 'the empty result says what it means: ' + (noGame||'').trim());
  const pres = await page.locator('#top25 .pres').allTextContents();
  check(pres.length === 7, 'every ranked team WITH a game shows its result (got ' + pres.length + ')');
  check(/beat|lost to|tied/.test(pres[0] || ''), 'the result is in words, not just a score: ' + (pres[0]||'').trim());
  check(await page.locator('#top25 .pres.w').count() >= 1 && await page.locator('#top25 .pres.l').count() >= 1,
        'wins and losses are told apart');
  /* movement: team 101 was 1st this week and 2nd last week, so it must read as up 1 */
  const mv = await page.locator('#top25 .brow').first().locator('.mv').first();
  check(/1/.test((await mv.textContent()) || '') && (await mv.getAttribute('class') || '').includes('up'),
        'rank movement against the previous poll: ' + ((await mv.textContent())||'').trim());
  check(await page.locator('#top25 .mv.dn').count() >= 1, 'and a faller is marked too');
  check(await page.locator('#top25 .brow .cf').count() === 25, 'every row names the conference');
  /* NO BLANK CRESTS. The fixture gives almost every team logo_url 'N/A', which is what
     the live service holds for most of Division II and III, so this is the real case. */
  check(await page.locator('#top25 .lchip.empty').count() === 0,
        'no row falls back to an empty chip');
  const marks = await page.locator('#top25 .lchip.mark img').count();
  check(marks >= 20, 'unlogo\'d teams draw a monogram instead (got ' + marks + ')');
  const markSrc = await page.locator('#top25 .lchip.mark img').first().getAttribute('src');
  check(/^data:image\/svg\+xml/.test(markSrc || ''),
        'the monogram is an inline SVG, so it needs no network: ' + (markSrc||'').slice(0,34));
  check(/%3Ctext/.test(markSrc || ''), 'and it carries initials rather than being a grey box');
  const marked = await page.locator('#top25 .lchip.mark[title]').count();
  check(marked === marks, 'every monogram names its team on hover');
  check(await page.locator('#top25 .tuxnote').count() === 0, 'the poll board stays clean too');
  await page.click('#top25 .brow.game');
  await page.waitForTimeout(250);
  check(await page.locator('#drawer.on').count() === 1, 'a poll row with a game opens the box score drawer');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  /* switching the week must repaint the board in place, not reload the page */
  await page.selectOption('#tp-week', { index: 1 });
  await page.waitForTimeout(200);
  check(await page.locator('#top25 .brow').count() === 25, 'the week filter redraws the board');
  check(await page.locator('#top25 .mv.new').count() === 25,
        'the first poll of a season shows every team as new, because there is nothing to move from');
  await page.selectOption('#tp-week', { index: 0 });
  await page.waitForTimeout(200);

  /* ---- the Top 25, TUX MODE (what the board used to be, unchanged) ------ */
  await page.selectOption('#tp-poll', '__tux');
  await page.waitForTimeout(250);
  const tuxHead = (await page.textContent('#top25 .qh')) || '';
  check(/Tux’s Top 25|Tux.s Top 25/.test(tuxHead), 'Tux mode renames the board: ' +
        tuxHead.replace(/\s+/g,' ').trim().slice(0,70));
  const brows = await page.locator('#top25 .brow').count();
  check(brows === 7, 'home Top 25 lists the whole latest week when it is short of 25 (got ' + brows + ')');
  const bIdx = await page.locator('#top25 .brow .mbar b').allTextContents();
  check((bIdx[0]||'').trim() === '88',
        'board is ranked by the Aftermath Index, best first: ' + (bIdx[0]||'').trim());
  check(await page.locator('#top25 .brow .tgrade').count() >= 6, 'board shows the Tux grade on each row');
  check(await page.locator('#m-home .tuxnote').count() === 0, 'the home board stays clean too');
  /* the wide gutter between the score and the bar now carries Tux's headline */
  const hls = await page.locator('#top25 .brow .hl').allTextContents();
  check(hls.length === 7, 'every board row has a headline cell (got ' + hls.length + ')');
  check(/TEST HEADLINE FOR GAME 2/.test(hls[0] || ''),
        'the headline shown is the recap headline for that game: ' + (hls[0]||'').trim());
  check(await page.locator('#top25 .brow .hl[title]').count() === 7,
        'the full headline is available as a tooltip when it clamps');
  const clamp = await page.evaluate(() => getComputedStyle(document.querySelector('#top25 .brow .hl')).webkitLineClamp);
  check(clamp === '2', 'a long headline wraps to two lines instead of stretching the row');
  check(await page.locator('#top25 .brow .pill.angle').count() >= 6, 'board shows the recap angle on each row');
  check(await page.locator('#tp-week option').count() === 2,
        'Tux mode swaps the week filter to the archive weeks');
  await page.selectOption('#tp-poll', 'AP Top 25');
  await page.waitForTimeout(250);
  check(await page.locator('#top25 .brow').count() === 25, 'and switching back restores the poll');
  /* the board sits at the BOTTOM of home and the tip sits at the TOP of the board */
  const order = await page.evaluate(() => {
    const kids = Array.from(document.querySelectorAll('#m-home > *'));
    const bi = kids.findIndex(k => k.querySelector('.board'));
    return { bi, n: kids.length };
  });
  check(order.bi === order.n - 1, 'the board is the last block on home (' + order.bi + ' of ' + (order.n-1) + ')');
  const inBoard = await page.evaluate(() => {
    const card = document.querySelector('#m-home .board').closest('.card');
    const kids = Array.from(card.children);
    return { hint: kids.findIndex(k=>k.classList.contains('hint')),
             board: kids.findIndex(k=>k.classList.contains('board')) };
  });
  check(inBoard.hint > -1 && inBoard.hint < inBoard.board, 'the tip sits above the board');
  await page.click('#m-home .brow');
  await page.waitForTimeout(250);
  check(await page.locator('#drawer.on').count() === 1, 'a board row opens the box score drawer');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  await page.click('#m-home .qcard[data-goto="dig"]');
  await page.waitForTimeout(250);
  check(await page.locator('#m-dig.on').count() === 1, 'a question card navigates to its page');
  await page.click('#nav button[data-mode="home"]');
  await page.waitForTimeout(150);

  for (const p of PAGES){
    await page.click('#nav button[data-mode="'+p+'"]');
    await page.waitForTimeout(320);
    const txt = (await page.textContent('#m-'+p) || '').trim();
    check(txt.length > 200 && !/^Loading/.test(txt), 'page renders: ' + p + ' (' + txt.length + ' chars)');
  }

  /* Q1 - opens on the latest week, presets narrow, sort reorders */
  await page.click('#nav button[data-mode="aftermath"]');
  await page.waitForTimeout(200);
  check(await page.inputValue('#af-week') === '2025-0-12', 'Aftermath opens on is_latest week');
  const n0 = await page.locator('#af-feed .game').count();
  check(n0 === 7, 'Aftermath shows the 7 games of week 12 (got ' + n0 + ')');
  const aTxt = await page.textContent('#m-aftermath');
  check(/seven weighted components|weighted components/.test(aTxt),
        'Q1 explains what goes into the Aftermath Index');
  check(/Tux\u2019s letter grade|Tux.s letter grade/.test(aTxt), 'Q1 explains the Tux grade');
  check(/full box score/.test(aTxt), 'Q1 tells the reader the cards are clickable');
  check(await page.locator('#m-aftermath .exbox').count() === 1, 'Q1 explainer wears the orange panel');
  const afTips = await page.locator('#af-presets .chip[title]').count();
  const afChips = await page.locator('#af-presets .chip').count();
  check(afTips === afChips && afChips > 4, 'every Q1 quick filter carries a tooltip (' + afTips + '/' + afChips + ')');

  await page.click('#af-presets .chip[data-p="ml"]');
  await page.waitForTimeout(150);
  const nMl = await page.locator('#af-feed .game').count();
  check(nMl === 1, 'preset "moneyline paid" leaves 1 game (got ' + nMl + ')');
  /* stacking: a second chip must NARROW, not replace. This is the whole point of
     multi-select, and single-select would silently pass a count check on its own. */
  await page.click('#af-presets .chip[data-p="onescore"]');
  await page.waitForTimeout(150);
  const nBoth = await page.locator('#af-feed .game').count();
  const pressed = await page.locator('#af-presets .chip[aria-pressed="true"]').count();
  check(pressed === 2, 'two quick filters stay lit at once (got ' + pressed + ')');
  check(nBoth <= nMl, 'stacked filters narrow rather than replace (' + nMl + ' -> ' + nBoth + ')');
  check(/Stacked:/.test(await page.textContent('#m-aftermath')), 'the page says which filters are stacked');
  await page.click('#af-presets .chip[data-p="onescore"]');
  await page.click('#af-presets .chip[data-p="ml"]');
  await page.waitForTimeout(150);
  check(await page.locator('#af-feed .game').count() === 7, 'clearing every chip restores the full week');
  await page.selectOption('#af-sort', 'close');
  await page.waitForTimeout(150);
  const firstClose = await page.locator('#af-feed .game').first().getAttribute('data-gid');
  check(firstClose === '2', 'sort by closest finish puts the 1-point game first (got ' + firstClose + ')');
  await page.selectOption('#af-week', '2025-0-11');
  await page.waitForTimeout(150);
  check(await page.locator('#af-feed .game').count() === 1, 'week selector switches to week 11');

  /* the OT game must render 5 periods, and the no-index game must show no grade */
  await page.selectOption('#af-week', '2025-0-12');
  await page.waitForTimeout(150);
  const otHead = await page.locator('#af-feed .game[data-gid="5"] .qline th').allTextContents();
  check(otHead.join(',').includes('OT'), 'overtime game shows an OT column: ' + otHead.join(','));
  const grade4 = await page.locator('#af-feed .game[data-gid="4"] .tgrade').count();
  check(grade4 === 0, 'game with no excitement index shows no grade');
  const grade1 = await page.locator('#af-feed .game[data-gid="1"] .tgrade').count();
  check(grade1 === 1, 'a graded game wears the Tux mark, not a grey pill');
  check(await page.locator('#af-feed .game .tuxnote').count() === 0,
        'game cards do NOT carry the beagle note - 25 copies of it on a board is noise');
  const tmpl = await page.locator('#af-feed .game[data-gid="3"] .pill.tmpl').count();
  check(tmpl === 1, 'templated recap is labelled as one');

  /* Q2 - blanks sort last in both directions */
  await page.click('#nav button[data-mode="dig"]');
  await page.waitForTimeout(250);
  const rowsN = await page.locator('#dg-body tr').count();
  check(rowsN === 8, 'Dig lists all 8 games (got ' + rowsN + ')');
  for (const dir of ['desc','asc']){
    await page.click('#dg-head th[data-k="ml_payout"]');
    await page.waitForTimeout(120);
    const cells = await page.locator('#dg-body tr td:nth-child(11)').allTextContents();
    const lastIsBlank = cells[cells.length-1].trim() === '—';
    check(lastIsBlank, 'ML blanks sort last (' + dir + ')');
  }
  const heads = (await page.locator('#dg-head th').allTextContents()).map(t=>t.trim());
  check(heads.some(h=>/Excitement Index/i.test(h)), 'Dig spells out Excitement Index: ' + heads.join(' | '));
  check(heads.some(h=>/Tux Grade/i.test(h)), 'Dig spells out Tux Grade');
  check(heads.some(h=>/ATS/i.test(h)), 'Dig keeps an ATS column');
  const thTips = await page.locator('#dg-head th[title]').count();
  check(thTips === heads.length, 'every Dig column header has a tooltip (' + thTips + '/' + heads.length + ')');
  const atsTip = await page.getAttribute('#dg-head th[data-k="cover_result"]', 'title');
  check(/covered/i.test(atsTip || '') && (atsTip || '').length > 60,
        'the ATS tooltip actually explains covering: ' + (atsTip||'').slice(0,70));
  check(await page.locator('#m-dig .hint').count() === 1, 'Dig tells the reader rows are clickable');

  await page.click('#dg-presets .chip[data-p="ranked"]');
  await page.waitForTimeout(150);
  check(await page.locator('#dg-body tr').count() === 1, 'Dig preset "both ranked" leaves 1');
  /* BK asked for instant classics AND upsets at the same time */
  await page.click('#dg-presets .chip[data-p="classic"]');
  await page.waitForTimeout(150);
  const dPressed = await page.locator('#dg-presets .chip[aria-pressed="true"]').count();
  check(dPressed === 2, 'Dig filters stack too (got ' + dPressed + ' lit)');
  await page.click('#dg-presets .chip[data-p="classic"]');
  await page.click('#dg-presets .chip[data-p="ranked"]');
  await page.waitForTimeout(150);
  check(await page.locator('#dg-body tr').count() === 8, 'clearing Dig chips restores all 8');

  /* drawer */
  const dTxt = await page.textContent('#m-dig');
  check(/four columns people ask about/i.test(dTxt), 'Dig fills the top right with a reader guide');
  check(await page.locator('#m-dig .exbox').count() === 1, 'Q2 explainer wears the orange panel');
  check(/Volatility, not quality/i.test(dTxt), 'the guide repeats the excitement-index caveat where it is read');
  check(/Home covered/i.test(dTxt), 'the guide explains covering in plain words');
  await page.evaluate(()=>{ const w=document.querySelector('#m-dig .tablewrap'); if(w) w.scrollLeft=0; });

  /* EARLY-SEASON EMPTY STATES. A team that has not played yet is the normal case in
     week 1 - CFBD's 2026 week 1 is a ten-day bucket and on the Sunday in the middle of
     it only 124 of 455 games had been played. "No results" must not read as broken. */
  await page.fill('#dg-q', 'zzzznotateam');
  await page.waitForTimeout(220);
  const eDig = await page.textContent('#m-dig .emptystate');
  check(!!eDig && /already been played/.test(eDig),
        'Dig explains an empty team search instead of rendering an empty table');
  check(/season opens\s+later/.test(eDig || ''), 'and names the early-season reason');
  check(await page.locator('#dg-body tr').count() === 1, 'the empty state occupies the table, not nothing');
  await page.fill('#dg-q', '');
  await page.waitForTimeout(220);
  check(await page.locator('#dg-body tr').count() === 8, 'clearing the search restores the table');

  await page.click('#nav button[data-mode="aftermath"]');
  await page.waitForTimeout(280);
  await page.fill('#af-q', 'zzzznotateam');
  await page.waitForTimeout(220);
  const eAf = await page.textContent('#m-aftermath .emptystate');
  check(/already been played/.test(eAf || ''), 'Q1 explains an empty team search the same way');
  await page.fill('#af-q', '');
  await page.waitForTimeout(220);
  await page.click('#af-presets .chip[data-p="ml"]');
  await page.click('#af-presets .chip[data-p="ot"]');
  await page.waitForTimeout(250);
  const eChip = await page.textContent('#m-aftermath .emptystate').catch(()=>null);
  check(eChip === null || /stack with AND/.test(eChip),
        'a chip dead end blames the chips, not a missing team');
  await page.click('#af-presets .chip[data-p="ml"]');
  await page.click('#af-presets .chip[data-p="ot"]');
  await page.waitForTimeout(220);
  await page.click('#nav button[data-mode="dig"]');
  await page.waitForTimeout(280);
  await page.evaluate(()=>{ const w=document.querySelector('#m-dig .tablewrap'); if(w) w.scrollLeft=0; });

  await page.click('#dg-body tr');
  await page.waitForTimeout(250);
  check(await page.locator('#drawer.on').count() === 1, 'row click opens the drawer');
  /* THE BEAGLE DISCLAIMER must travel with every recap, not live only on the About
     page. A reader found a wrong nickname before any disclaimer existed. */
  const note = await page.textContent('#drawer-body .tuxnote').catch(()=>null);
  check(!!note && /I am a beagle and I get things wrong/.test(note),
        'the drawer carries the beagle note');
  check(/Trust the numbers/.test(note || ''),
        'and it says which half is trustworthy, not just "AI may make mistakes"');
  /* it belongs at the BOTTOM, under the provenance block - not interrupting the recap */
  const notePos = await page.evaluate(() => {
    const kids = Array.from(document.querySelector('#drawer-body').children);
    const n = kids.findIndex(k => k.classList.contains('tuxnote'));
    const p = kids.findIndex(k => /Provenance/.test(k.textContent) && k.tagName === 'H3');
    return { note:n, prov:p, total:kids.length };
  });
  check(notePos.note > notePos.prov && notePos.note >= notePos.total - 2,
        'the beagle note sits at the bottom of the drawer, after provenance: ' + JSON.stringify(notePos));
  const dtxt = await page.textContent('#drawer-body');
  check(/Aftermath Index/.test(dtxt) && /Provenance/.test(dtxt), 'drawer shows the box and provenance');
  check(/no line published/.test(dtxt) || /Closing spread/.test(dtxt), 'drawer states the market honestly');
  await page.screenshot({ path:'_shot_drawer.png', fullPage:false });
  await page.evaluate(()=>{ const d=document.querySelector('#drawer'); d.scrollTop = d.scrollHeight; });
  await page.waitForTimeout(250);
  await page.screenshot({ path:'_shot_drawer_bottom.png', fullPage:false });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check(await page.locator('#drawer.on').count() === 0, 'Escape closes the drawer');

  /* Q3 - the map places what it can and says what it could not */
  await page.click('#nav button[data-mode="yard"]');
  await page.waitForTimeout(700);
  const yc = await page.textContent('#yd-count');
  const yf = await page.textContent('#yd-foot');
  /* the Yard defaults to EVERY week, so it is 7 of 8 - one home team has no coordinates */
  check(/7 of 8 games placed/.test(yc), 'Yard places 7 of 8: ' + yc.replace(/\s+/g,' ').trim());
  /* the footnote now NAMES the campuses, so the gap is actionable rather than merely
     disclosed - the person who can fix it in the Teams layer gets told which team */
  check(/1 game could not be placed/.test(yf) && /no coordinates in the Teams layer/.test(yf),
        'Yard discloses the gap: ' + yf.replace(/\s+/g,' ').trim());
  check(/Nowhere College/.test(yf), 'and names the team whose campus is missing');
  check(await page.locator('#map-yard .leaflet-interactive').count() >= 5, 'map draws markers');

  /* the symbology chooser: every scheme must redraw and relabel its own legend */
  for (const c of ['index','excite','home','grade','market','angle']){
    await page.selectOption('#yd-color', c);
    await page.waitForTimeout(220);
    const legN = await page.locator('#yd-legend span').count();
    check(legN >= 2, 'colour scheme "' + c + '" draws a legend (' + legN + ' keys)');
  }
  for (const z of ['index','points','crowd','flat','margin']){
    await page.selectOption('#yd-size', z);
    await page.waitForTimeout(180);
  }
  check(await page.locator('#map-yard .leaflet-interactive').count() >= 5, 'map survives every size scheme');
  const yTxt = await page.textContent('#m-yard');
  check(/Symbology/i.test(yTxt), 'Yard fills the top right with the symbology chooser');
  check(/What this map is not/i.test(yTxt), 'Yard says what the map does NOT show');
  check(/home team.s campus/i.test(yTxt), 'Yard says where the dot actually sits');
  check(await page.locator('#yd-color option').count() === 6, 'six colour schemes offered');
  check(await page.locator('#yd-size option').count() === 5, 'five size schemes offered');

  /* Q4 + about */
  await page.click('#nav button[data-mode="season"]');
  await page.waitForTimeout(400);
  const sTxt = await page.textContent('#m-season');
  check(/Week Index/.test(sTxt), 'Long Season explains the Week Index');
  check(/Best week so far/.test(sTxt), 'Long Season names the best week');
  await page.click('#nav button[data-mode="couch"]');
  await page.waitForTimeout(300);
  const cTxt = await page.textContent('#m-couch');
  check(/volatility, not quality/.test(cTxt), 'About states the excitement-index caveat');
  check(/Gamble Responsibly/.test(cTxt), 'About carries the responsible-gambling line');
  check(/Division II and III are absent/.test(cTxt), 'About explains the D2/D3 absence');
  check(/About Tux.s Human/i.test(cTxt), 'Under the Couch credits the human');
  check(/Timmons/.test(cTxt), 'Under the Couch names Timmons Group');
  check(await page.locator('#m-couch a[href*="linkedin"]').count() >= 1, 'Under the Couch links LinkedIn');
  check(/About Tux\b/.test(cTxt), 'Under the Couch has Tux\u2019s own biography');
  check(await page.locator('#m-couch img.biopic').count() >= 1, 'Under the Couch shows the real photographs');
  check(/Services this page reads/i.test(cTxt), 'Under the Couch lists the services it reads');
  check(await page.locator('#m-couch .endpoint').count() >= 3,
        'the services section names each endpoint, Ask-the-Atlas style');
  /* data honesty must sit ABOVE the index explanations */
  const iHonest = cTxt.indexOf('honest'), iIndex = cTxt.indexOf('Aftermath Index');
  check(iHonest > -1 && iHonest < iIndex, 'data honesty comes before the index explanations');

  /* the footer is the Ask the Atlas three-column block, not a single left column */
  const fTxt = await page.textContent('footer');
  check(await page.locator('footer .footgrid > div').count() === 3, 'footer has three columns');
  check(/\bData\b/.test(fTxt) && /Built with/.test(fTxt), 'footer carries Data and Built with');
  const fStamp = await page.textContent('#foot-stamp');
  check(/Data last refreshed/.test(fStamp), 'footer stamps when the data was refreshed');
  check(/This page loaded/.test(fStamp), 'footer stamps when the page loaded');
  check(/\bET\b|EDT|EST/.test(fStamp), 'both stamps name the time zone: ' + fStamp.replace(/\s+/g,' ').trim());

  /* NO BRITISH SPELLING. BK asked for this explicitly and it is easy to reintroduce. */
  const BRIT = /\b(colour|colours|coloured|favourite|favourites|favoured|labelled|behaviour|centre|neighbour|organise|recognise|analyse|programme|travelled|modelled|defence|licence|whilst)\b/i;
  for (const p of PAGES){
    await page.click('#nav button[data-mode="'+p+'"]');
    await page.waitForTimeout(300);
    const bad2 = await page.evaluate(sel => {
      const re = /\b(colour|colours|coloured|favourite|favourites|favoured|labelled|behaviour|centre|neighbour|organise|recognise|analyse|programme|travelled|modelled|defence|licence|whilst)\b/i;
      const root = document.querySelector(sel);
      const hits = [];
      if (re.test(root.textContent)) hits.push('body text');
      root.querySelectorAll('[title]').forEach(n => { if (re.test(n.title)) hits.push('tooltip: ' + n.title.slice(0,40)); });
      return hits.slice(0,3);
    }, '#m-'+p);
    check(bad2.length === 0, 'no British spelling on ' + p + (bad2.length ? ' -> ' + bad2.join(' | ') : ''));
  }

  /* the one bar, drawn the same way in all four places, never scaled to the screen */
  await page.click('#nav button[data-mode="dig"]');
  await page.waitForTimeout(300);
  const dbars = await page.evaluate(() => Array.from(document.querySelectorAll('#dg-body .mbar'))
    .slice(0,6).map(m => ({ v:+m.querySelector('b').textContent, w:m.querySelector('i') ? m.querySelector('i').style.width : null })));
  const scaled = dbars.filter(b=>b.w).every(b => Math.abs(parseFloat(b.w) - b.v) <= 2);
  check(scaled, 'Dig bar fill is the value out of 100, not out of the biggest value on screen: ' +
        JSON.stringify(dbars.slice(0,3)));
  const orange = await page.evaluate(() => {
    const i = document.querySelector('#dg-body .mbar i');
    return i ? getComputedStyle(i).backgroundImage : '';
  });
  check(/242,\s*100,\s*48/.test(orange), 'the bar fill is the orange accent');
  await page.click('#nav button[data-mode="season"]');
  await page.waitForTimeout(350);
  check(await page.locator('#m-season .wkrow .mbar').count() >= 2, 'Long Season uses the same bar');
  const wkb = await page.evaluate(() => Array.from(document.querySelectorAll('#m-season .wkrow .mbar'))
    .map(m => ({ v:+m.querySelector('b').textContent, w:parseFloat(m.querySelector('i').style.width) })));
  check(wkb.every(b => Math.abs(b.w - b.v) <= 2),
        'a Week Index of 58 fills 58% of a full-width track: ' + JSON.stringify(wkb));
  const sTxt2 = await page.textContent('#m-season');
  check(/running total/i.test(sTxt2), 'Long Season explains that the leaderboard counts are running totals');
  check(/over 1 game/.test(sTxt2), 'the leaderboard sub-label says what the count is');
  check(/covered \d+ of \d+/.test(sTxt2) || /Not enough of the season/.test(sTxt2),
        'the ATS sub-label says what the fraction is');
  /* ---- the conference ledger, which replaced the Season top ten game feed ----
     The old assertion here was that Q4 ended in a .feed of gameCards. It deliberately
     does not any more: those cards are already on Home and on The Aftermath, so the
     bottom of the archive page was the third serving of one dish. */
  check(await page.locator('#m-season .feed').count() === 0,
        'Q4 no longer repeats the game cards that Home and Q1 already show');
  check(await page.locator('#confledger').count() === 1, 'the conference ledger is its own card');
  check(await page.locator('#crossconf').count() === 1, 'the non-conference head-to-head is its own card');
  const cfHead = await page.locator('#confledger th').allTextContents();
  check(cfHead.length === 11, 'the ledger has eleven columns (got ' + cfHead.length + ')');
  check(/Conference/.test(cfHead[0]) && /Tux Index/.test(cfHead[10]),
        'it runs conference to Tux Index: ' + cfHead.join(' | '));
  check(await page.locator('#confledger th.sortable').count() === 11, 'every column sorts');
  check(await page.locator('#confledger th.sorted').count() === 1, 'exactly one column is the active sort');
  const sorted0 = await page.locator('#confledger th.sorted').textContent();
  check(/Tux Index/.test(sorted0 || ''), 'and it opens on Tux Index: ' + (sorted0||'').trim());
  const cfRows = await page.locator('#confledger tbody tr').count();
  check(cfRows >= 2, 'the fixture produces more than one conference row (got ' + cfRows + ')');
  /* the entertainment column must be the SHARED bar, not a bespoke one */
  check(await page.locator('#confledger tbody .mbar').count() >= 2, 'Tux Index uses the same bar as everywhere else');
  /* every conference row is built from SIDES: the fixture has 8 games, so the two
     conferences together must account for 16 side-appearances */
  const gTotal = await page.evaluate(() => Array.from(
    document.querySelectorAll('#confledger tbody tr td:nth-child(3)')).reduce((s,td)=>s+(+td.textContent||0),0));
  check(gTotal === 16, 'a game counts once for each side, so 8 games make 16 (got ' + gTotal + ')');
  /* sorting is real, not decorative */
  const before = await page.locator('#confledger tbody tr td.l b').allTextContents();
  await page.click('#confledger th[data-k="ppgF"]');
  await page.waitForTimeout(150);
  const afterSort = await page.locator('#confledger th.sorted').textContent();
  check(/PPG/.test(afterSort || ''), 'clicking a heading moves the sort: ' + (afterSort||'').trim());
  await page.click('#confledger th[data-k="ppgF"]');
  await page.waitForTimeout(150);
  const flipped = await page.locator('#confledger tbody tr td.l b').allTextContents();
  check(flipped.join() !== before.join() || flipped.length === 1,
        'clicking the same heading twice reverses it');
  await page.click('#confledger th[data-k="idx"]');
  await page.waitForTimeout(150);
  /* the division picker drives BOTH cards */
  const divOpts = await page.locator('#cf-div option').allTextContents();
  check(divOpts.length >= 1 && /FBS/.test(divOpts.join(' ')), 'the division picker lists what the archive holds: ' + divOpts.join(' | '));
  /* the ATS column must be a real fraction, not a permanent dash */
  const atsCells = await page.evaluate(() => Array.from(
    document.querySelectorAll('#confledger tbody tr td:nth-child(9)')).map(td=>td.textContent.trim()));
  check(atsCells.some(t => /\d-\d/.test(t)),
        'the ATS column settles priced games instead of showing a dash: ' + atsCells.join(' | '));
  /* the summary sentence must agree with the table it sits above */
  const lede = await page.textContent('#confledger');
  check(/Best football to watch/.test(lede), 'the ledger hands over its answer in a sentence');
  const ledeConf = (lede.match(/Best football to watch: ([^ ]+ ?[^ ]*) at (\d+)/) || []);
  check(!!ledeConf[2], 'and the sentence names a number: ' + (ledeConf[0]||'none').trim());
  check(/best: /.test(await page.textContent('#confledger tbody')),
        'each conference row labels its best game rather than dropping a bare matchup');
  const sTxt3 = await page.textContent('#m-season');
  check(/complete picture for this division/.test(sTxt3),
        'FBS is labeled as the complete picture');
  check(/sides rather than games/.test(sTxt3),
        'the ledger explains that a conference game counts twice');
  check(/non-conference/i.test(sTxt3), 'the head-to-head says it is non-conference only');
  /* ---- the conference drill-down ---- */
  check(await page.locator('#confledger tr.crow').count() >= 2, 'every ledger row is clickable');
  check(await page.locator('#confledger tr.crow[role="button"]').count() >= 2,
        'and reachable from the keyboard');
  await page.click('#confledger tr.crow');
  await page.waitForTimeout(300);
  check(await page.locator('#drawer.on').count() === 1, 'a conference row opens the drawer');
  const cfTxt = await page.textContent('#drawer-body');
  check(/conference breakdown/.test(cfTxt), 'the drawer says what it is showing');
  check(/Who produced it/.test(cfTxt), 'and it is a breakdown by team');
  check(await page.locator('#drawer .cstat').count() === 5,
        'the conference totals are restated at the top so the drawer agrees with the row');
  const cth = await page.locator('#drawer table.cteam th').allTextContents();
  check(/vs conf/.test(cth.join(' ')), 'the last real column is each team\'s distance from its own average');
  const crow = await page.locator('#drawer table.cteam tbody tr').count();
  check(crow >= 1, 'at least one team row (got ' + crow + ')');
  /* the drawer arithmetic must reconcile with the ledger row that opened it */
  const drawerG = await page.evaluate(() => Array.from(
    document.querySelectorAll('#drawer table.cteam tbody tr td:nth-child(2)')).reduce((s,td)=>s+(+td.textContent||0),0));
  const statG = +(await page.locator('#drawer .cstat b').first().textContent());
  check(drawerG === statG, 'the team rows add up to the conference total (' + drawerG + ' vs ' + statG + ')');
  check(await page.locator('#drawer .lchip.empty').count() === 0, 'no blank crest in the drawer either');
  /* the payoff column must be VISIBLE, not just present - at the original 560px it
     fell off the right edge of the panel and needed a horizontal scroll to find */
  check(await page.locator('#drawer.wide').count() === 1, 'the conference panel is the wide one');
  const vsFits = await page.evaluate(() => {
    const ths = Array.from(document.querySelectorAll('#drawer table.cteam th'));
    const vs = ths.find(t => /vs conf/i.test(t.textContent));
    if (!vs) return null;
    const wrap = vs.closest('.tablewrap');
    return vs.getBoundingClientRect().right <= wrap.getBoundingClientRect().right + 1;
  });
  check(vsFits === true, 'and "vs conf" is on screen without scrolling sideways');
  /* a team's best game opens the box score from inside the conference drawer */
  await page.click('#drawer button.mini.game');
  await page.waitForTimeout(250);
  check(/The box/.test(await page.textContent('#drawer-body')),
        'the box button swaps the drawer to that game');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check(await page.locator('#drawer.on').count() === 0, 'escape closes it');

  const h2hRows = await page.locator('#crossconf .h2hrow').count();
  check(h2hRows >= 1, 'the non-conference board has at least one pairing (got ' + h2hRows + ')');
  check(await page.locator('#crossconf .h2hrow .lead').count() >= 1, 'the series leader is marked');
  check(await page.locator('#crossconf .h2hrow .rec').count() === h2hRows, 'every pairing shows a record');

  /* Q3 symbology panel, and the tip above the map */
  await page.click('#nav button[data-mode="yard"]');
  await page.waitForTimeout(400);
  check(await page.locator('#m-yard .symbox').count() === 1, 'Q3 symbology is its own highlighted panel');
  const yOrder = await page.evaluate(() => {
    const kids = Array.from(document.querySelectorAll('#m-yard > *'));
    return { hint: kids.findIndex(k=>k.classList.contains('hint')),
             map:  kids.findIndex(k=>k.querySelector('#map-yard')) };
  });
  check(yOrder.hint > -1 && yOrder.hint < yOrder.map, 'the tip sits above the map');

  /* Under the Couch: BK's requested order and content */
  await page.click('#nav button[data-mode="couch"]');
  await page.waitForTimeout(400);
  const c2 = await page.textContent('#m-couch');
  check(await page.locator('#m-couch img.biopic').count() === 2, 'both real photographs of Tux are on the page');
  check(await page.locator('#m-couch .biobody').count() === 1, 'the biography runs full width');
  check(await page.locator('#m-couch .honest .mbar').count() >= 6, 'data honesty uses the shared bar');
  check(/games currently loaded/.test(c2) && /move as the season grows/.test(c2),
        'the honesty copy is written to keep reading correctly as the archive grows');
  check(await page.locator('#m-couch .tgrade').count() >= 3, 'the Tux Grade section wears the badge');
  const endpointFont = await page.evaluate(() => {
    const a = document.querySelector('#m-couch .endpoint a');
    return a ? getComputedStyle(a).fontFamily : '';
  });
  check(/mono|Consolas/i.test(endpointFont), 'endpoints are monospaced, like Ask the Atlas: ' + endpointFont);
  const cOrder = await page.evaluate(() => {
    const t = document.querySelector('#m-couch').textContent;
    return { human:t.indexOf('About Tux'), honest:t.indexOf('Data honesty'),
             svc:t.indexOf('Services this page reads'), gate:t.indexOf('How Tux is stopped') };
  });
  check(cOrder.honest < cOrder.svc && cOrder.svc < cOrder.gate,
        'order is honesty, then services, then the pipeline last: ' + JSON.stringify(cOrder));
  check(await page.locator('#m-couch .pstep').count() === 6, 'the pipeline is told in six numbered steps');
  check(/Groq/.test(c2) && /gpt-oss-120b/.test(c2), 'the pipeline names the engine and the model');
  check(!/08b_game_recaps|\.ipynb/.test(c2), 'the pipeline does NOT name the notebook file');
  /* the worked example: the beat sheet the model got, and the recap it returned */
  check(await page.locator('#m-couch pre.beat').count() === 1, 'the beat sheet sample is shown');
  const beat = await page.textContent('#m-couch pre.beat');
  check(/"numbers"/.test(beat) && /"beats"/.test(beat) && /Gunner Stockton/.test(beat),
        'the sample carries the whitelist and the beats');
  check(await page.locator('#m-couch .outbox').count() === 1, 'the resulting recap is shown beside it');
  const outb = await page.textContent('#m-couch .outbox');
  check(/AROOOOO/.test(outb) && /76,131/.test(outb), 'the recap sample is the real returned copy');
  check(/nearly[\s\S]{0,12}failed/.test(c2), 'the example is honest about the one number that nearly failed');
  /* the house rules, as a list, in BK's words */
  check(await page.locator('#m-couch ol.rules li').count() === 6, 'the six house rules are a numbered list');
  /* the rules belong to the pipeline card at the bottom, NOT to the biography */
  check(await page.locator('#m-couch .biobody ol.rules').count() === 0,
        'the rules are out of the About Tux biography');
  check(await page.evaluate(() => {
          const ol = document.querySelector('#m-couch ol.rules');
          const card = ol.closest('.card');
          return !!card.querySelector('.pipe');
        }), 'the rules sit in the how-it-works card at the bottom of the page');
  const cOrder2 = await page.evaluate(() => {
    const t = document.querySelector('#m-couch').textContent;
    return { svc:t.indexOf('Services this page reads'), rules:t.indexOf('The only commands Tux listens to') };
  });
  check(cOrder2.svc < cOrder2.rules, 'the rules come after the services section: ' + JSON.stringify(cOrder2));
  const rules = (await page.locator('#m-couch ol.rules li').allTextContents()).join(' | ');
  check(/NUMBERS/.test(rules) && /Nobody speaks except Tux/.test(rules) && /No picks/.test(rules) &&
        /Under 150 words/.test(rules), 'the rules are the real ones: ' + rules.slice(0,60) + '...');
  check(await page.locator('#m-couch .biolayout > *').count() === 3,
        'About Tux is photo / biography / photo');

  /* the footer link order BK asked for */
  const flinks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('footer .footgrid > div:first-child a')).map(a=>a.textContent.trim()));
  check(flinks.indexOf('The CFB Atlas Experience') < flinks.indexOf('Ask the Atlas'),
        'the Experience link comes before Ask the Atlas: ' + flinks.join(' / '));

  /* phone: no horizontal overflow on any page */
  await page.setViewportSize({ width:390, height:844 });
  for (const p of PAGES){
    await page.click('#nav button[data-mode="'+p+'"]');
    await page.waitForTimeout(350);
    const over = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(over <= 1, 'no horizontal overflow at 390px: ' + p + ' (' + over + 'px)');
  }

  /* ---- READABLE at 390px, not merely non-overflowing ------------------------
     WHY THESE EXIST (2026-09-08). The overflow check above passed on every page
     while the Top 25 was unreadable on a real phone: the opponent name rendered
     0px wide and 156px tall, one letter per line. Text that WRAPS does not
     overflow, so an overflow assertion is structurally blind to this entire class
     of failure - and the fixture had the bug the whole time.
     These measure rendered geometry instead. A text box narrower than a couple of
     words, or taller than a couple of lines, is stacked, and stacked is broken. */
  const narrow = [];
  const measure = async (sel, minW, maxH, label) => {
    const m = await page.evaluate(([sel]) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    }, [sel]);
    if (!m) { narrow.push(label + ' (not present)'); return; }
    const ok = m.w >= minW && m.h <= maxH;
    check(ok, label + ' is readable at 390px (' + m.w + 'x' + m.h + 'px, needs >=' +
          minW + ' wide and <=' + maxH + ' tall)');
    if (!ok) narrow.push(label + ' ' + m.w + 'x' + m.h);
  };

  await page.click('#nav button[data-mode="home"]');
  await page.waitForTimeout(350);
  /* poll mode: the result cell is the one that collapsed */
  await measure('#top25 .pres .on', 70, 46, 'the poll board result name');
  await measure('#top25 .brow .mu .nm', 70, 46, 'the poll board team name');
  const rowH = await page.evaluate(() =>
    Math.round(document.querySelector('#top25 .brow').getBoundingClientRect().height));
  /* 150px is four stacked bands - rank+team, result, bar, pills - which is what a
     390px-wide row honestly needs. The BROKEN state measured 282px, so the threshold
     sits between the two rather than at a round number. */
  check(rowH <= 175, 'a poll row stays a row rather than a column at 390px (' + rowH + 'px tall)');
  /* tux mode: the headline cell shares that grid slot and must survive the same way */
  await page.selectOption('#tp-poll', '__tux');
  await page.waitForTimeout(300);
  await measure('#top25 .brow .hl', 120, 60, 'the Tux board headline');
  await page.selectOption('#tp-poll', 'AP Top 25');
  await page.waitForTimeout(300);

  /* Q4's week table: the label column was crushed to 34px and 128px tall */
  await page.click('#nav button[data-mode="season"]');
  await page.waitForTimeout(450);
  await measure('#m-season table.wks:not(.conf):not(.cteam) th.l', 55, 40, 'the week table heading');
  await measure('#m-season table.wks:not(.conf):not(.cteam) td.l', 55, 60, 'the week label cell');
  await measure('#confledger table.wks.conf th.l', 70, 40, 'the conference ledger heading');
  /* the wide tables must be SCROLLABLE rather than squeezed - the fix relies on the
     existing .tablewrap doing the work once the label stops collapsing */
  const scrolls = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll('#m-season .tablewrap').forEach((w,i) => {
      out['wrap'+i] = { canScroll: w.scrollWidth > w.clientWidth + 1,
                        table: Math.round(w.querySelector('table').getBoundingClientRect().width),
                        wrap: w.clientWidth };
    });
    return out;
  });
  check(Object.values(scrolls).every(v => v.canScroll),
        'every wide table scrolls sideways instead of crushing: ' + JSON.stringify(scrolls));
  await page.click('#nav button[data-mode="home"]');
  await page.waitForTimeout(300);
  if (narrow.length) console.log('  collapsed boxes:', narrow.join(' | '));
  await page.click('#nav button[data-mode="home"]');
  await page.waitForTimeout(350);
  await page.evaluate(()=>window.scrollTo(0,1100));
  await page.waitForTimeout(200);
  await page.screenshot({ path:'_shot_phone_home.png', fullPage:false });
  await page.click('#nav button[data-mode="couch"]');
  await page.waitForTimeout(400);
  await page.evaluate(()=>window.scrollTo(0,600));
  await page.waitForTimeout(200);
  await page.screenshot({ path:'_shot_phone_couch.png', fullPage:false });
  await page.setViewportSize({ width:1280, height:900 });
  await page.click('#nav button[data-mode="aftermath"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path:'_shot_aftermath.png', fullPage:false });
  await page.evaluate(()=>{ const c=document.querySelector('#af-feed .game'); c.scrollIntoView({block:'center'}); });
  await page.waitForTimeout(250);
  await page.screenshot({ path:'_shot_card.png', fullPage:false });
  await page.click('#nav button[data-mode="season"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path:'_shot_season.png', fullPage:false });
  await page.click('#nav button[data-mode="home"]');
  await page.waitForTimeout(350);
  await page.screenshot({ path:'_shot_home.png', fullPage:false });
  await page.evaluate(()=>window.scrollTo(0,700));
  await page.waitForTimeout(200);
  await page.screenshot({ path:'_shot_home2.png', fullPage:false });
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await page.waitForTimeout(250);
  await page.screenshot({ path:'_shot_footer.png', fullPage:false });
  await page.setViewportSize({ width:1600, height:900 });
  await page.waitForTimeout(300);
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await page.waitForTimeout(250);
  await page.screenshot({ path:'_shot_board_wide.png', fullPage:false });
  await page.setViewportSize({ width:1280, height:900 });
  await page.waitForTimeout(250);
  for (const p of ['dig','yard','couch']){
    await page.click('#nav button[data-mode="'+p+'"]');
    await page.waitForTimeout(500);
    await page.screenshot({ path:'_shot_'+p+'.png', fullPage:false });
  }
  await page.click('#nav button[data-mode="couch"]');
  await page.waitForTimeout(400);
  for (const [y,n] of [[900,'2'],[1800,'3'],[2700,'4'],[3600,'5'],[4600,'6']]){
    await page.evaluate(v=>window.scrollTo(0,v), y);
    await page.waitForTimeout(220);
    await page.screenshot({ path:'_shot_couch'+n+'.png', fullPage:false });
  }

  await browser.close();
  console.log('\n' + ok.map(s=>'  ok   ' + s).join('\n'));
  if (bad.length) console.log('\n' + bad.map(s=>'  FAIL ' + s).join('\n'));
  if (errors.length) console.log('\nPAGE ERRORS:\n' + errors.map(e=>'  ! ' + e).join('\n'));
  const cerr = consoleErrors.filter(t=>!/net::ERR|Failed to load resource/.test(t));
  if (cerr.length) console.log('\nCONSOLE ERRORS:\n' + cerr.map(e=>'  ! ' + e).join('\n'));
  console.log('\n' + ok.length + ' passed, ' + bad.length + ' failed, ' +
              errors.length + ' page errors, ' + cerr.length + ' console errors');
  process.exit(bad.length || errors.length || cerr.length ? 1 : 0);
})();
