# Rag Showdown

A 1v1 ragdoll fighting game in the style of classic arcade fighters. All 19 fighters are Element Rag's plain, faceless stickmen, with the same floppy active-ragdoll body and the same UI. What sets each one apart is a set of powers based on the kinds of techniques battle anime is famous for. Every super opens with a comic-panel cut-in. A super that lands the knockout plays a **FINISHER**: impact frames (stark black, white and red frames), slow motion and a letterboxed stamp.

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
- **Cinematic camera:** rounds start straight away (no character introductions). The camera follows a juggle up into the air, and jolts and tilts on big hits. Black bars slide in during supers.
- **Victory celebrations:** the winner performs a short routine that suits their style: a fist-pump leap (karate, boxers, brawlers), a backflip into a low pose (ninjas, sword fighters, kung fu), floating up in a flare of aura (mystics, monks), a roar, flex and chest beat (Goro, Ripper), or a stretch and a wave (Saibo). Confetti in their colours, a landing shockwave, a slow camera push-in, and the winner's name big and dead centre over a gold "WINS" plate ("PERFECT WIN" at full health).
- **PLAY** on the home screen drops you straight into your next level, with no select screen or VS screen.
- **The guide is forgiving:** any press of A or D counts as moving, and an attack counts whether or not it lands. Each control only has to be used once.

## Levels

The campaign follows Element Rag's stage map: 8 chapters of 6 levels, one per stage. The **Levels** screen shows chapter tabs, cards with stars and twist badges, and the boss highlighted.

- **Levels are fast, like Element Rag's.** Each is one round against 1 to 3 foes in **waves**. When one is knocked out, the next drops in from above right away. Your health carries over, with a small heal between waves, and the dots under the timer show your progress. Level 6 of each chapter is a single **boss** with extra health.
- **Quick to continue:** **Enter** or **Space** takes the main button on a result screen (NEXT LEVEL, RETRY or RESUME). Moving from level to level uses a short transition.
- **Stars** come from the health you have left (3 stars at 70% or more, 2 at 35% or more). Replaying a level can raise its stars.
- **Recruits:** beating the fighter marked RECRUIT adds them to your roster, so the cast grows as you play. They can also be unlocked early with coins.
- **Coin exclusives:** Zen, Ripper, Monarch, Goro and Saibo never join through levels. They can only be bought with coins, and wear a gold price tag on the select screen.
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
- **Ascent** (replaces CPU Versus): a climb, one round per floor against the CPU on a random stage. ASCENT starts at once with the fighter you already picked (the button shows which); change fighter from the home screen first.
  - Your health and meter carry over. You heal 25% after each floor and 50% after a boss. The heal is shown, not hidden: the cleared sheet shows your health before and after, and the next floor opens with your bar visibly refilling under a **+X% HEALTH** popup.
  - After every win you pick **1 of 3 cards**: powers that last for the run. Cards come in four rarities, and rarer cards are stronger and stranger. Deeper floors and boss rewards tilt the draw toward rarer cards.

    | Rarity | Look | Cards |
    | --- | --- | --- |
    | Common | matte, grey edge | Berserker, Iron Skin, Overcharge, Quick Hands, Fleet, First Aid (heal 35% now), Pocket Change (+40% coins) |
    | Rare | blue, a sweep of light | Vampiric, Regeneration, Black Sparks, Iron Guard, Primed, Thorns, Adrenaline, Featherweight (jump higher, float down) |
    | Epic | violet glow, turning rays | Second Wind, Glass Cannon, Momentum, Aftershock (heavies echo with a shockwave), Double Tap (super refunds meter) |
    | Legendary | gold foil, spinning gold edge, holographic sheen, sparkles, glow | Phoenix (rise from a knockout once per run), Midas Touch (every hit throws out a coin), Giant Form, Chain Lightning, Infinite Ki |

  - Cards are built like collectibles:
    - a rarity banner, with rays and halftone in the rarity colour;
    - the power's icon and its category (HEAL, COMBO, POWER and so on);
    - a ribbon name plate.

    They tilt toward your pointer with a glare that follows it, and epic cards get their own turning violet edge.
  - Every fifth floor is a **boss** with more health, a bigger body and a 60-coin bonus.
  - When you fall, a summary shows floors cleared, your cards and coins earned. CLIMB AGAIN is one press away. Your best floor is saved.
- **Survival:** endless fights. You keep your health and heal 35% between wins (45% after a super finish), with a full-health breather every fifth win.
- **Training:** a dummy that can stand, guard, jump or fight, with infinite meter. Each fighter has five **trials** that teach the combo system (finisher, cancel into a special, air combo, a 5-hit combo, super in a combo). Each pays 40 coins the first time.

**Upgrades.** Open FIGHTERS and spend coins on four upgrade tracks per fighter, 5 ranks each (60, 140, 240, 360 and 500 coins):

| Track | Per rank |
| --- | --- |
| Power | +4% damage |
| Vitality | +6% health |
| Focus | +8% super meter gain |
| Recovery | 6% shorter special cooldowns |

Upgrades apply in levels, Survival and Ascent, but not in Training. A fighter's total rank shows on their tile. The full design is in `docs/GAMEPLAY_PLAN.md`.

## Coming back for more

- **Daily missions:** three goals each day, such as "Land 5 combo finishers", "Win 2 fights with Jin" or "Clear 4 Ascent floors".
  - Each mission pays 60 to 110 coins, and claiming all three opens a 150-coin daily chest.
  - The home screen shows your progress and a badge when a reward is waiting.
  - Missions count in Levels, Ascent and Survival, and refresh at midnight UTC.
- **Fighter mastery:** every fighter levels up from 1 to 20 as you play them.
  - Every fight earns XP: more for a win, and extra for finishers, long combos and Black Sparks.
  - Each level pays coins, and levels 5, 10, 15 and 20 earn a title: Adept, Expert, Master, Grandmaster.
  - Mastery shows on the home screen, on result sheets and in the fighter's profile.

## Events

Each limited-time event runs for 35 days (a month and a bit), starting on a Monday at 00:00 UTC, then the next takes over, rotating through three. Each has its own exclusive fighter, three skins and its own token.

| Event | Stage | Token | Exclusive fighter | Skins |
| --- | --- | --- | --- | --- |
| Sakura Festival | Sakura Shrine | Petals | **HANA**, Petal Dancer | Kaze Blossom Gi, Mugi Festival Yukata, Homura Blossom Haori |
| Frost Moon | Frost Peak | Snowflakes | **KORI**, Frost Warden | Ryo Snow Shinobi, Aoi Glacier Robe, Goro Mountain Yeti |
| Neon Nights | Neon Rooftop | Neon Chips | **RAVE**, Neon DJ | Jin Neon Reaper, Kohei Synthwave, Saibo Chrome Cape |

- **Tokens:** every fight in Levels, Ascent and Survival pays tokens (more for wins, finishers and long combos). **Event Battles** on the event's stage pay double. Every third Event Battle is against the exclusive fighter, as a challenger. The other foes often wear the event's skins.
- **Event pass:** a 40-tier battle pass, 100 tokens a tier, paced for a month of play.
  - Rewards: a skin at tiers 10, 20 and 30, a coin chest at tiers 5, 15, 25 and 35, mastery XP for the fighter you play every third tier, coins in between, and the **exclusive fighter** at tier 40.
  - Over the whole pass: about 6,100 coins, about 2,200 mastery XP, three skins and the fighter.
  - The hero shows your tier and progress to the next; the strip marks claimed, ready, current (with its own progress bar) and locked tiers, and milestones are wider. **CLAIM ALL** takes everything that's ready (coins and XP add into one toast; a skin or the fighter still gets its reveal). Claimed skins are equipped at once.
  - Fights pay a little more to match: 20 for a win, 6 for a loss, plus finishers and combo length, up to 42 (double in Event Battles).
  - Saves from the old 7-tier track carry over: skins, the fighter and the coins already claimed stay claimed on the matching tiers.
- **Challenges:** five per event, such as "Win 10 Event Battles", "Land 40 combo finishers" and "Win 10 fights on Sakura Shrine", for bonus tokens.
- **Daily check-in:** tokens every day, growing with your streak (20, then up to 50).
- **Coming back:** the home screen shows the live event with its countdown, progress and a badge when something is waiting. The event screen teases the next event and its fighter as a silhouette. Exclusive fighters can't be bought; one you missed returns when its event comes back around (every 105 days), and FIGHTERS shows when.
- **Skins:** a SKINS tab in FIGHTERS shows every outfit for a fighter: wear it, or see which event it comes from. Fighters wear their equipped skin in fights, previews, portraits and the versus card. Each event's skins have their own effects, hit sparks and victory routine:
  - **Sakura:** a sakura hairpin, petals circling and drifting off the shoulders (a shower when celebrating), and petal hit bursts.
  - **Frost:** ice crystals grown on the shoulders, frost-glowing fists, cold breath, snow kicked up at the feet, and ice-shard hits.
  - **Neon:** LED strips glowing along every limb, a visor light, neon afterimage trails on fast moves, and pink and cyan ring hits.
- **One accent colour:** every completion tick, claimed tier, ready mission and notification badge uses the game's gold, so nothing on the menus is green. Green is kept only for healing in fights.
- **Cinematic hero scenes** (`js/evscene.js`): each event's banner is a layered, animated scene framed on the fighter, drawn like a film plate:
  - **Sakura Festival:** golden hour on the shrine hill. A setting sun off the fighter's shoulder throws light shafts across pink hills that fade into haze, with a torii on the far ridge, a blossom bough framing the corner, and petals tumbling at three depths.
  - **Frost Moon:** a clear arctic night. Stars, a huge moon with a halo behind the fighter, aurora ribbons rolling across the sky, snow peaks lit on the moon side, a pine line, drifting ground mist, snow at three depths and the odd ice glint.
  - **Neon Nights:** a rooftop rave. A striped synth sun, two skylines with lit windows and neon roof edges, flickering neon signs, sweeping searchlights, a perspective floor that pulses on the beat, rising bokeh and fine rain.
  - Each has a slow camera drift with parallax between layers, a colour grade that keeps the title side dark and readable, and a rim light on the fighter in the event colour. Static layers are painted once; only light and particles draw per frame (about 0.2 ms for sakura and neon, 1.4 ms for frost, whose aurora renders at quarter resolution). It stops when you leave the screen and holds a still frame with reduced motion.
- **The UI:** a compact live event card in the bottom-right corner of the home screen, clear of the menu and the demo fight; Event Battles cut straight into the fight. On the event screen, a themed hero banner (drifting petals, falling snow or a neon grid) with the exclusive fighter, who faces the title in a hero pose. Each fighting style has its own showcase pose for menu and reward art (a tall, planted stance with signature hands instead of the crouched fight guard). Reward tiers are connected by a progress line, and the top tier has a spinning edge. Every panel has an outline that follows its slanted corners. Skin and fighter rewards get their own reveal.

**The event fighters**

| Fighter | Specials | Super | Finisher |
| --- | --- | --- | --- |
| HANA | Petal Fan (five cutting petals); Blossom Veil (a counter stance: strike her inside it and she vanishes behind you with a rising kick) | Thousand Petal Storm: a pulling petal vortex, then a burst | Spring Gale (close) |
| KORI | Icicle Lance (freezes on hit); Frost Pillar (frost marks the ground under the foe, then an ice pillar erupts) | Absolute Zero: freezes the foe in a block of ice, then shatters it | Glacier Upper (close) |
| RAVE | Bass Drop (a wave rolling along the floor); Beat Dash (three hits on the beat) | Drop The Beat: speaker stacks, a floor equaliser and four bass pulses, the last one the drop | Sonic Boom (ranged) |

Each has their own stance, normals (fan dance, frost fists, beat boxing) and hit sparks.

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

The skill bar at the bottom of the screen shows your two specials with their keys and cooldowns; the super has its own meter in the corner. There is no two-player mode.

- **Combos follow Street Fighter's frame data:**
  - A grounded normal's hitstun is whatever is left of the attacker's swing plus a fixed **advantage**. A jab leaves you slightly ahead, so it **chains** into the next button while it's still out, but pressing it again from neutral is too slow to combo. The second light leaves you slightly behind, so mashing after a string lets the opponent jab you first. Blocked normals always leave the attacker behind, heavies most of all.
  - Chains only go up in strength, Marvel vs. Capcom style: light, light, then heavy (the fighter's own **combo ender**). The ender can be cancelled into a special or jump-cancelled into the air, and anything into the super.
  - Mashing light gives two hits, then the string ends. Light, light, heavy combos for every fighter.
  - Every hit pushes the opponent back. In the corner, the push goes back onto the attacker instead.
  - **Air combos:** after the ender launches the foe, press **W** right away to jump after them. Air attacks home in on a juggled foe: light, light, then heavy spikes them into the floor. They bounce **once per combo**, so you can keep going.
  - **Hitstun deterioration:** the longer a combo runs, the less stun each hit adds and the less damage it does, until it drops.
  - The hit counter grades long combos (NICE, GREAT, AMAZING, SHOWDOWN) and shows the combo's damage. When a special starts, its name pops up over your head.
- **Combo breaks:** a CPU can't be juggled forever. After a long combo, a CPU breaks out. It recovers mid-air, jumps clear and blows you back a step, with a **BREAK!** shockwave. Stronger CPUs break sooner: about 9 hits at level 1 and 6 at level 9. Supers can't be broken, and a CPU that has just broken can't do it again for about 9 seconds, so long combos still pay.
- **CPU defence:** after being hit or blocking, CPU fighters keep holding guard or answer with a quick jab, like a person would. Stronger CPUs do it more often.
- **Safety net:** a move used a third time in one combo makes the victim **BREAK!** free, in case anything still loops.
- **Clashes:** if two normal attacks hit each other on the same frame, they **CLASH!** and both fighters bounce apart instead of trading hits.
- **Juggles:** a fighter knocked into the air can be hit up to nine times; supers ignore that limit. A fighter lying on the ground can't be hit, but there's no immunity once they're back on their feet, so pressure them as they get up. A hard enough hit into a wall makes a **wall splat**.
- **Guard:** normal attacks do no chip damage when guarded, but specials and supers do. Each block drains the guard gauge under your health bar. When it empties, your guard breaks and you're stunned. Throws can't be guarded.
- **Black Spark:** a heavy hit has a 13% chance to crit for double damage and +25 meter, with black-and-red impact frames.
- **Impact frames** can be turned off in Settings to reduce flashing.

## Fighters

**Bodies and looks.** Every fighter is still Element Rag's cream, faceless mannequin, but each is dressed so no two read alike: their own hair (tuft, ponytail, buns, topknot, mohawk, long hair), clothes (gi pants and belt, robe, hakama, jacket, vest, hoodie, boxing trunks) and details (masks, a visor, goggles, horns, prayer beads, gloves, wraps, boots). Scarves, capes, hair and coat tails are small physics chains that swing with every move. Everything is generic martial-arts and street wear built from simple shapes. No anime character's design is copied.

**Hair and headwear** all grow out of one scalp cap that follows the head's outline, so spikes, crests, buns, horns, hoods and goggle straps stay attached to the head from every angle. Hoods are proper cowls open at the face. **Mugi** has a lighter, feminine build: a slightly narrower waist, wider hips, slimmer limbs and a soft chest line built into her outline, with buns and bangs. Sleeveless tops on everyone else run over the shoulder and end in a clean cap. Sword fighters carry proper katanas: a gently curved blade with a glowing edge, a round guard and a wrapped hilt.

**Fighting styles.** Every fighter's light, light and heavy come from their style, so no two hit alike:

| Style | Fighters | Light, light, heavy |
| --- | --- | --- |
| Karate | Kaze | straight punch, reverse punch, roundhouse |
| Ninja | Ryo | knife hand, palm strike, hook kick |
| Mystic | Aoi | palm spark, flick, force push |
| Sword | Homura | iaido slash, rising slash, piercing thrust |
| Reaper | Jin | low reap, high reap, overhead cleave |
| Rubber brawler | Mugi | stretch jab, rubber hook, stomp kick |
| Boxer | Kohei | jab, straight, overhand |
| Monk | Taro | palm, elbow, twin palm |
| Casual | Saibo | lazy jab, jab, normal punch |
| Feral | Ripper | claw, backhand claw, saw lunge |
| Regal | Monarch | backhand, royal palm, shadow rise |
| Giant | Goro | hammer fist, forearm smash, shoulder charge |
| Kung fu | Kensei | finger strike, twin palms, crane kick |
| Soldier | Blaze | elbow, knee, side kick |
| Dual blades | Zen | cross cut, return cut, cross slash |
| Calm | Shige | point, flick, psi lift |

Each fighter's hits also spark in their own way: ki rings, smoke puffs, arcane rings, water splashes, dark crescents, rubber pops, volt arcs, spirit wisps, shockwaves, metal sparks, shadow, quake dust, pressure points, flame, gold cross-cuts and psi ripples. Look-alikes now wear different garments: Monarch in charcoal and gold, Aoi in a pale lavender robe, Saibo in a white jacket, Blaze in a tan turnout coat, and Kensei in a maroon Tang jacket. Skill icons are matte, with no glossy highlight.

**Supers worth watching.** Aoi's Violet Void is now a proper spectacle. Blue and red spiral in and collide, then a white-hot sphere fires. Red and blue still swirl inside it, rings counter-rotate around it, lightning crackles off its surface, debris is dragged in, and it leaves a band of erased space behind. Kensei's Already Done says the line in Japanese, お前はもう死んでいる ("you're already dead"), with a small English subtitle. His target answers なにっ!? just before the blast, and his rapid strikes shout アタタタ! Japanese text uses a small bundled subset of Dela Gothic One (OFL), so it looks the same on every device. Ripper's horns are rebuilt as clean tapered curves.

**The win, shot like a fighting game.** When the winner strikes their pose, letterbox bars slide in, the HUD steps aside and the camera frames the winner right of centre. A slash sweeps across the left of the frame: one solid dark core holds the tracked VICTORY (or PERFECT VICTORY) label, the name in clean italic caps with a glint passing through it, and their title under a thin rule, with thin bands of the winner's colour above and below so no line of type straddles two zones. It never covers the fighter. The result screen that follows uses a two-column victory layout: the winner's full-body art on a slash of their colour with slowly turning rays and their name plate (left), the results with a sharp left-aligned heading (right), all sliding in. It folds to a stacked layout on narrow screens.

**Every button has its own icon.** All 76 skill buttons (two specials, the super and the finisher for each of the 19 fighters), the touch buttons (LIGHT, HEAVY, JUMP) and the menu buttons each have a glyph of their own, drawn to match the move in the same matte 24×24 style: Ryo's curved shuriken and mirror clones, Jin's eclipse, Ripper's chainsaw, Kensei's seven stars, Hana's folding fan, sakura veil and petal storm, Kori's icicle and glacier, Rave's turntable, and so on. They're assigned in one table (`MOVE_ICONS` in `js/fighters.js`), which logs a warning if any icon is ever used twice.

**Beat the Clock scales with the level.** The time limit is 60 seconds plus 22 for each foe, and every knockout before the last adds 8 seconds (shown as +8 SEC). Before, it was a flat 75 seconds, which a three-foe level 4-5 made too tight: a simulated solid player won it 1 time in 3. Now that player wins 15 of 16 clock runs with 22 to 65 seconds left, so the clock still pushes you without being unfair.

**Fireballs, the Street Fighter way.** Ranged attacks control space but can't win a stage on their own:
- **One at a time:** you can't throw another projectile while your last one is still on screen.
- **A commitment:** projectile specials recover for at least 0.45 s and have a cooldown of at least 2.4 s, so a fighter who blocks, jumps or dashes through can punish the thrower. They also hit 20% softer than a close-range special.
- **Finishers need contact:** light, light, heavy only fires a ranged finisher if the chain touched (hit or block). Whiffing it from full screen gives a plain heavy. Light, heavy is always just a heavy.
- **CPUs read projectiles:** they react to the throw's wind-up (so point-blank shots get blocked), don't walk or swing into an incoming shot, block it or jump it (more often against a fighter who keeps throwing), and use the thrower's recovery to dash or jump in. A fighter who keeps zoning gets rushed down.
- Measured with a bot that only throws projectiles: against level 2, 4 and 6 CPUs it went from 58% of shots landing clean and 5% blocked to about 25% clean and 41% blocked, and it lost all 48 matches at each level.

**Crashing Tide is real water.** Homura's ranged finisher is a breaking wave ported from the Tide element's Tidal Wave in Elements: a row of water columns on damped springs rises, rolls, throws its lip forward into a curl and collapses into a wash, with foam on the crest, light through the thin lip, spray and mist. It hits twice, then washes on through instead of popping.

**Shots fly at torso height.** A ranged attack fired by a grounded fighter leaves the hand and settles onto the torso line within a few frames, so Ki Blasts, shuriken, crescents, lances, icicles and sound waves come at the chest instead of the head. Low shots (ground waves, saw discs, stomps) stay low.

**Every ultimate has its own world.** The void backdrop belongs to Aoi alone. The other supers that used to borrow it now cut to a backdrop of their own:
- **Monarch:** a shadow rift tears open behind him, tendrils reach out of it and eyes blink in the dark.
- **Hana:** a dusk sky with a full moon and blossom branches, with rivers of petals sweeping across the front of the screen.
- **Kori:** aurora bands ripple overhead while snow drives across the screen and frost shards creep in from the edges.
- **Blaze:** the sky turns molten, meteors streak down and embers rise.
- **Rave:** the club drops: sweeping lasers and a strobe on the beat.

**Combo finishers.** Light, light, heavy ends in each fighter's own finisher, and they come in two kinds. The move list tags each one.

- **Ranged:** these finishers fire a projectile that carries the foe across the screen. They end the combo with space instead of a juggle, and if your lights whiff they still fly, so they double as a zoning tool, with a slightly longer recovery to pay for it.
  - Ryo: Windmill Shuriken, which grinds through three times.
  - Aoi: Crimson Lance.
  - Homura: Crashing Tide, a breaking wave along the floor.
  - Taro: Spirit Palm, a giant ghost hand.
  - Monarch: Umbral Spikes, a line of shadow spikes racing out.
  - Shige: Debris Toss, a slab torn from the floor and hurled.
- **Close:** these finishers launch or bounce for a juggle. Kohei's Volt Rush Upper now dashes in on lightning first.

**Health.** Every fighter has 2.4 times the health of earlier builds, and in levels and Survival you get another 30% on top, so a fight lasts several combos instead of one. Timers were lengthened to match (wave refills to 80 s, Beat the Clock is 75 s). In levels and Survival the CPU also plays softer: about 25% below its listed level, and its hits do 20% less damage.

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
| **Zen** | Three-sword style | Tornado Slash | Triple Cross | **Nine Phantom Cuts** (sheathes, then the cuts land) | coins only |
| **Jin** | Reaper (red form after his super: dark fire with red edges, embers and ash, red lightning, afterimages, a burning eye streak, a black blade with a red edge, red swing arcs) | Crescent Wave | Blink Step | **Eclipse Crescent** | recruit 2-6 |
| **Kensei** | Pressure point master | Hundred Crack Fists | Pressure Point (plants timed marks that burst) | **Already Done** (walks away, then the foe bursts) | recruit 3-3 |
| **Ripper** | Saw devil | Saw Disc (rolls along the floor) | Chain Hook (yanks the foe in) | **Revving Rampage** (carries the foe on the saws) | coins only |
| **Aoi** | Sorcerer | Azure Pull | Crimson Burst | **Infinite Expanse** (a domain, then Violet Void) | recruit 4-3 |
| **Taro** | Spirit master | Spirit Rush | Spirit Finger | **Time Halt** | recruit 4-6 |
| **Shige** | Psychic | Psi Lift (lift and slam) | Psi Barrier (reflects projectiles) | **Psychic 100%** | recruit 5-3 |
| **Monarch** | Shadow summoner | Shadow Soldier | Shadow Grasp (hands rise under the foe) | **Army of Shadows** | coins only |
| **Goro** | Titan shifter | Quake Stomp | Titan Grab (command grab) | **Colossus Form** (grows giant) | coins only |
| **Saibo** | Bored hero (boss) | Hundred Fists | Plain Punch | **Final Punch** | coins only |

## Stages

The arena is about 2,300 units wide, half again as wide as before. Its edges are not walls but a **supernatural border**, like the edge of a world:
- a sheet of light with scrolling diagonal bands and drifting runes, tinted to each stage, with a haze beyond it (no hard line down its middle);
- it is faint from afar and wakes up as a fighter nears it;
- it ripples and throws sparks where a fighter presses on it, a body splats into it, or a projectile fizzles out against it. The camera pans across it and zooms out a little as the fighters separate. As in Street Fighter, the screen is the leash: fighters on their feet can't walk further apart than the camera can frame.


Eight stages, built like Element Rag's backdrops. Each has far, mid and near layers pre-rendered with haze between them, and the far layers are softer, like depth of field. Buildings, trees and rocks are shaded and catch a rim of light, and props have soft contact shadows, so nothing floats. On top of that, each frame adds:

- the sky and its light;
- animated details;
- floor reflections;
- weather;
- a soft foreground frame;
- a per-stage colour grade with a vignette.

| Stage | Highlights |
| --- | --- |
| Neon Rooftop | Rebuilt as a rainy night city: stepped towers with lit window grids, rooftop water tanks and masts, a lattice tower, flickering neon signs lettered in real katakana (ラーメン ramen, カラオケ karaoke, コーヒー coffee, ゲーム games, ホテル hotel, 寿司 sushi) in a glowing tube style, an LED screen, and a train on an elevated line. The roof is wet concrete, and the signs reflect in it. |
| Neon Rooftop: rain | Realistic rain in three depths. Fine, faint far rain; mid rain; and long bright streaks in front of the fighters. It falls at an angle in the wind, with crown splashes, ripples in puddles and ground mist, plus occasional lightning that flashes the sky before the thunder. |
| Sunset Dojo | A hall on a stone plinth with tiled roofs, lit shoji and swaying lanterns. A fence and stone lanterns stand on the ground, and sun rays shine through. |
| Sakura Shrine | A shaded torii on stone steps, branching cherry trees with lit blossom clusters, a snow-capped volcano and stone lanterns. |
| Bamboo Grove | Rounded, shaded stalks with leaves, curved grass, god rays, drifting mist and fireflies. |
| Frost Peak | Aurora curtains, a snow cap on every peak, snow-laden pines, faceted ice crystals and snow banks. |
| Void Rift | Deep space: a dense starfield with a Milky Way band and dust lanes, twinkling bright stars and shooting stars, magenta and teal nebulae, a spiral galaxy, a cratered moon, a banded gas giant with an atmosphere glow and a layered ring, faceted asteroid isles that drift on their own (lit top faces, cliff bands, cones of shaded facets with a second spur, and a neat crystal cluster rooted in a rock socket), and carved obelisks on stepped plinths with rune channels that light up glyph by glyph, rim lighting, and a cradle holding a turning, faceted crystal with orbiting shards and a beam of light. |
| Crater Plains | An erupting volcano with lava channels and smoke, rim-lit spires, ruined arches with rubble at their feet, and lava cracks. |
| Grand Arena | A roof truss with spotlights, tiered stands packed with a crowd, camera flashes, a hanging VS screen, and banners on the ring wall. |

## Smooth at any refresh rate

- **Fixed timestep, interpolated rendering:** the simulation runs at a fixed 120 ticks a second. Every body point, cloth chain and projectile is drawn blended between the last two ticks by how far the clock has run into the next one. That keeps motion smooth on 60, 90, 120 and 144 Hz screens and in slow motion. The blend is visual only, so gameplay, hitboxes and frame data are unchanged. Measured in slow motion at 144 Hz, the old renderer showed no movement on 114 of 143 frames; now every frame moves, in even steps.
- **Foot locking:** while walking, each foot plants exactly where it touches down and is pinned there inside the physics solver until it lifts, so the knee bends around it. Feet never skate. Measured: per-tick reversals of a planted foot fell from 35 to 1 in five seconds of walking, and body jitter in CPU fights dropped by about a third.
- **Dynamic resolution:** the game watches real frame times against the display's refresh interval. If frames keep running late, it renders at a slightly lower resolution; with headroom it steps back up. The setting is remembered per device, so the frame rate holds.
- **Cheaper frames:**
  - the colour grade and vignette are baked into one cached overlay (one pass instead of a soft-light blend plus a full-screen gradient);
  - the space stage's star, nebula and planet layers are flattened into one;
  - glow sprites are trimmed;
  - the canvas is opaque.

  Forced-flush timings in a headless browser fell by about 15-45% per stage (the space stage from 38 ms to 17 ms). Real devices draw these cached layers on the GPU and are much faster than that headless software renderer.

## UI on every screen

- **FIGHTERS screen:** all 19 fighters fit on one screen (4 across), arranged by colour from red to pink, each tile showing their role, rank, price or lock. The right side is a hero panel: the live preview with the fighter's name, role and style over it, stat bars, and MOVES / UPGRADES / PROFILE tabs. The action button is always visible.
- **Fighter preview:** the select screen shows a live preview of the fighter you're looking at, on their home stage, running through their combo finisher, both specials and their super against a dummy. Tap any move in the list to watch it next. It works for locked fighters too, so you can see what you're buying.

- The whole interface is laid out for 1280x720 and scaled to the window, so it looks the same on a phone, a tablet, a laptop or a 4K monitor. Phones get a little extra size (19%) so text stays readable.
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

## CrazyGames SDK

`js/platform.js` wraps the CrazyGames HTML5 SDK v3. **Rag Showdown shows no ads of any kind**: the game never calls the ad module, and the flow test fails if it ever does. Every call is guarded, so the game runs exactly the same offline, on other sites, or with the SDK blocked.

- **Lifecycle:** init (with a 4-second timeout, so it never holds up boot), then loading start and stop around boot.
- **Gameplay events:** gameplay start and stop whenever a real fight is live and not paused or behind a panel. The events are sent only on changes, never during loading, so they never double up.
- **Happytime:** a 3-star or chapter clear, a new Ascent or Survival best, a legendary card, a mastery level-up, the daily chest, and event rewards.
- **Saves:** go through the SDK data module, so progress follows the player's CrazyGames account. Elsewhere, saves use localStorage.
- **Mute:** the platform's mute setting is honoured live.
- **User:** a signed-in player's name shows on the home screen and stays up to date through the auth listener. An account is never needed to play.

**Trailers:** `crazygames/trailer-landscape-1920x1080.mp4` and `crazygames/trailer-portrait-1080x1920.mp4`, each 17.3 seconds, H.264, 30 fps and under 20 MB.
- **Made from the game:** they are rendered from the real game, frame by frame and deterministically, by `tools/trailer.js`.
- **Shots:** fast jump cuts through a title slam, a combo, Aoi's Violet Void, Kensei's line, Jin's eclipse, a legendary card hand, the three event fighters' supers, Kaze's Wave Cannon finish and an end card.
- **Portrait:** frames the fight with its own tall-screen camera.
- **Re-rendering:** serve the repo, then run `NODE_PATH=$(npm root -g) node tools/trailer.js landscape` (or `portrait`).

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

- `tools/soak.js` runs CPU-vs-CPU matches for every pairing of the 19 fighters, at 16x speed, across all stages and every twist. It fails on:
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
  6. It plays Ascent (a floor, a card pick by key, the card applied to the fighter, the run-over sheet, CLIMB AGAIN), plays Survival, clears a trial in Training and uses every pause option, then buys a coin-exclusive fighter and an upgrade rank.
  7. It plays the event: check-in, an Event Battle on the event stage (double tokens), every reward tier (the exclusive fighter unlocks, skins are equipped), and no tier can be claimed twice.
  8. It checks the CrazyGames SDK against a recording mock (`tools/crazygames-mock.js`): init, loading, gameplay start and stop (never doubled), happytime, data-module saves, the user module and the mute listener, and that no ad is ever requested.

Latest results: mashing light tops out at 2 hits for every fighter, against a dummy or a CPU. Light, light, heavy combos for all 19. The fuzz found no issues. The soak ran 361 matches (842 rounds) across all stages and twists with no issues and no page errors; a card stress test ran every gimmick card at once with no errors. All flow checks passed, including Ascent, upgrades and trials. The UI was checked at desktop, iPhone and Android landscape, and iPad sizes.

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
js/fighters.js    19 fighters (3 event exclusives): normals, keyframed specials and scripted supers; stage list
js/events.js      month-long events: schedule, tokens, reward track, challenges, check-in, Event Battles; skins
js/campaign.js    chapters, levels, twists, recruits, stars
js/meta.js        upgrades, Ascent cards and rarities, training trials, daily missions, fighter mastery
js/platform.js    CrazyGames SDK v3 wrapper: events, happytime, cloud saves, mute, user (no ads)
tools/trailer.js  renders the CrazyGames trailers (landscape and portrait) from the game
js/game.js        rounds, move runtime, hits / guard / juggles / Black Spark, projectiles, beams,
                  fields, minions, marks, barriers, cut-ins, impact frames, finishers, camera
js/stage.js       layered parallax stages, weather, portraits
js/input.js       mouse + keyboard (2 sets), gamepads, touch
js/ai.js          CPU fighters, levels 1-9
js/save.js        localStorage progress and settings
js/ui.js          home + demo, levels, guide and tips, select / shop / upgrades, Ascent, Survival, Training + trials, HUD
js/main.js        boot, loop, input routing
tools/            headless soak, exploit and UI flow tests
assets/fonts/     Rubik (SIL Open Font License)
```
