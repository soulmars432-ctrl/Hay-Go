var endpoint_set = false;
var endpoint;
var startpoint;
var routeLayer;
var map = L.map("map").setView([51.505, 5.45], 13);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  minZoom: 13,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

var routeLayer = L.layerGroup().addTo(map);
map.locate({ setView: true });

map.on("locationfound", (e) => {
  startpoint = L.marker(e.latlng).addTo(map);
});

map.on("locationerror", () => {
  // fallback to a default city
  map.setView([49.2827, -123.1207], 13);
  startpoint = L.marker([49.2827, -123.1207]).addTo(map);
});

map.on("click", (e) => {
  if (!endpoint_set) {
    endpoint = L.marker(e.latlng, { fillColor: "rgb(255, 30, 0)" }).addTo(map);
    endpoint_set = true;
  } else {
    map.removeLayer(endpoint);
    endpoint = L.marker(e.latlng, { fillColor: "rgb(255, 30, 0)" }).addTo(map);
  }
  getRoute();
});

// main routing function
/* jobs include: 
    - choose a random point in selected user distance
    - fetch route from osrm
    - display route on map
    - call scoring function to evaluate route and display score
*/
async function getRoute() {
  // to endpoint, from start point
  if (!endpoint_set || !startpoint) {
    return;
  }

  var api_url =
    "https://router.project-osrm.org/route/v1/walking/" +
    startpoint.getLatLng().lng +
    "," +
    startpoint.getLatLng().lat +
    ";" +
    endpoint.getLatLng().lng +
    "," +
    endpoint.getLatLng().lat +
    "?overview=full&geometries=geojson";

  try {
    const resp = await fetch(api_url);
    const data = await resp.json();
    if (!data.routes || !data.routes.length) {
      console.error("No route returned from OSRM.");
      return;
    }

    routeLayer.clearLayers();
    const route = data.routes[0];
    L.geoJSON(route.geometry, { weight: 10 }).addTo(routeLayer);
  } catch (err) {
    console.error("Route fetch failed:", err);
  }

  // getting back home after delightful excercise

  var api_url =
    "https://router.project-osrm.org/route/v1/walking/" +
    endpoint.getLatLng().lng +
    "," +
    endpoint.getLatLng().lat +
    ";" +
    startpoint.getLatLng().lng +
    "," +
    startpoint.getLatLng().lat +
    "?overview=full&geometries=geojson";

  try {
    const resp = await fetch(api_url);
    const data = await resp.json();
    if (!data.routes || !data.routes.length) {
      console.error("No route returned from OSRM.");
      return;
    }

    const route = data.routes[0];
    L.geoJSON(route.geometry, { weight: 10, color: "red" }).addTo(routeLayer);
  } catch (err) {
    console.error("Route fetch failed:", err);
  }
}

// scoring routes

function scoreRoute(route) {
  // score route based on lack of pollen
}
