# SARATHI — Smart India Hackathon Presentation Pack

> Presentation date reference: SIH finals. Runtime: **~8 minutes** (10 slides), with a
> 5-minute trim cut and a 3-act live demo script. Every figure here was verified against
> the running system (`test:sim` 22/22, live DIVERTED/BLOCKED traces, Google quota math).

---

## Slide 0 — Speaker cheat sheet

- **One-liner (use everywhere):** *"SARATHI doesn't stop trucks. It moves relief around
  the flood — and when the flood makes a road impossible, it says so before a driver
  gets there."*
- **Three words a judge should remember:** *foresight · diversion · proof.*
- **Your only number to remember:** **5.1 km** — the distance from Golaghat relief camp
  to the Barichuwa culvert breach (ASDMA-04). That single number answers "why does the
  truck stop?"

---

## Slide 1 — Title
**SARATHI — Smart AI-based Regional Accessibility & Transport Hazard Intelligence**
*Real-time flood-aware relief routing for the North-East, India.*

**Speaker notes (30 s)**
"Good morning. Assam's flood season strands relief trucks because drivers only
discover a road is gone when they reach the water. SARATHI is the decision layer that
senses the flood on the map first — and reroutes, or refuses the road, before any
driver gets near it. We'll show you the product, not a slide deck."

**Trim to 5 min:** merge slides 1+2.

---

## Slide 2 — Problem
**Why relief gets stuck in Assam**

- July–Aug: river overtopping, embankment breaches, landslides block NH-27/NH-37
  corridor (Guwahati → Nagaon → Golaghat → Sivasagar)
- Today, drivers learn about a breach **at the water's edge**
- No system connects *recorded ASDMA bulletins* → *road-level risk* → *fleet action*
- Cost of failure: medicines, food, fuel don't arrive at relief camps

**Speaker notes (45 s)**
The hardening point: "This is not a hypothetical — this year's own bulletins
(19–28 July) list 8 incidents on our corridor including a washed-away culvert at
Barichuwa." The data is real; we never invent it.

---

## Slide 3 — Solution frame
**Blue predicts. Green proves.**

- **Blue** — the plan: fastest road ahead, computed before the flood is known
- **Green** — the rescue: a detour tested against the actual breach, **only**
  rendered when it clears the RED zone
- **Grey** — travelled / abandoned: the road the truck left behind

**Speaker notes (40 s)**
This is the visual grammar our judges read instantly. "Google can't do the green —
Google Maps routes *around… nothing*; it doesn't know the Barichuwa culvert is gone.
Our engine learns the breach from the ASDMA data and reroutes *before* the truck
reaches it. Green is proof it happened."

---

## Slide 4 — Live demo (the core)
**Three acts, ~6 minutes.** Use presenter keys `1/2/3` to jump the scenario date.
A full journey is ~50 min at the 2 s tick (1500 GPS points/truck — fine-grained,
realistic), so each act **stages the decisive stretch** as admin via Mock-GPS
teleport (`POST /api/simulation/location`), then lets the live tick drive it.
And when a judge says "show that again": one click on **Reload** (admin) or
**Restart Trip** (driver) puts every in-scope truck back at Guwahati depot on the
same date — full restart, no server reboot (`POST /api/simulation/reset`).

| Act | Login | Scenario | Stage (admin teleport) | What to point at |
|---|---|---|---|---|
| 1. Delivery | admin, then driver | `3` = **Relief (09-Aug)** | AS-01 just short of Golaghat camp | truck rolls in → green **"Delivered ✓"** |
| 2. Diversion | admin → driver | `2` = **Peak (28-Jul)** | AS-02 just outside ASDMA-01's 15 km radius | DETOUR toast → blue swings **green** around Kaziranga breach; grey abandoned road |
| 3. The stop | admin → driver | `2` = **Peak** | AS-01 just outside Golaghat's RED radius | truck **stops at the edge** — camp is 5.1 km inside |

**Demo cues**
- Driver first: log in as `AS-02-MED-11`, press **Start Simulation** (green pill,
  top-right) — show the live blue guidance + driver-only alerts, then say *"the full
  journey is 50 minutes at real pace, so we stage the decisive stretch as admin"*.
- Staging command (admin tab): `POST /api/simulation/location` `{ vehicleId, lat, lng }`
  — snaps the truck to the nearest road point; the tick resumes from there instantly.
- Reshow cue: admin **Reload Simulation** (Simulation page header) or driver
  **Restart Trip** — full depot restart on the same date, RED stops re-hit honestly.
- If the diversion stalls (sidecar down): *"ML fallback is running — the truck still
  reroutes, risk labels switch to Heuristic."*
- Act 3 is the anchor: *"This stop IS the feature. Without SARATHI this driver is in
  the breach. The system refused the road."*

**Speaker notes (full script — 3 min)**
"Watch the food truck's final approach on the relief date — staged just short of
camp, it rolls in and flips to a green *Delivered*, the proof-of-delivery close.
Now the same corridor on peak date: as the truck approaches Kaziranga the system
sees the breach 15 km ahead, computes a bypass, and you can see the route
*physically swing* onto the alternate in green while grey shows the abandoned road —
the toast fires at the same moment for the driver. Finally, the food truck headed to
Golaghat: the camp sits 5.1 km from the Barichuwa breach. No bypass exists that still
reaches camp, so SARATHI stops the truck at the safe edge rather than sending it into
water. That refusal is the point."

---

## Slide 5 — Architecture
```
Frontend (React + Vite + Leaflet) :5173
   ├── socket.io (vehicles, alerts)          Backend (Node/Express/Prisma/SQLite) :5001
   └── REST (routes, risk, trips, sim)          ├── 2 s simulation tick (OSRM lines, ML)
                                                └── Disaster-ML sidecar (Python/FastAPI) :8000
```
- JWT auth + role scoping (admin vs driver rooms)
- Google Routes w/ OSRM fallback (free) — no key on the frontend
- Real ASDMA incidents in SQLite; `RiskCache` 10-min snapshots

**Speaker notes (40 s)**
"Three services, one goal: the backend owns the moving world (the simulation + the
diversion brain), the ML sidecar scores every district × date from real bulletin rows
and returns bands — LOW / MODERATE / HIGH / CRITICAL — and the frontend never decides
where it's safe. The frontend only draws what the backend proved."

---

## Slide 6 — Intelligence: the diversion decision
Every 2 s per truck: **advance → RED check (15 km) → divert or stop**

```
ROAD AHEAD in RED radius?
 ├─ yes → ask engine + Tezpur NH-15 bypass
 │        → every point beyond 5 km escape must clear RED → GREEN detour
 │        → else → BLOCKED at safe edge (status, toast, named incident)
 └─ no  → ML band: CRITICAL crawls (10 km/h) · HIGH slows (20 km/h)
          · else full speed (40 km/h)
```
- Chained diversions capped at **3** per truck/date, spaced — no route-churn loops
- ML only modulates speed; **only real RED breaches stop trucks**

**Speaker notes (45 s)**
The most important engineering sentence: "Machine learning never stops a truck — a
breach does. The ML tells you *how nervous to drive*; the breach decides whether the
road exists at all. That's the difference between an AI that warns you and an AI that
pretends to know everything."

---

## Slide 7 — Honesty by design
- **Real-data only:** 8 ASDMA incidents seeded; unknown district/date → HTTP 422, never a
  fabricated prediction
- **Named proof:** green detour tooltip reads *"Clears Kaziranga Basapathar Ali"* — the
  exact incident ID + road
- **The system says NO when it should:** Golaghat camp (5.1 km inside a RED radius)
  is never claimed reachable on peak day
- **Live numbers only:** dashboard cards / alert counts / scenario clock come from APIs,
  empty states are honest ("None reported"), nothing hardcoded

**Speaker notes (50 s)**
"The demo data constraint is our credibility. When we can't answer honestly we render
an honest empty state instead of padding a number. Judges can probe any count on
screen and we can trace it to a live response. That's deliberate — a risk product that
fakes data is worse than one that shrugs."

---

## Slide 8 — Cost & scale (why this is deployable)
- Staged 2-minute demo ≈ **~15–30 Google routing calls** (well under 0.1% of a
  **70k** free monthly quota); corridor routes are cached per pair
- An open map watching a moving truck burns ≈ **300 calls/hour** ≈ $3/hr worst
  case (still ~9 hours of non-stop demoing inside the free quota)
- OSRM fallback runs the whole demo for **$0** if the Google key is ever out
- Each journey = 1500 GPS points on real OSRM geometry, no loops; the mock-GPS
  teleport is how a demo stages the decisive stretch without the 50-minute wait
- Cost guard (set in Cloud Console): daily quota cap ~5,000 to survive an open tab

**Speaker notes (30 s)**
"We measured call burn, not guessed: a staged 2-minute demo is a few tens of
routing calls, and even an unattended map sits comfortably inside the free
quota. Production would add caching + a hard quota cap — 10 lines."

---

## Slide 9 — Roadmap (what's next)
- **STAGED-at-edge:** label stops near a flooded camp amber "staged — last mile needs
  escort" instead of hard block (better last-mile story, baked into the same engine)
- **Flood probability split** (`flood_prob`) + separate landslide/flood heat layers
  (data already typed per incident, transparent heuristic)
- **Demo speed control** (1×/2×/4× tick) for shorter judging slots — removes the
  need to teleport-stage the demo entirely
- **PostGIS + real fleet ingestion** (IoT GPS replaces the simulated tick)

**Speaker notes (30 s)**
Close strong: "The product today is the honest core; the roadmap is the bridge to
production fleet ops — the same engine, real hardware."

---

## Slide 10 — Team & thank you
- **[Team name] · [Members' names]** (fill in)
- Built with: Node.js · React · FastAPI · Leaflet · Socket.io · SQLite/Prisma
- Repo: `github.com/Sanjeev-Yalgeti/SARATHI`

**Speaker notes (20 s) + land**
"Thank you — happy to answer questions, and we'd love to show the Alerts/Reports and
the ASDMA bulletin PDF generator in the Q&A."

---

# Q&A bank (rehearse these out loud)

**Q: "Your trucks still get blocked — where's the value?"**
A: "Stopping is the last resort, and it's the *proof*, not the failure. AS-01 stops
because Golaghat camp is 5.1 km inside a RED breach radius — no road to it is safe,
so we refuse rather than fabricate an arrival. AS-02 and AS-03 never stop: they take
a tested detour *in green* before the breach. Foresight, diversion, and honest
refusal — those three are the product."

**Q: "Why not just use Google Maps?"**
A: "Google routes around traffic, not around a washed-away culvert — its data has no
flood layer. Our green line is computed *after* learning the breach, then verified to
clear the RED zone before the truck commits. Google would happily send AS-02 straight
back through Kaziranga. We deliberately don't let Google's geometry claim safety —
only bypass-tested backend lines go green."

**Q: "Is it real-time or a simulation?"**
A: "Transparent replay. The scenario clock stays visible — 19-Jul onset, 28-Jul peak,
09-Aug relief — and the trucks are simulated GPS on real OSRM roads, clearly labelled.
What's real: the incident data comes from ASDMA bulletins, the routing comes from
Google/OSRM, and the risk bands come from a trained model over those bulletins. We
never hide the simulation behind fake 'live' branding."

**Q: "How accurate is the ML?"**
A: "It's a district × date classifier over the recorded bulletin rows (84 rows, 21
districts). Bands carry confidence and a base date, and the sidecar refuses unknown
districts/dates with a 422 instead of guessing. On the simulation side ML only adjusts
speed; breach geometry owns the stops — so an ML error can slow a truck wrongly but
can never send it through a breach."

**Q: "That 15 km radius looks arbitrary."**
A: "It's a deliberately conservative modeling parameter, documented as such — a
sensitivity run (10/15/20 km) is in the roadmap. At 15 km drivers get warned roughly
10 minutes before a 40 km/h truck reaches the zone. We'd rather over-warn than under.

**Q: "How much does the routing cost you?"**
A: "A staged 2-minute demo is a few tens of routing calls; even an unattended
map watching a moving truck sits comfortably inside the 70k free monthly calls,
and if Google were out, OSRM produces every line for zero cost."

**Q: "How do drivers log in / are drivers scoped?"**
A: "vehicleId + `driver123`. The backend scopes vehicles, incidents, trips, reports,
bulletin and socket rooms to the driver's own truck — the frontend only hides tabs;
the server is the source of truth. Wrong scope returns 404."

**Q: "What if the ML sidecar is down?"**
A: "The tick loop degrades to a labelled heuristic (source: heuristic on screen) —
trucks still reroute, blocks still work, and the map labels the model source next to
the legend. The sidecar is recommended for the demo, not required to run it."

**Q: "The demo teleports trucks around — isn't that cheating?"**
A: "That's the real Mock-GPS ingest endpoint — a truck literally reports a GPS
position into the system and it snaps, resumes and re-routes from there, exactly
like a hardware device would. It exists because a real journey is 50 minutes at
our fine-grained tick. We say so on screen; the simulation is never dressed up as
live sensing. And replays need no teleport at all: one Reload restarts every
truck from the depot on the same date."

**Q: "Your UI numbers — real or hardcoded?"**
A: "Alerts/corridor/fleet cards, alert toasts, and the scenario clock all bind to live
API responses with honest empty states. If it can't be answered honestly, we render
"None reported" — check any card and it re-fetches on each poll."

---

# 5-minute trim (lights-out version)
1. Title + problem (compressed to one punchy slide — slide 2 fold)
2. Blue/green/grey frame
3. **Demo acts 1+2 only** (drop act 3 or make it a 10-second aside)
4. Architecture (one slide, 15 s)
5. Honesty + cost (combine, "we measured, we withhold, we label")
6. Team/thanks

# Demo rehearsal checklist (do this the night before)
- [ ] `./setup.sh` once (seeds 8 incidents + users + trips)
- [ ] `./dev.sh` → backend :5001 · sidecar :8000 · frontend :5173 all healthy
- [ ] Login `AS-01-FOOD-04` → Start Simulation → truck moves (guidance blue line)
- [ ] Driver **Restart Trip** → own truck back at depot, re-driving (no date change)
- [ ] Admin staging: `POST /api/simulation/location` `{vehicleId:"AS-02-MED-11",lat:26.55,lng:93.15}`
      on peak → Start → watch the DETOUR toast + green swing within ~1 min
- [ ] Admin **Reload Simulation** → all trucks at depot, same date (judge reshow path)
- [ ] Key `3` (relief) → stage AS-01 at `26.50,93.95` → watch it arrive → **Delivered ✓**
- [ ] Key `2` (peak) → stage AS-01 just outside Golaghat's radius → watch the honest stop
- [ ] `curl :5001/api/health` + `:8000/health` handshake if judge asks
- [ ] Set Google daily quota cap (~5,000) in Cloud Console
- [ ] Speaker laptop on a charger + a USB-C dongle for the projector