# Rag Showdown

A 1v1 ragdoll fighting game in the style of classic arcade fighters. Every fighter is one of Element Rag's plain, faceless stickmen, with the same floppy active-ragdoll body and the same UI. What sets each one apart is a set of powers based on the kinds of techniques battle anime is famous for. Every super has a cut-in. A super that lands the knockout plays a **FINISHER** with impact frames (stark black, white and red frames), slow motion and a letterboxed stamp.

It's pure HTML5 and vanilla JS, with no build step and no dependencies. All art is procedural and every sound is synthesized. The UI reuses Element Rag's style: ink panels with cut corners, Rubik, one warm accent, glossy skill badges and the bar transition.

Serve the folder and open `index.html`:

```bash
python3 -m http.server 8000
```

> This replaces the earlier *Body Business* physics prototype, which is still in git history.

## The loop

1. **Arcade** (the main mode): choose a fighter and a difficulty (Easy, Normal or Hard), then win six best-of-three fights. Opponents get stronger each fight, and the last one is a boss on the Crater Plains. If you lose, a 10-second **CONTINUE?** countdown lets you retry that fight.
2. Every win pays **coins**: a base amount that grows up the ladder, plus bonuses for finishers, perfects, Black Sparks, long combos, and the first win of each day (+100). Clearing Arcade pays a clear bonus (more the first time, and more with no continues) and puts a trophy on that fighter.
3. Spend coins on new fighters in **Fighters**. Four are free at the start. Clearing Arcade once unlocks the hidden boss, **Saibo**.
4. **Survival**: one-round fights in a row against stronger and stronger CPUs. You keep your health between fights and heal 35% after each win. Every fifth fight is against Saibo. Your best streak is saved.
5. **Versus**: play against a CPU (level 1 to 8) or a second player on the same keyboard or with a second gamepad. You choose the stage.
6. **Training**: a dummy that can stand, guard, jump or fight back, with optional infinite meter and a full move list.

While you're on the home screen, a CPU-vs-CPU demo fight plays behind the menu.

## Fighting

| | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Move / dash | `A` `D`, tap twice to dash | stick / D-pad | stick |
| Jump | `W` / `Space` | A | flick the stick up / JUMP |
| Guard | hold away from the opponent | hold away | hold away |
| Light · Heavy | `J` · `K` | X · Y | LIGHT · HEAVY |
| Special 1 · 2 | `U` · `I` | B · RB | SPECIAL buttons |
| Super (full meter) | `L` | RT | SUPER |
| Throw | `J`+`K` together, or `O` | LB | (none) |
| Pause | `P` / `Esc` | START | ⏸ |

Player 2 uses the arrow keys with `,` `.` `;` `'` `/` (light, heavy, special 1, special 2, super) and `Enter` to throw, or Numpad `1` `2` `4` `5` `3` `6`.

- **Chains and cancels:** light, light, heavy is a chain that ends in a launcher. Any light or heavy that connects (on hit or block) can be cancelled into a special. Anything can be cancelled into the super. Inputs are buffered for 0.22 s.
- **Juggles:** fighters you knock into the air can be hit again, up to six hits; supers ignore this limit. A fighter who has landed can't be hit, and a fighter getting up is briefly invulnerable. Bodies knocked into a wall hard enough **wall splat**.
- **Guard:** guard by holding away. Normals do no chip damage; specials and supers do. Each block drains the guard gauge under your health bar, and when it empties your guard breaks and you're stunned. Throws can't be guarded.
- **Counter hits:** hitting a fighter during their wind-up does +25% damage and stuns for longer.
- **Black Spark:** a heavy hit has a 13% chance (19% in a combo of three or more hits) to land as a Black Spark: double damage, +25 meter, and black-and-red impact frames.
- **Meter:** you gain meter by dealing and taking damage, and it carries over between rounds. Using a super stops time for a cut-in and gives you a moment of invulnerability as it starts.
- **Impact frames** can be turned off in Settings to reduce flashing. Big hits then dim the screen and show speed lines instead.

## Roster

Every fighter is an Element Rag stickman: a cream, faceless mannequin with wrist bands in the fighter's colour. Fighters wear Element Rag's own headgear: the hero's headband with tails, the caster's hood, the brute's helmet and plates, or the boss crest. A few also have Element Rag's cape. The two sword fighters carry plain energy blades in their colour. There are no anime character designs, and all names and move names are original. Each kit is built around a common anime archetype, not a specific character. In a mirror match, player 2 is drawn a shade darker.

| Fighter | Archetype | Special 1 | Special 2 | Super | Unlock |
| --- | --- | --- | --- | --- | --- |
| **Kaze** (orange) | Ki warrior | Ki Blast | Afterimage Rush: vanish behind the foe and hammer them upward | **Wave Cannon**: a charged two-handed beam; his colour turns gold | free |
| **Ryo** (yellow) | Shinobi; has a double jump | Vortex Palm: a dashing drill strike | Mirror Clones: two clones kick in from both sides | **Storm Star**: an unblockable giant wind star that bursts into a dome of blades | free |
| **Homura** (teal) | Sword dancer; energy blade | Tide Flip: a forward flip slash | River Rush: dash through the foe in ribbons of water | **Solar Coil**: six blink-slashes in fire, then a sun halo | free |
| **Mugi** (pink) | Rubber brawler | Stretch Punch: reaches across the arena | Rapid Barrage | **Titan Fist**: an awakening that turns him white, then slams a giant fist down | free |
| **Kohei** (green) | Rising hero | Air Flick: a shockwave | Volt Kick: a lightning axe kick | **Max Impact**: a punch whose wind blast clears the screen | 300 |
| **Jin** (indigo) | Reaper; wide energy blade | Crescent Wave | Blink Step: blink behind the foe and slash | **Eclipse Crescent**: his body darkens and a giant black and red crescent grinds through the foe | 450 |
| **Aoi** (violet) | Sorcerer | Azure Pull: an orb that pulls the foe in | Crimson Burst: a point-blank blast | **Infinite Expanse**: a domain freezes the foe, then an unblockable Violet Void | 600 |
| **Taro** (silver) | Spirit master | Spirit Rush: his violet spirit's barrage | Spirit Finger: a long poke | **Time Halt**: stops time and barrages the frozen foe; every hit lands at once when time resumes | 800 |
| **Saibo** (red) | Bored hero, the boss | Hundred Fists | Plain Punch | **Final Punch**: one punch that splits the sky | clear Arcade, or 1500 |

**Stages:** Sunset Dojo, Neon Rooftop, Sakura Shrine, Void Rift, Crater Plains (the boss stage) and the Training Room. Infinite Expanse, Solar Coil, Eclipse Crescent and Time Halt each change how the arena looks while they're active.

## Testing

Both test tools drive the real game in headless Chromium with Playwright. Serve the repo on port 8123 first.

```bash
python3 -m http.server 8123
```

```bash
NODE_PATH=$(npm root -g) node tools/soak.js 2
```

```bash
NODE_PATH=$(npm root -g) node tools/flow.js
```

- `tools/soak.js` runs CPU-vs-CPU matches for every pairing (the number is how many times to repeat each pairing) at 16x speed, rendering as it goes. It fails on any thrown error, NaN or escaped body, a round that never ends, a match that doesn't finish, or a broken HP or meter value. It also prints win rates per fighter as a balance check.
- `tools/flow.js` clicks through the menus like a player:
  - an Arcade run to the clear, checking that Saibo unlocks and coins are paid;
  - a lost fight, then Continue, then Give Up;
  - Survival, checking that the best streak is saved;
  - local 2-player Versus, checking that each key set moves its own fighter;
  - Training with every pause option;
  - Settings;
  - buying a fighter.

Latest results: the soak ran 153 matches (369 rounds) with no issues, and win rates fell between 0.31 and 0.66 per fighter. All flow checks passed. The game was also checked at iPhone landscape size, with touch input.

## Project layout

```
index.html
css/style.css     Element Rag's UI base, plus fighter select, fight HUD and touch pad
js/util.js        math, seeded RNG, glow cache (from Element Rag)
js/icons.js       UI and move icons (from Element Rag)
js/audio.js       synthesized SFX and a step-sequencer fight soundtrack
js/rag.js         Rag: Element Rag's active ragdoll and stickman drawing, plus a pose library
                  with IK, hitstun, knockdowns, getting up, hurtboxes and energy blades
js/fx.js          particles, rings, arcs, slash trails, hit stars (from Element Rag, extended)
js/fighters.js    roster: normals, specials and scripted supers as data + hooks; stages
js/game.js        rounds and timer, move runtime, hits / guard / juggles / Black Spark,
                  projectiles, beams, fields, clones and stands, cut-ins, impact frames,
                  finishers, camera, rendering
js/stage.js       procedural parallax stages and portraits drawn from a posed ragdoll
js/input.js       keyboard (2 sets), gamepads, touch; HumanCtrl with dashes and throws
js/ai.js          CPU fighters, levels 1-9
js/save.js        localStorage progress and settings
js/ui.js          home + demo, select / shop, Arcade, Versus, Survival, Training, sheets, HUD, touch
js/main.js        boot, loop, key routing
tools/            headless soak and UI flow tests
assets/fonts/     Rubik (SIL Open Font License)
```
