# ARYAN — Intelligence + Field + Bulletin (when back)

You own: live weather, Google route + traffic, landslide danger score, trip advice, photo inbox, bulletin PDF, map base files.
You do NOT touch: server boot, truck mover, live channel (Naman's).

Decided stack (locked):

- Live weather: Google Weather API primary (current + hourly, precipitation probability + QPF mm), fallback Open-Meteo / IMD district forecast. Cache 10 min.
- Routes + traffic: Google Maps Routes API (`TRAFFIC_AWARE`, `departureTime: now`) for main road + alternate + congestion + ETA. Fallback OSRM on OSM when Google has no data or quota over.
- Landslide chance: Dhruv's ML model. Features: land gradient/slope, forestation level (forest cover / NDVI / forest loss), rainfall (24h + 3-day), elevation, lithology/soil, distance to river/fault, road cut presence, district susceptibility class. Output: landslide probability 0-1.

## Tasks

1. Live weather checker — rain for any location via Google Weather API, remembered for 10 minutes.
   Fallback Open-Meteo / IMD if Google fails or quota over. Never throw, return source name.
2. Route finder with traffic — Google Routes for main road + backup road + congestion level + ETA.
   Fallback OSRM when Google returns ZERO_RESULTS (remote NER roads) or key missing.
3. Landslide danger scorer — ask Dhruv's ML first (gradient + forestation + rain + other factors), use own math if ML offline.
   Output Low / Medium / High / Red + landslide probability + reasons shown to judges.
4. Trip analyzer — takes truck + cargo + date, returns road to take + danger + delay message.
   Must show safe on 19 July, Red + backup road on 28 July.
5. Field photo inbox — save photo + location + note to folder, validate inside NER box (21-30N, 89-98E).
6. Flood bulletin PDF dated 09-08-2026 — districts (Golaghat 70k, Sivasagar 40k, Jorhat 16k), toll 100, rivers over danger (Dhansiri, Kushiyara), truck status, top 5 breaks + landslide probability.
7. Map base files for Sanjeev — simplified Assam districts + flood polygons, each under 5MB.

## Done when

- Same trip is safe on 19 July, Red with backup road on 28 July.
- Photo upload appears in list and in bulletin.
- Naman's simulation needs zero changes to use your scorer.
