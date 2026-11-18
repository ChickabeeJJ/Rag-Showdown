# Rag Showdown

A 1v1 ragdoll fighting game in the style of classic arcade fighters. All 16 fighters are Element Rag's plain, faceless stickmen, with the same floppy active-ragdoll body and the same UI. What sets each one apart is a set of powers based on the kinds of techniques battle anime is famous for. Every super opens with a comic-panel cut-in. A super that lands the knockout plays a **FINISHER**: impact frames (stark black, white and red frames), slow motion and a letterboxed stamp.

It's pure HTML5 and vanilla JS, with no build step and no dependencies. All art is procedural and every sound is synthesized.

Serve the folder and open `index.html`:

```bash
python3 -m http.server 8000
```

> This replaces the earlier *Body Business* physics prototype, which is still in git history.

## Straight into the action

- **First launch:** you skip the menus and land in level 1-1, which is a real fight. A guide at the top of the screen (the same panel as Element Rag's tutorial) teaches one control at a time while you fight: move, jump, light attack, heavy attack, a light-light-heavy combo, a special, guarding against a sparring partner (the key shown is whichever one points away from them, and it flips if you swap sides), and your super. Nobody can be knocked out during the lesson. Once it ends, the round becomes a normal fight. The lesson can be skipped, and it only ever runs once.
- **After that, tips appear as you go,** each shown once, the first time it matters. They cover:
  - super ready;
  - dashing;
  - cancelling into specials;
  - your guard cracking;
  - getting knocked down;
  - throwing a guarding opponent;
  - Black Spark.
- **Cinematic camera:** the camera opens each round with a pan across both fighters while their names come up, follows a juggle up into the air, and jolts and tilts on big hits. Black bars slide in during supers. Boss levels open with a longer intro pan.
- **PLAY** on the home screen drops you straight into your next level, with no select screen or VS screen.
- **The guide is forgiving:** any press of A or D counts as moving, and an attack counts whether or not it lands. Each control only has to be used once.

## Levels

The campaign follows Element Rag's stage map: 8 chapters of 6 levels, one per stage. The **Levels** screen shows chapter tabs, cards with stars and twist badges, and the boss highlighted.

- **Levels are fast, like Element Rag's.** Each is one round against 1 to 3 foes in **waves**. When one is knocked out, the next drops in from above right away. Your health carries over, with a small heal between waves, and the dots under the timer show your progress. Level 6 of each chapter is a single **boss** with extra health.
- **Quick to continue:** **Enter** or **Space** takes the main button on a result screen (NEXT LEVEL, RETRY or RESUME). Moving from level to level uses a short transition.
- **Stars** come from the health you have left (3 stars at 70% or more, 2 at 35% or more). Replaying a level can raise its stars.
- **Recruits:** beating the fighter marked RECRUIT adds them to your roster, so the cast grows as you play. They can also be unlocked early with coins.
- **Twists:** most levels change one rule, so neighbouring fights never play alike:
  - Giant Foe;
  - Low Gravity;
  - Super Clash (both meters full);
  - Iron Will (+50% foe health);
  - Frenzy (faster);
  - Glass Cannon (everyone hits twice as hard);
  - Beat the Clock (win in 75 s).
- **Coins** come from:
  - first clears and new stars;
  - finishers and Black Sparks;
  - the first win of each day (+100).

Other modes:
- **Versus:** against a CPU (level 1-8) or a second player on the same keyboard or a second gamepad.
- **Survival:** endless fights. You keep your health and heal between wins.
- **Training:** a dummy that can stand, guard, jump or fight, with infinite meter.

## Controls

| | Mouse + keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Move / dash | `A` `D`, tap twice to dash | stick / D-pad | stick |
| Jump | `W` / `Space` | A | flick the stick up / JUMP |
| Guard | hold away from the opponent | hold away | hold away |
| Light attack | **left click** | X | LIGHT |
| Heavy attack | **right click** | Y | HEAVY |
| Special 1 · 2 | `Q` · `E` | B · RB | SP 1 · SP 2 |
| Super (full meter) | `F` or middle click | RT | SUPER |
| Throw | left + right click together | LB | (none) |
| Pause | `P` / `Esc` | START | ⏸ |

The skill bar at the bottom of the screen always shows these: mouse icons for light and heavy, then each special and the super, each with its key. Player 2 in Versus uses the arrow keys with `,` `.` `;` `'` `/` (light, heavy, special 1, special 2, super) and `Enter` to throw, or Numpad `1` `2` `4` `5` `3` `6`.

- **Combos follow Street Fighter's frame data:**
  - A grounded normal's hitstun is whatever is left of the attacker's swing plus a fixed **advantage**. A jab leaves you slightly ahead, so it **chains** into the next button while it's still out, but pressing it again from neutral is too slow to combo. The second light leaves you slightly behind, so mashing after a string lets the opponent jab you first. Blocked normals always leave the attacker behind, heavies most of all.
  - Chains only go up in strength, Marvel vs. Capcom style: light, light, then heavy (the fighter's own **combo ender**). The ender can be cancelled into a special or jump-cancelled into the air, and anything into the super.
  - Mashing light gives two hits, then the string ends. Light, light, heavy combos for every fighter.
  - Every hit pushes the opponent back. In the corner, the push goes back onto the attacker instead.
  - **Air combos:** after the ender launches the foe, press **W** right away to jump after them. Air attacks home in on a juggled foe: light, light, then heavy spikes them into the floor. They bounce **once per combo**, so you can keep going.
  - **Hitstun deterioration:** the longer a combo runs, the less stun each hit adds and the less damage it does, until it drops.
  - The hit counter grades long combos (NICE, GREAT, AMAZING, SHOWDOWN) and shows the combo's damage. When a special starts, its name pops up over your head.
- **CPU defence:** after being hit or blocking, CPU fighters keep holding guard or answer with a quick jab, like a person would. Stronger CPUs do it more often.
- **Safety net:** a move used a third time in one combo makes the victim **BREAK!** free, in case anything still loops.
- **Clashes:** if two normal attacks hit each other on the same frame, they **CLASH!** and both fighters bounce apart instead of trading hits.
- **Juggles:** a fighter knocked into the air can be hit up to nine times; supers ignore that limit. A fighter lying on the ground can't be hit, but there's no immunity once they're back on their feet, so pressure them as they get up. A hard enough hit into a wall makes a **wall splat**.
- **Guard:** normal attacks do no chip damage when guarded, but specials and supers do. Each block drains the guard gauge under your health bar. When it empties, your guard breaks and you're stunned. Throws can't be guarded.
- **Black Spark:** a heavy hit has a 13% chance to crit for double damage and +25 meter, with black-and-red impact frames.
- **Impact frames** can be turned off in Settings to reduce flashing.

## Fighters

**Bodies and looks.** Every fighter is still Element Rag's cream, faceless mannequin, but each is dressed so no two read alike: their own hair (tuft, ponytail, buns, topknot, mohawk, long hair), clothes (gi pants and belt, robe, hakama, jacket, vest, hoodie, boxing trunks) and details (masks, a visor, goggles, horns, prayer beads, gloves, wraps, boots). Scarves, capes, hair and coat tails are small physics chains that swing with every move. Everything is generic martial-arts and street wear built from simple shapes. No anime character's design is copied.

**Hair and headwear** all grow out of one scalp cap that follows the head's outline, so spikes, crests, buns, horns, hoods and goggle straps stay attached to the head from every angle. Hoods are proper cowls open at the face. **Mugi** has a lighter, feminine build: a narrower waist, wider hips, slimmer limbs and a soft chest line, with buns and bangs.

**Health.** Every fighter has 2.4 times the health of earlier builds, and in levels and Survival you get another 30% on top, so a fight lasts several combos instead of one. Timers were lengthened to match (wave refills to 80 s, Beat the Clock is 75 s). In levels and Survival the CPU also plays a little softer: about 15% below its listed level, and its hits do 12% less damage.

**Stances and motion.** Each fighter has a stance that suits them: karate, ninja, boxer, kung fu, swordsman, brawler, monk, soldier and more. Stances breathe, shift weight, and bounce on the balls of the feet (boxers). Walking is a fighting-game shuffle with planted feet that don't slide, a forward lean going in, and a tight guard going back. A hit reacts to where it lands: a head hit snaps the head back, a body hit doubles them over, a low hit buckles the knees. Knees and elbows only bend one way, even when limp. A knocked-down fighter pushes up off one knee to stand.

Every fighter is an Element Rag stickman: a cream mannequin with wrist bands in their colour and Element Rag's own headgear (headband with tails, hood, helmet and plates, or boss crest). Some wear Element Rag's cape, and sword fighters carry plain energy blades. There are no anime character designs, and all names and move names are original. Each kit is built around a common anime archetype, not a specific character.

Specials are keyframed with wind-up, strike and follow-through, and include full-body flips and spins. Energy gathers at the hand during the wind-up, and a burst marks the release.

Each fighter's light-light-heavy **combo ender**:

| Fighter | Ender |
| --- | --- |
| Kaze | Ki Uppercut |
| Ryo | Shadow Spin Kick |
| Homura | Rising Tide |
| Mugi | Rubber Whip Upper |
| Kohei | Volt Upper |
| Blaze | Fire Spin Kick |
| Zen | Triple Rise |
| Jin | Crescent Upper |
| Kensei | Seven Star Strike (plants marks) |
| Ripper | Saw Uplift |
| Aoi | Red Flick (a wall-splat blast) |
| Taro | Spirit Upper |
| Shige | Psi Pop |
| Monarch | Shadow Rise |
| Goro | Titan Hammer (ground bounce) |
| Saibo | Casual Upper |

| Fighter | Archetype | Special 1 | Special 2 | Super | Joins |
| --- | --- | --- | --- | --- | --- |
| **Kaze** | Ki warrior | Ki Blast (palms cupped at the hip, then thrust) | Afterimage Rush (vanish, front-flip axe kick) | **Wave Cannon** beam | start |
| **Ryo** | Shinobi, double jump | Vortex Palm drill | Mirror Clones | **Storm Star**, unblockable | start |
| **Homura** | Sword dancer | Tide Flip (full flip slash) | River Rush | **Solar Coil** | start |
| **Mugi** | Rubber brawler | Stretch Punch | Rapid Barrage | **Titan Fist** | start |
| **Kohei** | Rising hero | Air Flick | Volt Kick (flip, then axe kick) | **Max Impact** | recruit 1-3 |
| **Blaze** | Fire soldier | Flame Kick (spinning fire wave) | Jet Boost (air dash kick) | **Inferno Meteor** | recruit 1-6 |
| **Zen** | Three-sword style | Tornado Slash | Triple Cross | **Nine Phantom Cuts** (sheathes, then the cuts land) | recruit 2-3 |
| **Jin** | Reaper | Crescent Wave | Blink Step | **Eclipse Crescent** | recruit 2-6 |
| **Kensei** | Pressure point master | Hundred Crack Fists | Pressure Point (plants timed marks that burst) | **Already Done** (walks away, then the foe bursts) | recruit 3-3 |
| **Ripper** | Saw devil | Saw Disc (rolls along the floor) | Chain Hook (yanks the foe in) | **Revving Rampage** (carries the foe on the saws) | recruit 3-6 |
| **Aoi** | Sorcerer | Azure Pull | Crimson Burst | **Infinite Expanse** (a domain, then Violet Void) | recruit 4-3 |
| **Taro** | Spirit master | Spirit Rush | Spirit Finger | **Time Halt** | recruit 4-6 |
| **Shige** | Psychic | Psi Lift (lift and slam) | Psi Barrier (reflects projectiles) | **Psychic 100%** | recruit 5-3 |
| **Monarch** | Shadow summoner | Shadow Soldier | Shadow Grasp (hands rise under the foe) | **Army of Shadows** | recruit 5-6 |
| **Goro** | Titan shifter | Quake Stomp | Titan Grab (command grab) | **Colossus Form** (grows giant) | recruit 6-6 |
| **Saibo** | Bored hero (boss) | Hundred Fists | Plain Punch | **Final Punch** | recruit 8-6 |

## Stages

The arena is about 2,300 units wide, half again as wide as before. The camera pans across it and zooms out a little as the fighters separate. As in Street Fighter, the screen is the leash: fighters on their feet can't walk further apart than the camera can frame.


Eight stages, built like Element Rag's backdrops. Each has far, mid and near layers pre-rendered with haze between them, and the far layers are softer, like depth of field. Buildings, trees and rocks are shaded and catch a rim of light, and props have soft contact shadows, so nothing floats. On top of that, each frame adds:

- the sky and its light;
- animated details;
- floor reflections;
- weather;
- a soft foreground frame;
- a per-stage colour grade with a vignette.

| Stage | Highlights |
| --- | --- |
| Neon Rooftop | Rebuilt as a rainy night city: stepped towers with lit window grids, rooftop water tanks and masts, a lattice tower, flickering neon signs with made-up glyphs, an LED screen, and a train on an elevated line. The roof is wet concrete, and the signs reflect in it. |
| Neon Rooftop: rain | Realistic rain in three depths. Fine, faint far rain; mid rain; and long bright streaks in front of the fighters. It falls at an angle in the wind, with crown splashes, ripples in puddles and ground mist, plus occasional lightning that flashes the sky before the thunder. |
| Sunset Dojo | A hall on a stone plinth with tiled roofs, lit shoji and swaying lanterns. A fence and stone lanterns stand on the ground, and sun rays shine through. |
| Sakura Shrine | A shaded torii on stone steps, branching cherry trees with lit blossom clusters, a snow-capped volcano and stone lanterns. |
| Bamboo Grove | Rounded, shaded stalks with leaves, curved grass, god rays, drifting mist and fireflies. |
| Frost Peak | Aurora curtains, a snow cap on every peak, snow-laden pines, faceted ice crystals and snow banks. |
| Void Rift | A glowing tear in the sky, shaded floating isles with crystal clusters, a lit ringed planet, and pillars with pulsing runes. |
| Crater Plains | An erupting volcano with lava channels and smoke, rim-lit spires, ruined arches with rubble at their feet, and lava cracks. |
| Grand Arena | A roof truss with spotlights, tiered stands packed with a crowd, camera flashes, a hanging VS screen, and banners on the ring wall. |

## UI on every screen

- The whole interface is laid out for 1280x720 and scaled to the window, so it looks the same on a phone, a tablet, a laptop or a 4K monitor. Phones get a little extra size so text stays readable.
- **Touch controls** are sized in real pixels for thumbs, not scaled with the UI, with generous gaps between them. The right-hand cluster is two neat rows (LIGHT, HEAVY and JUMP on the bottom; SP 2, SP 1 and SUPER above), with labels inside the buttons so nothing overlaps or runs off the screen. On touch screens the camera keeps the fighters above your thumbs.
- On short screens the guide shrinks to a compact card, the level map shows all six levels in one row, and the fighter select shows all 16 fighters and the FIGHT button without scrolling.

- While a panel is open (pause, results, the versus card), the fight HUD and touch buttons step aside so nothing pokes out around it. In a fight, toasts sit low in the middle, and the level chip, guide and tips each have their own row.
- On the home screen, the background fight is framed in the part of the screen the menu doesn't cover.

**Less friction:**
- Any button during a round intro skips straight to FIGHT!.
- After a win, NEXT LEVEL fills up and starts the next level by itself after five seconds (eight after a recruit). Touching the panel or pressing a key cancels it.
- `R` retries from a result screen, and `Enter` takes the highlighted button.
- Tapping a level on the map starts it straight away.
- Tips and combo counters from the last fight are cleared before the next one.

## Testing

All three test tools drive the real game in headless Chromium with Playwright. Serve the repo on port 8123 first.

```bash
python3 -m http.server 8123
```

```bash
NODE_PATH=$(npm root -g) node tools/soak.js 1
```

```bash
NODE_PATH=$(npm root -g) node tools/flow.js
```

```bash
NODE_PATH=$(npm root -g) node tools/exploit.js
```

- `tools/soak.js` runs CPU-vs-CPU matches for every pairing of the 16 fighters, at 16x speed, across all stages and every twist. It fails on:
  - errors;
  - NaN positions or bodies escaping the arena;
  - stuck rounds or matches that never finish;
  - broken HP or meter values.

  It also prints win rates per fighter.
- `tools/exploit.js` hunts for broken combos. For every fighter it mashes patterns (light only, heavy only, light-heavy, light-light-heavy, chains into specials, jump-ins, specials, throws) against a dummy that never fights back and reports the longest combo each pattern gets. It fails if mashing light combos more than two hits, or if light, light, heavy doesn't combo. It then mashes light against a real CPU for 20 seconds per fighter and checks the CPU blocks or jabs back between strings. Finally it fuzzes random inputs and fails on:
  - NaN positions or bodies escaping the arena;
  - fighters left invisible or at the wrong size after a move;
  - fighters stuck unable to act.
- `tools/flow.js` plays like a new player, with real mouse clicks and keys:
  1. It boots straight into level 1-1 and completes every step of the guide.
  2. It clears levels and checks stars and coins.
  3. It loses a level and retries it, and recruits a fighter.
  4. It checks the level map, including that locked levels give a message.
  5. It checks that PLAY goes straight into the fight.
  6. It plays 2-player Versus, Survival, and Training with every pause option, and buys a fighter.

Latest results: mashing light tops out at 2 hits for every fighter, against a dummy or a CPU. Light, light, heavy combos for all 16. The fuzz found no issues. The soak ran 256 matches (631 rounds) across all stages and twists with no issues. All flow checks passed. The UI was checked at desktop, iPhone and Android landscape, and iPad sizes.

## Project layout

```
index.html
css/style.css     Element Rag's UI (panels, tiles, stage map, tutorial, coach), plus fight HUD and touch pad
js/util.js        math, seeded RNG, glow cache (from Element Rag)
js/icons.js       UI and move icons (from Element Rag)
js/audio.js       synthesized SFX and a step-sequencer fight soundtrack
js/rag.js         Element Rag's active ragdoll and stickman drawing, pose library with IK,
                  whole-body spins, hitstun, knockdowns, getting up, hurtboxes, blades
js/fx.js          particles, rings, arcs, slash trails, hit stars (from Element Rag, extended)
js/fighters.js    16 fighters: normals, keyframed specials and scripted supers; stage list
js/campaign.js    chapters, levels, twists, recruits, stars
js/game.js        rounds, move runtime, hits / guard / juggles / Black Spark, projectiles, beams,
                  fields, minions, marks, barriers, cut-ins, impact frames, finishers, camera
js/stage.js       layered parallax stages, weather, portraits
js/input.js       mouse + keyboard (2 sets), gamepads, touch
js/ai.js          CPU fighters, levels 1-9
js/save.js        localStorage progress and settings
js/ui.js          home + demo, levels, guide and tips, select / shop, Versus, Survival, Training, HUD
js/main.js        boot, loop, input routing
tools/            headless soak, exploit and UI flow tests
assets/fonts/     Rubik (SIL Open Font License)
```
