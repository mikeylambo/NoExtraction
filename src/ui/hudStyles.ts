/** HUD + menu styling. Gameplay colours only through --nx-red / --nx-amber / --nx-cyan. */
export function injectHudStyles(): void {
  if (document.getElementById('nx-hud-css')) return;
  const s = document.createElement('style'); s.id = 'nx-hud-css';
  s.textContent = `
:root{--nx-red:#ff2a3a;--nx-amber:#ffb02e;--nx-cyan:#3ee6ff;--nx-signal:#f4f7ff;--nx-violet:#d7c7ff;--nx-font:'Barlow Condensed','Arial Narrow',system-ui,sans-serif;--nx-mono:'IBM Plex Mono',ui-monospace,monospace}
.nx-hud{position:fixed;inset:0;pointer-events:none;font-family:var(--nx-font);color:#eaf2f6;z-index:20;user-select:none}
.nx-letter{position:absolute;left:0;right:0;height:0;background:#000;transition:height .05s linear;z-index:30}.nx-letter-top{top:0}.nx-letter-bot{bottom:0}
.nx-foot,.nx-mech{transition:opacity .3s}
.nx-health{position:absolute;left:3vw;bottom:4vh;width:118px;height:118px}
.nx-health svg{width:100%;height:100%;transform:rotate(135deg)}
.nx-health circle{fill:none;stroke-width:7;stroke-linecap:round}
.nx-health .bg{stroke:rgba(255,255,255,.08);stroke-dasharray:235.6 400}
.nx-health .cap{stroke:rgba(62,230,255,.18)}
.nx-health .hp{stroke:var(--nx-cyan);filter:drop-shadow(0 0 6px var(--nx-cyan));transition:stroke-dasharray .2s}
.nx-health-num{position:absolute;inset:0;display:grid;place-items:center;font-size:34px;font-weight:700;letter-spacing:.02em}
.nx-health-num.low{animation:nxblink .6s infinite}
.nx-stims{position:absolute;left:96px;bottom:4px;display:flex;gap:4px}.nx-stims i{width:8px;height:16px;border-radius:50%;border:2px solid var(--nx-cyan)}
.nx-weapon{position:absolute;right:3vw;bottom:4vh;text-align:right}
.nx-weapon-name{font-size:15px;letter-spacing:.18em;opacity:.7;text-transform:uppercase}
.nx-ammo{font-size:44px;font-weight:700;line-height:1}.nx-ammo small{font-size:20px;opacity:.6;margin-left:6px}
.nx-ammo .rl{display:inline-block;width:110px;height:6px;background:rgba(255,255,255,.12);position:relative}.nx-ammo .rl:after{content:'';position:absolute;left:0;top:0;bottom:0;width:calc(var(--p)*100%);background:var(--nx-cyan)}
.nx-throw{margin-top:6px;font-size:13px;letter-spacing:.12em;opacity:.55}.nx-throw span{margin-left:12px}.nx-throw .sel{opacity:1;color:var(--nx-cyan)}
.nx-visor{margin-top:8px;height:10px}.nx-visor .vz{display:inline-block;width:70px;height:4px;background:rgba(255,255,255,.1);position:relative;border-radius:50%}
.nx-visor .vz:after{content:'';position:absolute;left:0;top:0;bottom:0;width:calc(var(--p)*100%);background:var(--nx-cyan)}.nx-visor .off{color:#9aa;font-size:12px;letter-spacing:.2em}
.nx-visor.pulse{animation:nxpulse 1.2s ease-out}
.nx-cross{position:absolute;left:50%;top:50%;--s:14px}.nx-cross i{position:absolute;background:rgba(240,250,255,.85);box-shadow:0 0 2px #000}
.nx-cross i:nth-child(1){width:2px;height:7px;left:-1px;top:calc(-1*var(--s) - 7px)}.nx-cross i:nth-child(2){width:2px;height:7px;left:-1px;top:var(--s)}
.nx-cross i:nth-child(3){height:2px;width:7px;top:-1px;left:calc(-1*var(--s) - 7px)}.nx-cross i:nth-child(4){height:2px;width:7px;top:-1px;left:var(--s)}
.nx-eye{position:absolute;left:50%;top:3.5vh;width:64px;height:32px;margin-left:-32px;color:#cfd8de;transition:opacity .3s}
.nx-eye svg{position:relative;z-index:1}.nx-eye-fill{position:absolute;left:0;right:0;bottom:0;background:var(--nx-red);clip-path:path('M2 16 Q32 -6 62 16 Q32 38 2 16 Z');opacity:.85}
.nx-eye[data-level="2"],.nx-eye[data-level="3"]{color:var(--nx-red)}.nx-eye[data-level="3"]{animation:nxblink .5s infinite}
.nx-alert-label{position:absolute;left:0;right:0;top:calc(3.5vh + 38px);text-align:center;font-size:13px;letter-spacing:.35em;font-weight:700}
.nx-alert-label[data-level="1"]{color:#ffd9dc}.nx-alert-label[data-level="2"],.nx-alert-label[data-level="3"]{color:var(--nx-red)}
.nx-clock{position:absolute;left:0;right:0;top:9vh;text-align:center;font-size:64px;font-weight:700;font-family:var(--nx-mono);letter-spacing:.04em;text-shadow:0 0 18px rgba(0,0,0,.8)}
.nx-clock.urgent{color:#fff}.nx-clock.critical{animation:nxblink .5s infinite}
.nx-clock-name{position:absolute;left:0;right:0;top:calc(9vh - 18px);text-align:center;font-size:13px;letter-spacing:.4em;opacity:.7;text-transform:uppercase}
.nx-core{position:absolute;right:3vw;top:4vh;text-align:right;opacity:0}.nx-core label{display:block;font-size:12px;letter-spacing:.3em;color:var(--nx-violet)}.nx-core b{font-size:40px;color:var(--nx-violet)}
.nx-objective{position:absolute;left:3vw;top:4vh;font-size:20px;letter-spacing:.05em;max-width:40vw;opacity:0;text-shadow:0 1px 4px #000}
.nx-obj-marker{position:absolute;left:0;top:0;display:none}.nx-obj-marker b{position:absolute;left:-7px;top:-7px;width:14px;height:14px;border:2px solid var(--nx-cyan);border-radius:50%}
.nx-obj-marker span{position:absolute;left:-30px;width:60px;top:12px;text-align:center;font-size:13px;color:var(--nx-cyan)}
.nx-prompt{position:absolute;left:50%;top:62%;transform:translateX(-50%);display:none;align-items:center;gap:10px;font-size:20px;padding:6px 16px;background:rgba(4,10,14,.6);border-left:3px solid var(--nx-cyan)}
.nx-prompt b{display:inline-block;min-width:24px;padding:0 6px;border:1px solid currentColor;text-align:center;margin-right:6px}
.nx-prompt.nx-amber{border-left-color:var(--nx-amber)}.nx-prompt.nx-amber b{color:var(--nx-amber)}
.nx-prompt-ring{width:22px;height:22px;border-radius:50%;background:conic-gradient(var(--nx-cyan) calc(var(--p)*360deg),rgba(255,255,255,.12) 0)}
.nx-amber .nx-prompt-ring{background:conic-gradient(var(--nx-amber) calc(var(--p)*360deg),rgba(255,255,255,.12) 0)}
.nx-td{position:absolute;left:0;top:0;display:none}.nx-td b{position:absolute;left:-15px;top:-15px;width:30px;height:30px;border-radius:50%;border:2px solid var(--nx-cyan);display:grid;place-items:center;color:var(--nx-cyan);font-size:16px;box-shadow:0 0 12px var(--nx-cyan);background:rgba(0,0,0,.35)}
.nx-td.chain b{animation:nxpop .4s infinite alternate}.nx-td span{position:absolute;left:-30px;width:60px;top:20px;text-align:center;font-size:12px;letter-spacing:.2em;color:var(--nx-cyan)}
.nx-tutorial{position:absolute;left:50%;bottom:24vh;transform:translateX(-50%);font-size:19px;opacity:0;text-align:center;text-shadow:0 1px 4px #000}.nx-tutorial kbd{font-family:var(--nx-mono);border:1px solid var(--nx-cyan);color:var(--nx-cyan);padding:0 6px;margin:0 3px;font-size:16px}
.nx-toasts{position:absolute;right:3vw;top:30vh;display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.nx-toast{font-size:18px;letter-spacing:.15em;text-transform:uppercase;padding:4px 12px;background:rgba(4,10,14,.55);transition:opacity .5s,transform .5s}.nx-toast.out{opacity:0;transform:translateX(20px)}
.nx-toast.nx-cyan{border-right:3px solid var(--nx-cyan)}.nx-toast.nx-amber{border-right:3px solid var(--nx-amber);color:var(--nx-amber)}.nx-toast.nx-red{border-right:3px solid var(--nx-red)}.nx-toast.nx-white{border-right:3px solid #fff}
.nx-hurt{position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at center,transparent 55%,rgba(150,10,20,.55));--dir:0deg}
.nx-white{position:absolute;inset:0;background:#fff;opacity:0}
.nx-static{position:absolute;inset:0;opacity:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.08) 0 2px,transparent 2px 4px),radial-gradient(circle,rgba(215,199,255,.25),transparent);animation:nxstatic .1s steps(2) infinite}
.nx-lockwarn{position:absolute;left:50%;top:30vh;transform:translateX(-50%);color:var(--nx-red);font-size:22px;letter-spacing:.5em;font-weight:700;opacity:0;border:2px solid var(--nx-red);padding:2px 14px}
.nx-charge{position:absolute;inset:0;opacity:0;background:radial-gradient(circle at center,rgba(255,42,58,.0) 20%,rgba(255,42,58,.45));}
.nx-checkpoint{position:absolute;right:3vw;bottom:22vh;opacity:0;width:26px;height:26px;border:2px solid var(--nx-cyan);border-radius:50%;animation:nxspin 1s linear infinite;border-top-color:transparent}
.nx-skip{position:absolute;right:4vw;bottom:5vh;opacity:0;font-size:14px;letter-spacing:.2em;z-index:35;width:140px}.nx-skip i{display:block;height:2px;background:#fff;width:0;margin-bottom:4px}
.nx-card{position:absolute;inset:0;display:grid;place-content:center;text-align:center;opacity:0;transition:opacity .8s;z-index:36}.nx-card.on{opacity:1}
.nx-card small{font-size:18px;letter-spacing:.6em;opacity:.7}.nx-card h2{font-size:clamp(48px,8vw,110px);margin:.1em 0 0;letter-spacing:.08em;font-weight:700;text-transform:uppercase}
.nx-fade{position:absolute;inset:0;background:#000;opacity:0;z-index:34}
.nx-mech{position:absolute;inset:0}
.nx-mech label{font-size:12px;letter-spacing:.3em;opacity:.8}
.nx-m-armor{position:absolute;left:3vw;bottom:5vh;width:28vw}.nx-m-energy{position:absolute;left:3vw;bottom:calc(5vh + 54px);width:22vw}
.nx-m-bar{height:8px;background:rgba(244,247,255,.12);position:relative;margin-top:4px;--p:1}.nx-m-bar:after{content:'';position:absolute;left:0;top:0;bottom:0;width:calc(var(--p)*100%);background:var(--nx-signal);box-shadow:0 0 8px var(--nx-signal)}
.nx-m-bar.crit:after{background:var(--nx-red);box-shadow:0 0 8px var(--nx-red)}.nx-m-num{font-family:var(--nx-mono);font-size:22px;margin-top:2px}
.nx-m-slots{position:absolute;right:3vw;bottom:5vh;display:grid;gap:6px;width:200px}
.nx-m-slots .slot{border-left:3px solid var(--nx-signal);padding:2px 8px;background:rgba(4,8,12,.5);position:relative;font-size:16px;letter-spacing:.12em}
.nx-m-slots .slot small{position:absolute;right:8px;top:3px;font-family:var(--nx-mono);font-size:13px}.nx-m-slots .slot i{position:absolute;left:0;bottom:0;height:2px;width:calc(var(--p)*100%);background:var(--nx-signal)}
.nx-m-slots .slot.empty{opacity:.35;border-left-color:#777}.nx-m-slots .slot.lost{opacity:.5;border-left-color:var(--nx-red);color:var(--nx-red);text-decoration:line-through}
.nx-m-systems{position:absolute;left:3vw;top:5vh;font-family:var(--nx-mono);font-size:13px;line-height:1.6;letter-spacing:.08em}.nx-m-systems .fail{color:var(--nx-red)}
.nx-m-state{position:absolute;left:50%;bottom:4vh;transform:translateX(-50%);font-size:13px;letter-spacing:.4em;opacity:.6}
.nx-m-alt{position:absolute;right:3vw;top:5vh;font-family:var(--nx-mono);font-size:14px;opacity:.7}
.nx-m-reticle{position:absolute;left:0;top:0;display:none}.nx-m-reticle i{position:absolute;left:-22px;top:-22px;width:44px;height:44px;border:2px solid rgba(244,247,255,.6);border-radius:4px;transform:rotate(45deg)}
.nx-m-reticle.soft i{border-color:var(--nx-signal)}.nx-m-reticle.hard i{border-color:var(--nx-signal);box-shadow:0 0 10px var(--nx-signal);border-width:3px}.nx-m-reticle.manual i{border-style:dashed;border-radius:50%;transform:none}
.nx-m-boss{position:absolute;left:25vw;right:25vw;top:4vh;display:none}.nx-m-boss label{display:block;text-align:center;color:var(--nx-red);font-size:14px;letter-spacing:.5em}
.nx-m-boss-fill{height:6px;background:var(--nx-red);margin-top:6px;box-shadow:0 0 10px var(--nx-red);width:100%}
.nx-boot{position:absolute;inset:0;display:none;background:#000;font-family:var(--nx-mono);color:var(--nx-signal);padding:22vh 18vw;font-size:22px;line-height:1.9;z-index:33}
.nx-boot div{opacity:0;animation:nxin .25s forwards}.nx-boot .rej{color:var(--nx-red)}.nx-boot.flood{animation:nxflood .9s forwards}
@keyframes nxblink{50%{opacity:.35}}@keyframes nxpulse{0%{filter:drop-shadow(0 0 12px var(--nx-cyan))}100%{filter:none}}
@keyframes nxpop{to{transform:scale(1.15)}}@keyframes nxstatic{50%{transform:translateY(2px)}}@keyframes nxspin{to{transform:rotate(360deg)}}
@keyframes nxin{to{opacity:1}}@keyframes nxflood{0%{background:#000}30%{background:#f4f7ff}100%{background:transparent;color:transparent}}
`;
  document.head.appendChild(s);
}
