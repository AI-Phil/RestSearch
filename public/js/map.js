var default_zoom = 16;
var default_lat = 53.3416362; // Grafton Street, Dublin, Ireland
var default_lon = -6.2627662;

/**
 * Amenity object schema
 * @typedef {Object} Amenity
 * @property {string} id - Unique identifier for the amenity
 * @property {string} name - Name of the amenity
 * @property {number} lat - Latitude
 * @property {number} lon - Longitude
 * @property {string} type - Type of the amenity (e.g., 'restaurant')
 * @property {Object} metadata - Additional information specific to the amenity type 
*/

var map;
var markers = {};
var lastClickCoords; 
var mapInitializationPromise;

var greenIcon = L.divIcon({
    className: 'green-marker',
    html: '<span class="material-symbols-outlined">location_on</span>',
    iconAnchor: [12, 24]
});

var greyIcon = L.divIcon({
    className: 'grey-marker',
    html: '<span class="material-symbols-outlined">location_on</span>',
    iconAnchor: [12, 24]
});

function initMap(lat = default_lat, lon = default_lon, zoom = default_zoom) {
    mapInitializationPromise = new Promise((resolve, reject) => {
        try {
            resetMap(lat, lon, zoom)

            map.on('click', function(e) {
                lastClickCoords = e.latlng;
            });

            resolve(map);
        } catch (error) {
            reject(error);
        }
    });
}

function resetMap(lat = default_lat, lon = default_lon, zoom = default_zoom) {
    clearAllMarkers();
    if (map) {
        map.setView([lat, lon], zoom);
    } else {
        map = L.map('map').setView([lat, lon], zoom);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
        }).addTo(map);

        map.on('click', function(e) {
            lastClickCoords = e.latlng;
        });
    }
}

async function moveToLocation(locationName) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.length > 0) {
            const lat = data[0].lat;
            const lon = data[0].lon;
            resetMap(lat, lon, default_zoom);
        } else {
            alert("Location not found. Please try a different search term.");
        }
    } catch (error) {
        console.error('Error finding location:', error);
        alert("An error occurred while searching for the location.");
    }
}

async function getAmenitiesWithinRadius(radiusInMeters, type = default_amenity, closest_n = 1000) {
    if (!lastClickCoords) {
        console.error("No location has been clicked on the map.");
        return [];
    }

    const query = `
        [out:json];
        node["amenity"="${type}"](around:${radiusInMeters},${lastClickCoords.lat},${lastClickCoords.lng});
        out;
    `;

    try {
        const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
        const data = await response.json();

        // Add distance to each amenity and filter out those without a name
        var amenities = data.elements
            .filter(element => element.tags.name)
            .map(element => ({
                id: element.id.toString(),
                name: element.tags.name,
                lat: element.lat,
                lon: element.lon,
                type: type,
                metadata: element.tags,
                distance: getDistanceFromLatLonInKm(element.lat, element.lon, lastClickCoords.lat, lastClickCoords.lng)
            }));

        // Sort amenities by distance
        amenities.sort((a, b) => a.distance - b.distance);

        // Keep only the closest 'closest_n' amenities
        return amenities.slice(0, closest_n).map(amenity => ({
            id: amenity.id,
            name: amenity.name,
            lat: amenity.lat,
            lon: amenity.lon,
            type: amenity.type,
            metadata: amenity.metadata
        }));
    } catch (error) {
        console.error('Error fetching amenities:', error);
        return [];
    }
}

function addMarker(amenity, icon) {
    if (!icon) {
        console.error("Icon not provided for marker");
        return;
    }

    // Skip if a marker with the same ID already exists
    if (markers[amenity.id]) {
        return;
    }

    let popupContent = `<b>${amenity.name}</b><br>Type: ${amenity.type}`;

    if (amenity.metadata) {
        for (const key in amenity.metadata) {
            if (key !== 'name') { // This already included
                popupContent += `<br>${key.charAt(0).toUpperCase() + key.slice(1)}: ${amenity.metadata[key]}`;
            }            
        }
    }

    var marker = L.marker([amenity.lat, amenity.lon], { icon: icon })
        .addTo(map)
        .bindPopup(popupContent);

    markers[amenity.id] = { marker: marker, amenity: amenity };
}

function addMarkers(amenities, icon) {
    amenities.forEach(amenity => addMarker(amenity, icon));
}

function getAmenitiesWithIcon(icon) {
    return Object.values(markers)
                 .filter(markerObj => markerObj.marker.options.icon === icon)
                 .map(markerObj => markerObj.amenity);
}

function clearAllMarkers() {
    Object.values(markers).forEach(markerObj => {
        if (markerObj && markerObj.marker) {
            map.removeLayer(markerObj.marker);
        }
    });
    markers = {};
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1); 
    var a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI/180)
}

async function getCityName() {
    if (!lastClickCoords) {
        console.error("No location has been clicked on the map.");
        return [];
    }

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lastClickCoords.lat}&lon=${lastClickCoords.lng}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if(data.address) {
            return data.address.city || data.address.town || data.address.village;
        } else {
            return "Unknown Location";
        }
    } catch (error) {
        console.error('Error fetching location:', error);
        return "Error fetching location";
    }
}

window.mapUtils = {
    awaitMapInitialization: () => mapInitializationPromise,
    initMap,
    moveToLocation,
    getAmenitiesWithinRadius,
    clearAllMarkers,
    addMarkers,
    get map() {
        return map;
    },
    getAmenitiesWithIcon,
    getCityName,
    greenIcon: greenIcon,
    greyIcon: greyIcon
};

// Initialize the map with default settings
initMap();

