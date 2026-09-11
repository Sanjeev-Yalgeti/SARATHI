export type TruckStatus = 'moving' | 'blocked' | 'idle'; //to check the status of truck

export interface Truck {
  vehicleId: string;
  lat: number; //latitude longitude
  lng: number;
  speed: number; // km/h and 0 when blocked
  status: TruckStatus;
  origin: string;
  destination: string;
  cargoType: string;
  diverted?: boolean; // true while running the alternate road after a RED diversion
}

//all trucks will start at guwhati depot(26.1844,91.7458)

const COD_GUWHATI = { lat: 26.1844, lng: 91.7458 };

export const trucks = new Map<string, Truck>([
  [
    'AS-01-FOOD-04',
    {
      vehicleId: 'AS-01-FOOD-04',
      ...COD_GUWHATI,
      speed: 0,
      status: 'idle',
      origin: 'Guwahati',
      destination: 'Golaghat relief camp',
      cargoType: 'rice+medicines',
    },
  ],
  [
    'AS-02-MED-11',
    {
      vehicleId: 'AS-02-MED-11',
      ...COD_GUWHATI,
      speed: 0,
      status: 'idle',
      origin: 'Guwahati',
      destination: 'Sivasagar',
      cargoType: 'medicines',
    },
  ],

  [
    'AS-03-FUEL-07',
    {
      vehicleId: 'AS-03-FUEL-07',
      ...COD_GUWHATI,
      speed: 0,
      status: 'idle',
      origin: 'Guwahati',
      destination: 'Sivasagar',
      cargoType: 'fuel',
    },
  ],

  [
    // Story: clean-water run into Sivasagar via Jorhat — threads the
    // Bhogdoi Rightbank erosion (ASDMA-05, Mojia Bheti) and the Dikhow
    // embankment breach (ASDMA-06, Gohain Gaon). Without SARATHI's
    // diversion alerts this tanker drives into overtopped road (AUG09-01).
    'AS-04-WATER-09',
    {
      vehicleId: 'AS-04-WATER-09',
      ...COD_GUWHATI,
      speed: 0,
      status: 'idle',
      origin: 'Guwahati',
      destination: 'Sivasagar relief camp',
      cargoType: 'drinking-water',
    },
  ],

  [
    // Story: shelter-kit run to the Golaghat relief camp via Nagaon —
    // Kakatigaon–Hatigarh flood damage (ASDMA-02) forces the Nagaon
    // approach when the direct Kaziranga road is breached (ASDMA-01).
    // Pairs with AS-01-FOOD-04 to show the alternate-road diversion.
    'AS-05-SHELTER-12',
    {
      vehicleId: 'AS-05-SHELTER-12',
      ...COD_GUWHATI,
      speed: 0,
      status: 'idle',
      origin: 'Guwahati',
      destination: 'Golaghat relief camp',
      cargoType: 'tarpaulins+blankets',
    },
  ],
]);
