# NAMAN (alone) — get the project moving without Aryan

You cover Core + Live + stubs for Intelligence so Sanjeev (frontend) and Dhruv (ML) are never blocked.
Do in this exact order. Plain tasks, no API jargon.

## 1. Start the server so map can connect

- Blank Express server runs, health check answers.
- Frontend can connect today.

## 2. Fake truck list (3 trucks at Guwahati depot)

- Truck 1: rice + medicines → Golaghat relief camp
- Truck 2: medicines → Sivasagar
- Truck 3: fuel → Nagaon → Sivasagar
- Fixed starting points: Guwahati (26.1844, 91.7458).
- Sanjeev can render dots today.

## 3. Play button mover (fake GPS)

- Drive trucks step-by-step toward Golaghat / Sivasagar.
- 1 move every 2 seconds over OSRM road line.
- Corridor: Guwahati → Golaghat (26.51, 93.97) → Sivasagar (27.14, 94.63) via NH27/NH37.

## 4. Flood break list from Assam reports

- 8 hardcoded road breaks with lat/lon + damage note.
- Sources: ASDMA breach table + 9 Aug 2026 bulletin (Golaghat 70k, Sivasagar 40k, toll 100).
- Peak day (28 July): spots = blocked. Other days = passable.

## 5. Stop rule (temporary brains until Aryan returns)

- If truck reaches flood spot on 28 July → stop it + fire danger alert.
- On 19 July and 9 Aug → keep moving.
- Simple rule only. Real logic later: Dhruv's landslide probability (gradient + forestation + rain) + Google traffic block.

## 6. Backup road stub

- Return same road twice, label second one "via Bongaigaon village roads".
- Aryan replaces with Google Routes alternate + traffic later. Dhruv's model decides which one is safer.

## 7. Photo inbox stub

- Accept photo + location + note, save to folder, list them back.
- No validation yet.

## 8. Bulletin stub for 09-08-2026

- Static 1-page text/PDF: districts affected, deaths, rivers over danger, truck status.
- Leave one line for landslide probability + live weather snapshot — Aryan fills it.
- Real PDF design later with Aryan.

## Done when

- Map shows 3 dots moving, 1 stops at flood on peak date, alert pops.
- Sanjeev unblocked after step 2. Dhruv can test against your stubs after step 5.
- When Aryan returns: switch to naman.md + aryan.md, delete this flow.
