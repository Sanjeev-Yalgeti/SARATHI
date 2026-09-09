# NAMAN — Core + Live + Simulation (when Aryan is back)

You own: server boot, truck state, flood break data, fake GPS mover, live alerts.
You do NOT touch: rain logic, danger scoring, photo validation, bulletin design (Aryan's).

## Tasks

1. Server startup + health check so frontend can connect.
2. Live truck list that remembers where each truck is right now (in-memory, 3 trucks).
3. Past flood road-break list from Assam reports (8-10 rows, lat/lon + damage + date).
4. Fake GPS mover: Guwahati → Golaghat → Sivasagar on NH27/NH37, 1 point every 2 seconds.
5. Blockage trigger: truck stops + danger alert fires on 28 July flood/landslide spot; moves normally on 19 July and 9 Aug.
   (Aryan feeds you the landslide probability + Google traffic block; you just apply stop/move.)
6. Manual block button data handling (judge clicks, road closes, truck reroutes).
7. Live channel wiring so Sanjeev gets truck moves + alerts instantly.

## Done when

- Sanjeev sees 3 moving dots, 1 blocked on peak date, alert pops, no crash.
- Aryan can call your truck positions without changing your files.
