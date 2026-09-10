import * as L from "leaflet";

declare module "leaflet" {
  function heatLayer(
    latlngs: Array<[number, number, number?] | L.LatLng>,
    options?: {
      radius?: number;
      blur?: number;
      minOpacity?: number;
      max?: number;
      maxZoom?: number;
      gradient?: Record<number, string>;
    }
  ): L.Layer;
}

declare module "leaflet.heat/dist/leaflet-heat.js";
declare module "leaflet.heat";
