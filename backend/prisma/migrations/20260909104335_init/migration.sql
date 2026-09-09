-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "eventDate" TEXT NOT NULL,
    "road" TEXT,
    "district" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FieldReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "photoUrl" TEXT,
    "eventDate" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RiskCache" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "eventDate" TEXT NOT NULL,
    "score" INTEGER,
    "level" TEXT,
    "rainfall" REAL,
    "probability" REAL,
    "source" TEXT,
    "payload" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Incident_eventDate_idx" ON "Incident"("eventDate");

-- CreateIndex
CREATE INDEX "FieldReport_eventDate_idx" ON "FieldReport"("eventDate");

-- CreateIndex
CREATE INDEX "RiskCache_eventDate_idx" ON "RiskCache"("eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "RiskCache_lat_lng_eventDate_key" ON "RiskCache"("lat", "lng", "eventDate");
