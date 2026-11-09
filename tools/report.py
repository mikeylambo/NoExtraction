# Builds the build-report page (single HTML, screenshots embedded as JPEG) from artifacts/*.json.
import base64, io, json, os, subprocess, sys, html
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, 'artifacts')
OUT = sys.argv[1]
def j(name, default=None):
    p = os.path.join(A, name)
    return json.load(open(p)) if os.path.exists(p) else default
def img(name, w=880):
    p = os.path.join(A, 'shots', name + '.png')
    if not os.path.exists(p): return ''
    im = Image.open(p).convert('RGB'); im.thumbnail((w, w))
    b = io.BytesIO(); im.save(b, 'JPEG', quality=72, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()
commit = subprocess.check_output(['git', '-C', ROOT, 'rev-parse', '--short', 'HEAD']).decode().strip()
e = html.escape
bots = []
for f in ['bot-stealth-ch1-2.json', 'bot-stealth-ch3-6.json', 'bot-stealth-ch5.json', 'bot-stealth-flightGovernor+missileRack+arcBlade.json', 'bot-loud.json']:
    for r in j(f, []) or []:
        if f == 'bot-stealth-ch3-6.json' and r['chapter'] == 'ch5': continue  # superseded by the post-fix ch5 runs
        bots.append((f, r))
perf = (j('perf.json', {}) or {}).get('results', [])
proofs = (j('proofs.json', {}) or {}).get('results', [])
GROUPS = [
  ('Menus', ['00-splash', '01-title', '03-chapter-select', '02-options-accessibility']),
  ('Chapter 1 — The Job (72%)', ['ch1-intro-cinematic', 'ch1-ridge', 'ch1-first-patrol', 'ch1-courtyard-visor', 'ch1-hud-hunted', 'ch1-hud-lockdown', 'ch1-hangar-aegis']),
  ('Chapter 2 — Left Behind (58%)', ['ch2-motor-pool', 'ch2-the-pad-bridge', 'ch2-wren-ship', 'ch2-quake']),
  ('Chapter 3 — Dead Colony (41%)', ['ch3-dead-colony', 'ch3-mast-plaza', 'ch3-freight-lift-flood']),
  ('Chapter 4 — Under the Ice (24%)', ['ch4-dark', 'ch4-visor-in-dark', 'ch4-conduit-flood']),
  ('Chapter 5 — Aegis (11%)', ['ch5-depot', 'ch5-boot-up', 'ch5-online-mech-hud', 'ch5-wardens', 'ch5-shelf-run', 'ch5-marshal-intro', 'ch5-marshal-fight']),
  ('Chapter 6 — Ascent (2% → 0%)', ['ch6-launch', 'ch6-climb', 'ch6-silence', 'ch6-planet-breaks', 'ch6-wren']),
]
shots_html = ''
for title, names in GROUPS:
    figs = ''.join(f'<figure><img loading="lazy" src="{img(n)}" alt="{e(n)}"><figcaption>{e(n)}</figcaption></figure>' for n in names if img(n))
    if figs: shots_html += f'<h3>{e(title)}</h3><div class="shots">{figs}</div>'
def bot_rows():
    rows = ''
    for f, r in bots:
        cfg = 'loud' if 'loud' in f else ('all components' if 'flight' in f else 'stealth, no components' if r['chapter'] == 'ch5' else 'stealth')
        rows += f"<tr><td>{r['chapter']}</td><td>{cfg}</td><td class='{'ok' if r['ok'] else 'bad'}'>{'pass' if r['ok'] else 'fail'}</td><td class='num'>{r['simSeconds']}</td><td class='num'>{r['deaths']}</td><td class='num'>{r['lockdowns']}</td><td class='num'>{r['takedowns']}</td><td>{e(r.get('failed') or '')}</td></tr>"
    return rows
perf_rows = ''.join(f"<tr><td>{p['chapter']}</td><td class='num'>{p['drawCallsMax']}</td><td class='num'>{round(p['trianglesMax']/1000)}k</td><td class='num'>{p['enemies']}/{p['mechs']}</td><td class='num'>{p['particlesMax']}</td><td class='num'>{p['frameMsAvg']}</td><td class='num'>{p['fps']}</td></tr>" for p in perf)
proof_rows = ''.join(f"<li class='{'ok' if p['ok'] else 'bad'}'>{'✓' if p['ok'] else '✗'} {e(p['name'])}</li>" for p in proofs)
tpl = open(os.path.join(ROOT, 'tools', 'report.template.html')).read()
out = tpl.replace('{{COMMIT}}', commit).replace('{{BOTS}}', bot_rows()).replace('{{PERF}}', perf_rows or '<tr><td colspan="7">perf probe not run</td></tr>').replace('{{PROOFS}}', proof_rows).replace('{{PROOFCOUNT}}', f"{sum(p['ok'] for p in proofs)}/{len(proofs)}").replace('{{SHOTS}}', shots_html)
open(OUT, 'w').write(out)
print('report', OUT, round(os.path.getsize(OUT) / 1e6, 2), 'MB')
