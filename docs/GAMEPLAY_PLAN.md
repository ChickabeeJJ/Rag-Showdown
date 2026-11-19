# Rag Showdown: gameplay master plan

## Design contract

- **Player fantasy:** an anime-style fighter who grows stronger, run by run, through skill and smart choices.
- **Core verbs:** move, guard, string light-light-heavy into your finisher, cancel into specials, land the super.
- **Core loop (moment to moment):** read the foe → guard or attack → land a combo → meter fills → cash it in with a special or super.
- **Meta loop:** fight → earn coins → upgrade a fighter or unlock one → take on a harder fight or a deeper run.
- **Primary challenge:** spacing, blocking at the right time, and converting a hit into a full combo.
- **Session rhythm:**
  - **30 seconds:** one level or one Ascent floor.
  - **2 minutes:** a few floors and a boon choice, or a trial.
  - **10 minutes:** a full Ascent run, or a chapter, then an upgrade.
- **Pillars:**
  1. Every fighter feels different in the hand.
  2. Every choice is visible and meaningful.
  3. A quick restart is always one press away.
  4. Power is earned and never bought.
- **Constraints:** vanilla JS, canvas, no build step, mobile and desktop, saves in localStorage.

## What the game had

The game had four modes: Levels (8 chapters), Survival, CPU Versus, and Training. There was nothing to spend coins on except unlocking fighters, and no choices outside the fight itself. Every fighter shared the same light and heavy attacks.

## What this adds

### 1. ASCENT: a roguelite climb (replaces CPU Versus)

- **The run:** you pick a fighter and climb floors. Each floor is a single round against a CPU on a random stage. Your health and meter carry over, and you heal 25% after each win.
- **Bosses:** every fifth floor is a boss. Bosses have more health, a red BOSS callout, and a bigger payout.
- **Boons:** after each win you choose 1 of 3 boons, which are run-only powers. They stack within limits, and the choice is the decision layer of the mode. There are 12 boons:
  - Berserker: more damage.
  - Iron Skin: take less damage.
  - Vampiric: heal from damage dealt.
  - Overcharge: more super meter.
  - Quick Hands: shorter special cooldowns.
  - Second Wind: survive one lethal hit.
  - Black Sparks: more crits.
  - Iron Guard: slower guard drain and no chip damage.
  - Primed: start each floor with half a super.
  - Fleet: walk faster.
  - Executioner: bonus damage on weakened foes.
  - Thorns: blocking hurts the attacker.
- **Rewards:** coins every floor, a bonus at boss floors, and a saved best floor.
- **Game over:** a summary shows the floor reached, your boons and the coins earned. RETRY is one press away.

### 2. Upgrades: per-fighter ranks bought with coins

Each fighter has four upgrade tracks, each with 5 ranks:

| Track | Effect per rank |
| --- | --- |
| Power | +4% damage |
| Vitality | +6% health |
| Focus | +8% super meter gain |
| Recovery | 6% shorter special cooldowns |

- **Cost:** ranks cost 60, 140, 240, 360 and 500 coins.
- **Where they apply:** Levels, Survival and Ascent, but not Training, so practice stays honest.
- **Readability:** each fighter shows its total rank (for example "RANK 7") on its tile and panel.

### 3. Trials: combo challenges in Training

Every fighter has five trials that teach the combo system step by step:

1. Land your combo finisher.
2. Cancel a light or heavy into a special.
3. Hit a juggled foe with an air heavy.
4. Land a 5-hit combo.
5. Land your super in a combo.

A checklist appears in Training. Each trial pays coins the first time you clear it.

### 4. Fighters that feel different

- **Normals:** each fighting style has its own light, light and heavy:
  - karate: straight, reverse punch, roundhouse;
  - ninja: knife hand, palm, hook kick;
  - boxer: jab, straight, overhand;
  - kung fu: finger strike, twin palms, crane kick;
  - brawler (Mugi): rubber jabs and a stomp;
  - feral: claw, backhand claw, lunge;
  - giant: hammer fist, forearm, shoulder charge;
  - soldier: elbow, knee, side kick;
  - mystic: palm spark, flick, force push;
  - calm: point, flick, psi lift;
  - regal: backhand, palm, shadow rise;
  - monk: palm, elbow, twin palm;
  - casual: a lazy jab and a big plain punch;
  - sword (iaido): quick slash, rising slash, thrust;
  - reaper: low and high cleaves, overhead;
  - dual: cross cuts and a cross slash.
- **Frame data:** the frame data system keeps combos working for everyone. Light-light-heavy still connects, and mashing still stops at two hits.
- **Hit sparks:** every fighter's hits spark differently: ki, smoke, arcane rings, water, dark crescents, rubber pops, volt arcs, spirit wisps, shockwaves, metal sparks, shadow, quake dust, pressure points, flame, gold cuts and psi ripples.
- **Designs:** look-alikes are separated with their own garment palettes, not just accent colours. Monarch, Jin and Aoi no longer share dark purple coats. Saibo, Blaze and Ripper no longer share charcoal jackets.

### 5. Presentation

- **Skill icons:** matte, with no glossy highlight.

## Quality gates

- **Combos:** light-light-heavy combos for all 16 fighters, and mashing light stops at two hits (`tools/exploit.js`).
- **Stability:** no stuck states, NaN or escaped bodies (exploit fuzz and soak).
- **Flows:** Ascent, upgrades and trials are covered by `tools/flow.js`.
- **Saves:** new save fields have safe defaults, so old saves load unchanged.
