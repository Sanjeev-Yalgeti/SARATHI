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
]);
