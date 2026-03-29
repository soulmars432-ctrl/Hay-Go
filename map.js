var endpoint_set = false;
var endpoint;
var startpoint;
var routeLayer;
var map = L.map("map").setView([41.9, 12.49], 13);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  minZoom: 13,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

var routeLayer = L.layerGroup().addTo(map);
var pollenCache = new Map();
var manualStartSet = true;
var routeInfoElement = null;

function updateRouteInfo(distance, duration) {
  if (!routeInfoElement) return;
  const distanceLabel =
    distance != null ? `${(distance / 1000).toFixed(2)} km` : "--";
  const durationLabel =
    duration != null ? `${Math.round(duration / 60) * 2.4} min` : "--";
  routeInfoElement.textContent = `Route length: ${distanceLabel}, duration: ${durationLabel}`;
}

function parseLatLng(value) {
  if (!value) {
    return null;
  }
  const parts = value.split(",").map((s) => parseFloat(s.trim()));
  if (parts.length !== 2 || parts.some((n) => Number.isNaN(n))) {
    return null;
  }
  return { lat: parts[0], lng: parts[1] };
}

map.locate({ setView: true });

map.on("locationfound", (e) => {
  if (manualStartSet) {
    const pos = [41.9, 12.49];
    map.setView(pos, 13);
    if (startpoint) {
      startpoint.setLatLng(pos);
    } else {
      startpoint = L.marker(pos).addTo(map);
    }
    const startInput = document.getElementById("start-input");
    if (startInput && !startInput.value) {
      startInput.value = `${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}`;
    }
    return;
  }
  const pos = e.latlng;
  map.setView(pos, 13);
  if (startpoint) {
    startpoint.setLatLng(pos);
  } else {
    startpoint = L.marker(pos).addTo(map);
  }
  const startInput = document.getElementById("start-input");
  if (startInput && !startInput.value) {
    startInput.value = `${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}`;
  }
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

window.addEventListener("DOMContentLoaded", () => {
  const startInput = document.getElementById("start-input");
  const endInput = document.getElementById("end-input");
  const setRouteBtn = document.getElementById("set-route");

  routeInfoElement = document.getElementById("route-info");

  if (setRouteBtn) {
    setRouteBtn.addEventListener("click", () => {
      const startValue = startInput ? parseLatLng(startInput.value) : null;
      const endValue = endInput ? parseLatLng(endInput.value) : null;

      if (startValue) {
        manualStartSet = true;
        if (startpoint) {
          startpoint.setLatLng(startValue);
        } else {
          startpoint = L.marker(startValue).addTo(map);
        }
        map.panTo(startValue);
      }

      if (endValue) {
        if (endpoint) {
          endpoint.setLatLng(endValue);
        } else {
          endpoint = L.marker(endValue, { fillColor: "rgb(255, 30, 0)" }).addTo(
            map,
          );
        }
        endpoint_set = true;
      }

      if (startValue || endValue) {
        getRoute();
      }
    });
  }
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
  var distance = 0;
  var time = 0;
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
    const route = await scoreRoute(data.routes);
    L.geoJSON(route.geometry, { weight: 10 }).addTo(routeLayer);
    distance += route.distance;
    time += route.duration;
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
    "?overview=full&geometries=geojson&alternatives=true";

  try {
    const resp = await fetch(api_url);
    const data = await resp.json();
    if (!data.routes || !data.routes.length) {
      console.error("No route returned from OSRM.");
      return;
    }

    const route = await scoreRoute(data.routes);
    L.geoJSON(route.geometry, { weight: 10, color: "red" }).addTo(routeLayer);
    distance += route.distance;
    time += route.duration;
    updateRouteInfo(distance, time);
  } catch (err) {
    console.error("Route fetch failed:", err);
  }
}

// scoring routes

async function fetchPollen(lat, lng) {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (pollenCache.has(key)) {
    return pollenCache.get(key);
  }

  const url =
    "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=" +
    lat +
    "&longitude=" +
    lng +
    "&current=birch_pollen,grass_pollen,alder_pollen,mugwort_pollen,olive_pollen";

  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log(url, data.current);
    const value = data.current
      ? (data.current.birch_pollen || 0) +
        (data.current.grass_pollen || 0) +
        (data.current.alder_pollen || 0) +
        (data.current.mugwort_pollen || 0) +
        (data.current.olive_pollen || 0)
      : 0;
    pollenCache.set(key, value);
    return value;
  } catch (err) {
    console.error("Pollen fetch failed:", err);
    return 0;
  }
}

async function scoreRoute(all_routes) {
  const all_scores = [];
  const scores_to_index = new Map();

  for (let k = 0; k < all_routes.length; k++) {
    const route = all_routes[k];
    const coords = route.geometry.coordinates || route.geometry;
    const sampleStep = Math.max(1, Math.floor(coords.length / 10));
    const sampled = coords.filter(
      (_, i) => i % sampleStep === 0 || i === coords.length - 1,
    );

    const scoreValues = await Promise.all(
      sampled.map(async ([lng, lat]) => fetchPollen(lat, lng)),
    );

    const score = scoreValues.reduce((sum, value) => sum + value, 0);
    all_scores.push(score);
    scores_to_index.set(score, k);
  }
  console.log("Route scores:", all_scores);
  all_scores.sort((a, b) => a - b);
  return all_routes[scores_to_index.get(all_scores[0])];
}
