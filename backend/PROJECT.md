# PROJECT REQUIREMENTS DOCUMENT

## SARATHI — Logistics Intelligence Platform

### Real-Time Route Intelligence, Risk Analysis, GIS-Based Logistics Decision Support and Role-Based Access Control

**Prepared based on the provided Component Diagram and updated Auth/RBAC requirements**

------------------------------------------------------------------------

# 1. Project Overview

The **Logistics Intelligence Platform** is a web-based decision-support
system designed to provide real-time logistics visibility, route
intelligence, and risk-aware navigation. The platform combines vehicle
location data, GIS information, weather conditions, mapping services,
and spatial databases to identify suitable routes and highlight
operational risks.

## 1.1 Problem Statement

Traditional logistics monitoring systems may provide vehicle tracking
but often lack integrated real-time risk assessment and intelligent
route recommendations. This project addresses that gap by combining live
vehicle updates with weather, road, and GIS data to calculate risk and
recommend alternative routes.

## 1.2 Project Objectives

-   Display vehicles and logistics assets on an interactive GIS map.
-   Receive and process real-time vehicle location updates.
-   Integrate weather and mapping data from external APIs.
-   Calculate route and operational risk using weighted parameters.
-   Recommend safer or more suitable alternative routes.
-   Store spatial data, routes, district boundaries, and risk
    information.
-   Generate and display alerts for high-risk conditions.
-   Provide a public-facing landing page as the system entry point.
-   Enforce role-based access control distinguishing Admin and Truck
    Driver users.
-   Allow Admin to assign trips (source to destination) to truck
    drivers and perform full CRUD operations on trip records.
-   Restrict Truck Driver access to only their assigned route data,
    live map, alerts, and reports.

------------------------------------------------------------------------

# 2. System Scope

  -----------------------------------------------------------------------
  Component                           Scope / Responsibility
  ----------------------------------- -----------------------------------
  Landing Page                        Public entry point of the system.
                                      Displays platform branding and
                                      provides a Get Started button that
                                      redirects to the Login page.

  Login / Auth Module                 Presents role selection (Admin or
                                      Truck Driver). Validates credentials
                                      against the database, issues a JWT
                                      token, and redirects the user to
                                      the appropriate dashboard view.

  Web Frontend                        Interactive map, vehicle markers,
                                      risk alerts, and user
                                      visualization. Navigation tabs are
                                      filtered by the authenticated
                                      user's role.

  API Gateway                         Receives REST/HTTPS requests and
                                      routes them to backend services.
                                      Validates JWT tokens on protected
                                      routes.

  Auth Service                        Issues and validates JWT tokens.
                                      Exposes POST /api/auth/login and
                                      GET /api/auth/me endpoints.

  Core Intelligence Controller        Coordinates data flow,
                                      calculations, and intelligence
                                      modules.

  Routing & GIS Engine                Processes network/road information
                                      and determines alternative routes.

  Risk & Blockage Calculator          Calculates risk based on driver,
                                      weather, and route conditions.

  Realtime Socket.io Handler          Listens for and processes live
                                      incident or vehicle updates.

  Spatial Database (Prisma + SQLite)  Stores incidents, field reports,
                                      risk cache, User accounts, Trip
                                      assignments, and seed GIS reference
                                      data. PostGIS migration path
                                      preserved.

  Simulation Script                   Generates dummy GPS coordinates for
                                      demonstration and testing.

  External Data Services              Weather API, Mapping APIs, and GIS
                                      data sources.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 3. Functional Requirements

  -----------------------------------------------------------------------
  ID                                  Requirement
  ----------------------------------- -----------------------------------
  FR-01                               User shall be able to view an
                                      interactive map with GIS/GeoJSON
                                      layers.

  FR-02                               System shall display live vehicle
                                      locations using real-time data
                                      updates.

  FR-03                               System shall show risk alerts and
                                      route-related warnings to users.

  FR-04                               Frontend shall communicate with the
                                      backend using REST APIs over HTTPS.

  FR-05                               API Gateway shall validate and
                                      route incoming client requests.

  FR-06                               Core Intelligence Controller shall
                                      orchestrate routing, risk
                                      calculation, and real-time data
                                      processing.

  FR-07                               System shall fetch weather
                                      information relevant to the
                                      selected route or operational area.

  FR-08                               System shall obtain mapping and
                                      route data from mapping service
                                      APIs.

  FR-09                               Routing & GIS Engine shall identify
                                      alternate routes using network
                                      graph and GIS information.

  FR-10                               Risk & Blockage Calculator shall
                                      combine driver, weather, and route
                                      conditions using a weighted
                                      formula.

  FR-11                               System shall process risk-driven
                                      incident data and update the
                                      relevant route or vehicle state.

  FR-12                               Realtime handler shall push live
                                      vehicle and alert updates over
                                      WebSockets (Socket.io).

  FR-13                               Prisma + SQLite shall persist
                                      incidents, field reports, risk
                                      cache, User accounts, and Trip
                                      assignments; GIS layers served as
                                      versioned GeoJSON.

  FR-14                               System shall seed risk maps, GIS
                                      reference data, the single Admin
                                      account, and all Truck Driver
                                      accounts via Prisma seed scripts.

  FR-15                               Simulation module shall generate
                                      mock latitude/longitude coordinates
                                      for testing.

  FR-16                               System shall display a public
                                      Landing Page as the default route
                                      (/). The page shall include a
                                      Get Started button that navigates
                                      the user to the Login page.

  FR-17                               Login page shall allow the user to
                                      select a role (Admin or Truck
                                      Driver) before submitting
                                      credentials. Admin uses a
                                      predefined userId and password.
                                      Truck Driver uses their Vehicle ID
                                      as userId.

  FR-18                               Backend shall authenticate users
                                      via POST /api/auth/login, validate
                                      credentials against the database
                                      (bcrypt), and return a signed JWT
                                      token on success.

  FR-19                               All protected API routes shall
                                      require a valid JWT token in the
                                      Authorization header. Requests
                                      without a valid token shall receive
                                      a 401 Unauthorized response.

  FR-20                               Admin user shall have access to all
                                      navigation sections: Home, Live
                                      Map, Trips, Alerts, Reports,
                                      Analytics, Simulation, and
                                      Resources.

  FR-21                               Admin user shall be able to assign
                                      a trip (origin, destination, cargo
                                      type) to a Truck Driver identified
                                      by Vehicle ID. Admin shall also be
                                      able to edit and delete trip
                                      assignments (full CRUD).

  FR-22                               Truck Driver user shall be
                                      restricted to three sections only:
                                      Live Map, Alerts, and Reports.
                                      All other navigation tabs shall be
                                      hidden from the driver's view.

  FR-23                               Truck Driver's Live Map, Alerts,
                                      and Reports views shall display
                                      only data relevant to the route
                                      assigned to that driver in the
                                      database. Data for other drivers
                                      or routes shall not be accessible.

  FR-24                               The single Admin account and all
                                      Truck Driver accounts shall be
                                      pre-seeded into the database.
                                      Truck Driver Vehicle IDs serve as
                                      their userIds. Passwords shall be
                                      stored as bcrypt hashes. Pre-
                                      assigned trips for each driver
                                      shall also be seeded.

  FR-25                               Frontend navigation shall filter
                                      visible tabs based on the
                                      authenticated user's role decoded
                                      from the JWT token stored in the
                                      browser.

  FR-26                               A Logout action shall clear the
                                      stored JWT token and redirect the
                                      user to the Landing Page.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 4. Non-Functional Requirements

  -----------------------------------------------------------------------
  Category                            Requirement
  ----------------------------------- -----------------------------------
  Performance                         Live updates should be processed
                                      with low latency and map
                                      interactions should remain
                                      responsive.

  Scalability                         Backend services should support
                                      growth in users, vehicles, and
                                      spatial records.

  Availability                        Core monitoring and data APIs
                                      should be designed for reliable
                                      continuous operation.

  Security                            All external communication should
                                      use HTTPS. APIs shall implement
                                      JWT-based authentication and
                                      role-based authorization. Passwords
                                      shall be stored as bcrypt hashes.
                                      JWT secret shall be kept in server-
                                      side environment variables and
                                      never exposed to the frontend.

  Maintainability                     Components should be modular so
                                      routing, risk, auth, and data
                                      services can be updated
                                      independently.

  Usability                           Dashboard should clearly present
                                      maps, vehicle status, route
                                      recommendations, and risk alerts.
                                      Role-aware navigation must clearly
                                      indicate the logged-in user's name
                                      and role.

  Data Integrity                      Spatial and real-time data should
                                      be validated before persistence and
                                      processing.

  Extensibility                       Additional data sources, risk
                                      factors, and user roles should be
                                      easy to integrate.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 5. Technology Requirements

  -----------------------------------------------------------------------
  Layer                               Required Technology / Service
  ----------------------------------- -----------------------------------
  Frontend                            React.js, React Router DOM,
                                      Leaflet.js, GeoJSON, Axios,
                                      Tailwind CSS

  Backend                             Node.js, Express.js

  Authentication                      JSON Web Tokens (jsonwebtoken),
                                      bcrypt for password hashing

  API Communication                   REST APIs over HTTPS; Axios client
                                      with JWT Authorization header

  Real-Time Data                      Socket.io WebSockets + REST
                                      (Firestore deferred)

  Database                            Prisma ORM + SQLite file DB
                                      (prototype; PostgreSQL + PostGIS
                                      migration path preserved)

  Mapping Data                        Google Maps API and/or
                                      OpenStreetMap

  Weather Data                        Weather API

  GIS Data Processing                 Google Earth Engine, Sentinel
                                      imagery, Desktop GIS tools

  Testing / Demo                      GPS simulation script generating
                                      mock latitude and longitude data
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 6. Component-Wise Requirements

## 6.0 Landing Page

-   Public-facing page served at the root route (`/`).
-   Displays the SARATHI platform branding and a brief description.
-   Contains a prominent **Get Started** button that navigates the user
    to the Login page (`/login`).
-   Does not require authentication.

## 6.1 Login / Auth Module

-   Displayed at the `/login` route.
-   Provides a role selection toggle: **Admin** or **Truck Driver**.
-   Input fields: userId (text) and password (masked).
-   On submission, sends credentials to `POST /api/auth/login`.
-   On success, stores the returned JWT in browser localStorage and
    redirects to the dashboard (`/dashboard`).
-   Displays a clear error message for invalid credentials.
-   Admin userId: `admin`. Truck Driver userId: their Vehicle ID
    (e.g., `AS-01-FOOD-04`).

## 6.2 Web Frontend (React + Leaflet.js)

-   Interactive map visualization.
-   GeoJSON district and GIS layer rendering.
-   Live vehicle markers.
-   Real-time risk alerts and route information.
-   REST/HTTPS communication with backend via Axios client that
    attaches the JWT token to every request.
-   Navigation tabs filtered by role: Admin sees all tabs; Truck Driver
    sees only Live Map, Alerts, and Reports.
-   TopNav displays the logged-in user's name, role badge, and a
    Logout button.
-   Route guard: unauthenticated users accessing `/dashboard` are
    redirected to `/login`.

## 6.3 Web Backend (Node.js + Express)

-   Central backend composite component.
-   Expose REST APIs.
-   Coordinate intelligence modules.
-   Fetch data from external services.
-   Read and write spatial data.
-   Validate JWT tokens on all protected routes via auth middleware.
-   Enforce role-based access: ADMIN-only routes reject DRIVER tokens
    with 403 Forbidden.

## 6.4 Auth Service

-   Exposes `POST /api/auth/login`: accepts `{ userId, password }`,
    validates against the User table (bcrypt compare), and returns a
    signed JWT containing `{ id, role, name }`.
-   Exposes `GET /api/auth/me`: returns the current user's profile from
    the decoded JWT (used for frontend token hydration on page refresh).
-   JWT secret stored in backend environment variable `JWT_SECRET`.
-   Token expiry: 8 hours.

## 6.5 Core Intelligence Controller

-   Orchestrate data flow between modules.
-   Trigger routing requests.
-   Trigger weighted risk calculations.
-   Process results before returning them to the frontend.

## 6.6 Routing & GIS Engine

-   Use road and network graph information.
-   Calculate suitable routes.
-   Generate alternate routes when risks or blockages are detected.
-   Use GIS data to support spatial decisions.

## 6.7 Risk & Blockage Calculator

-   Combine driver-related, weather-related, and route-related factors.
-   Use a weighted risk formula.
-   Produce a risk score and blockage/risk status.
-   Provide results to the intelligence controller.

## 6.8 Realtime Socket.io Handler

-   Push live vehicle positions and alerts over WebSockets.
-   Process incident or vehicle updates.
-   Forward risk-driven events to the Core Intelligence Controller.

## 6.9 Persistence (Prisma + SQLite, PostGIS-ready)

-   Store incidents, field reports, risk cache, User accounts, and
    Trip assignments via Prisma.
-   Serve district boundaries and flood polygons as versioned GeoJSON.
-   Support migrate + seed on any clone (`migrate deploy + db:seed`).
-   Keep schema portable so `provider` can switch to PostgreSQL/PostGIS.
-   **User model**: fields — id (userId), role (ADMIN | DRIVER),
    password (bcrypt hash), name.
-   **Trip model**: fields — id, driverId (FK → User.id / vehicleId),
    origin, destination, cargoType, status (assigned | in_progress |
    completed), createdAt, updatedAt.

## 6.10 Simulation Script Container

-   Generate dummy GPS coordinates.
-   Send mock latitude/longitude values.
-   Support project demonstrations without real hardware.

## 6.11 External APIs and GIS Sources

-   Weather API for rainfall, flood, and weather risk.
-   Mapping APIs for maps, routing, and estimated travel information.
-   GIS sources for satellite imagery and spatial datasets.

------------------------------------------------------------------------

# 7. Data Requirements

  -----------------------------------------------------------------------
  Data Category                       Required Information
  ----------------------------------- -----------------------------------
  Vehicle Data                        Vehicle ID, latitude, longitude,
                                      timestamp, status, and speed if
                                      available.

  Route Data                          Origin, destination, route
                                      geometry, estimated travel
                                      information, and alternate routes.

  Weather Data                        Rainfall, flood-related indicators,
                                      weather severity, and relevant
                                      location/time.

  Risk Data                           Driver factor, weather factor,
                                      route factor, weighted score, and
                                      alert status.

  GIS Data                            District boundaries, road/network
                                      data, spatial layers, and risk
                                      maps.

  Incident Data                       Incident ID, location, type,
                                      severity, timestamp, and processing
                                      status.

  User Data                           User ID (userId / vehicleId for
                                      drivers), role (ADMIN | DRIVER),
                                      bcrypt-hashed password, and
                                      optional display name.

  Trip Assignment Data                Trip ID, driver userId (FK),
                                      origin, destination, cargo type,
                                      trip status (assigned | in_progress
                                      | completed), created and updated
                                      timestamps.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 8. System Workflow

## 8.1 Authentication Flow

1.  User visits the Landing Page (`/`).
2.  User clicks **Get Started** and is navigated to the Login page
    (`/login`).
3.  User selects role (Admin or Truck Driver), enters userId and
    password, and submits the form.
4.  Frontend sends `POST /api/auth/login` with `{ userId, password }`.
5.  Backend validates credentials against the User table (bcrypt
    compare) and returns a signed JWT token.
6.  Frontend stores the JWT in localStorage and decodes the role.
7.  User is redirected to the dashboard (`/dashboard`).
8.  Navigation tabs are rendered based on decoded role: Admin sees all
    tabs; Truck Driver sees only Live Map, Alerts, and Reports.

## 8.2 Core Logistics Workflow

1.  Vehicle or simulation module sends GPS/location data.
2.  Real-time (Socket.io) handler pushes live updates and forwards
    relevant events.
3.  Frontend requests route, vehicle, and risk information through REST
    APIs. Each request includes the JWT in the Authorization header.
4.  API Gateway validates the JWT and routes the request to the Core
    Intelligence Controller.
5.  Core Controller fetches mapping, weather, and spatial information.
6.  Routing & GIS Engine determines the current and alternative routes.
7.  Risk & Blockage Calculator computes a weighted risk score.
8.  Prisma + SQLite stores or retrieves incidents, reports, risk cache,
    and trip assignments.
9.  Core Controller returns processed results to the frontend.
10. Frontend updates the map, vehicle markers, route display, and risk
    alerts. Truck Drivers see only data scoped to their assigned route.

## 8.3 Admin Trip Assignment Workflow

1.  Admin logs in and navigates to the Trips section.
2.  Admin selects a Truck Driver by Vehicle ID from a dropdown.
3.  Admin enters origin, destination, and cargo type and submits.
4.  Frontend sends `POST /api/trips` with the trip details and JWT.
5.  Backend creates the Trip record in the database linked to the
    driver's userId.
6.  The assigned driver sees their new route on next login or refresh.

------------------------------------------------------------------------

# 9. API Requirements

  -----------------------------------------------------------------------
  Endpoint                            Purpose / Access
  ----------------------------------- -----------------------------------
  POST /api/auth/login                Authenticate user; returns JWT.
                                      Public (no token required).

  GET /api/auth/me                    Return current user profile from
                                      JWT. Requires valid token.

  GET /api/vehicles                   Retrieve current vehicle locations
                                      and status. Admin sees all; Driver
                                      sees only their own vehicle.
                                      Requires valid token.

  GET /api/routes                     Retrieve route and alternate route
                                      information. Requires valid token.

  GET /api/risk                       Retrieve calculated risk for a
                                      route, vehicle, or area. Requires
                                      valid token.

  GET /api/weather                    Retrieve weather information used
                                      for risk assessment. Requires valid
                                      token.

  POST /api/route/analyze             Submit route details for routing
                                      and risk analysis. Requires valid
                                      token.

  POST /api/simulation/location       Submit mock GPS data from the
                                      simulation module. Requires valid
                                      token.

  POST /api/incidents                 Create or process incident
                                      information. Requires valid token.

  GET /api/trips                      List all trips (Admin) or the
                                      authenticated driver's own trip
                                      (Driver). Requires valid token.

  POST /api/trips                     Admin assigns a new trip to a
                                      driver. Admin token required.

  PATCH /api/trips/:id                Admin updates an existing trip
                                      record. Admin token required.

  DELETE /api/trips/:id               Admin deletes a trip assignment.
                                      Admin token required.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 10. User Roles and Interface Requirements

## 10.1 Roles

The system supports two roles: **Admin** and **Truck Driver**.

  -----------------------------------------------------------------------
  Role          userId              Password        Privileges
  ------------- ------------------- --------------- ---------------------
  Admin         admin               sarathi@123     Full access to all
                                    (seeded)        pages. CRUD on
                                                    trips. View all
                                                    vehicles and reports.

  Truck Driver  Vehicle ID          driver123       Restricted to Live
                e.g.                (seeded)        Map, Alerts, and
                AS-01-FOOD-04                       Reports scoped to
                                                    their assigned route.
  -----------------------------------------------------------------------

## 10.2 Seeded Accounts

  -----------------------------------------------------------------------
  userId            Role    Pre-assigned Route
  ----------------- ------- ---------------------------------------------
  admin             ADMIN   N/A

  AS-01-FOOD-04     DRIVER  Guwahati → Golaghat relief camp

  AS-02-MED-11      DRIVER  Guwahati → Sivasagar

  AS-03-FUEL-07     DRIVER  Guwahati → Sivasagar
  -----------------------------------------------------------------------

## 10.3 Interface Requirements by Role

**Admin interface shall provide:**
-   Map view with all active vehicle markers.
-   Risk level visualization and alerts across all routes.
-   Current and alternate route display.
-   Weather and risk information for any selected route.
-   Trip management panel: assign, edit, and delete driver trips.
-   Vehicle and route selection controls.
-   Simulation/demo controls.
-   Analytics and reporting dashboards.
-   Logged-in user name, role badge, and Logout button in the top
    navigation bar.

**Truck Driver interface shall provide:**
-   Live Map scoped to the driver's assigned route only.
-   Alerts relevant to the driver's route.
-   Reports filed along the driver's route.
-   No access to Trips management, Analytics, Simulation, or
    Resources sections.
-   Logged-in vehicle ID and Logout button in the top navigation bar.

------------------------------------------------------------------------

# 11. Assumptions and Constraints

-   External API availability and limits may affect route and weather
    data access.
-   Real-time accuracy depends on the quality and frequency of incoming
    GPS/Socket.io data.
-   GIS layers are served as simplified GeoJSON for the prototype;
    full PostGIS import is deferred.
-   GIS datasets must be available in compatible formats for database
    import.
-   Risk scoring weights must be defined and calibrated during project
    development.
-   The academic prototype may use simulated GPS data when real devices
    are unavailable.
-   API keys and sensitive credentials must not be exposed in frontend
    source code.
-   The system uses a single Admin account for the prototype. Multi-
    admin support is a future enhancement.
-   JWT tokens are stored in browser localStorage for the prototype.
    HttpOnly cookie storage is recommended for production.
-   Truck Driver passwords are uniform (`driver123`) for the prototype
    and should be individualised in production.
-   JWT_SECRET must be set as a server-side environment variable and
    must never be committed to source control.

------------------------------------------------------------------------

# 12. Acceptance Criteria

-   Landing page loads at `/` and displays a functional Get Started
    button that navigates to the Login page.
-   Login page allows role selection (Admin / Truck Driver), validates
    credentials, and redirects on success.
-   Invalid credentials display a clear error message without crashing.
-   Admin login (`admin` / `sarathi@123`) grants access to all eight
    navigation sections.
-   Truck Driver login (vehicleId / `driver123`) restricts navigation
    to Live Map, Alerts, and Reports only.
-   Driver's Live Map, Alerts, and Reports show only data for their
    assigned route.
-   Admin can create, edit, and delete trip assignments from the Trips
    section.
-   Assigned trip appears in the correct driver's view after assignment.
-   Logout clears the JWT and redirects to the Landing page.
-   Unauthenticated access to `/dashboard` redirects to `/login`.
-   System successfully displays an interactive logistics map.
-   Vehicle locations update using real-time or simulated data.
-   Backend APIs successfully communicate with the frontend.
-   Weather and mapping data can be integrated into route analysis.
-   System calculates and displays a risk score using defined factors.
-   At least one alternate route can be generated when a route is
    identified as risky or blocked.
-   Incident, report, risk, user, and trip data persists across
    restarts via Prisma + SQLite and can be reseeded on any clone.
-   Risk alerts are visible to the user in the dashboard.

------------------------------------------------------------------------

# 13. Future Enhancements

-   PostgreSQL + PostGIS migration for spatial queries (`ST_Contains`,
    `ST_DWithin`).
-   Machine-learning-based traffic and risk prediction.
-   IoT/GPS device integration for actual fleet tracking.
-   Driver behavior analytics.
-   Automated notifications through SMS, email, or mobile push alerts.
-   Predictive flood and road blockage analysis using historical and
    satellite data.
-   Multi-admin support and an Operator role with partial privileges.
-   JWT stored in HttpOnly cookies for improved security.
-   Per-driver individualised passwords and self-service password reset.
-   Mobile application support.
-   Socket.io true real-time pushes (`vehicle:update`, `alert:risk`,
    `alert:blockage`); dashboard currently polls every 2s.
-   Google map tiles upgrade (dashboard currently uses free
    OpenStreetMap tiles, no key required).
-   Merge TEST_CASES-subset geocoded roads into the seed via
    `npm run geocode:incidents` staging review (Google-only,
    skip-if-missing, incidents.json stays real-data-only).
-   Source bulletin district/population/toll figures from the 08--09 Aug
    PDFs instead of stub constants.
-   Remove or wire dead routes (`alerts.js`, `maps.js`, `geocode.js`,
    `trip-planner.js`) currently unmounted in `src/app.ts`.
-   Implement `POST /api/simulation/location` mock-GPS ingest (PROJECT
    §9) alongside the internal simulation clock.
-   Require JWT on `GET /api/weather` and `GET /api/risk` per FR-19
    (currently public for dashboard fallback).

------------------------------------------------------------------------

# 14. Conclusion

The **SARATHI Logistics Intelligence Platform** integrates web
technologies, JWT-based authentication, role-based access control,
real-time data processing, GIS, mapping services, weather information,
and Prisma + SQLite persistence to support intelligent logistics
operations. A public landing page and a role-aware login flow provide
the entry points for Admin and Truck Driver users. The Admin manages
trips and views the complete operational picture, while Truck Drivers
access only their assigned route's live map, alerts, and reports. The
proposed architecture is modular and suitable for an academic project
while also providing a foundation for future real-world expansion
(PostGIS, multi-admin, mobile app, production-grade auth).
