import L, { DivIcon } from 'leaflet';
import { Amenity } from '../../schema/Amenity';
import 'leaflet/dist/leaflet.css';

type MarkerObject = {
    marker: L.Marker;
    amenity: Amenity;
};

interface OsmElement {
    id: number;
    lat: number;
    lon: number;
    tags: {
        name: string;
        [key: string]: string;
    };
}

let default_zoom = 16;
let default_lat = 53.3416362; // Grafton Street, Dublin, Ireland
let default_lon = -6.2627662;
let default_amenity = "restaurant";
let map: L.Map;
let markers: Record<string, MarkerObject> = {};
let lastClickCoords: L.LatLng;
let mapInitializationPromise: Promise<L.Map>;

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

function initMap(lat = default_lat, lon = default_lon, zoom = default_zoom): Promise<L.Map> {
    mapInitializationPromise = new Promise((resolve, reject) => {
        try {
            resetMap(lat, lon, zoom);

            map.on('click', function(e) {
                lastClickCoords = e.latlng;
            });

            resolve(map);
        } catch (error) {
            reject(error);
        }
    });

    return mapInitializationPromise;
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

function changeMapLocation(): void {
    const locationInput = document.getElementById('locationInput') as HTMLInputElement;
    const locationName = locationInput.value;
    if (locationName) {
        moveToLocation(locationName)
            .then(() => console.log("Map moved to:", locationName))
            .catch(error => console.error('Error moving map:', error));
    } else {
        alert("Please enter a location name.");
    }
}

async function moveToLocation(locationName: string) {
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

async function getAmenitiesWithinRadius(radiusInMeters: number, type: string = default_amenity, closest_n = 1000): Promise<Amenity[]> {
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
        const data: { elements: OsmElement[] } = await response.json();

        const amenities: Amenity[] = data.elements
            .filter(element => element.tags.name)
            .map(element => ({
                id: element.id.toString(),
                name: element.tags.name,
                lat: element.lat,
                lon: element.lon,
                type: type,
                metadata: element.tags,
                reviews: [],
            }))
            .sort((a, b) => getDistanceFromLatLonInKm(a.lat, a.lon, lastClickCoords.lat, lastClickCoords.lng) - 
                            getDistanceFromLatLonInKm(b.lat, b.lon, lastClickCoords.lat, lastClickCoords.lng))
            .slice(0, closest_n);

        return amenities;
    } catch (error) {
        console.error('Error fetching amenities:', error);
        return [];
    }
}

function addMarker(amenity: Amenity, icon: DivIcon) {
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

function addMarkers(amenities: Amenity[], icon: DivIcon) {
    amenities.forEach(amenity => addMarker(amenity, icon));
}

function getAmenitiesWithIcon(icon: DivIcon): Amenity[] {
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

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

function deg2rad(deg: number): number {
    return deg * (Math.PI/180)
}

async function getCityName(): Promise<string> {
    if (!lastClickCoords) {
        console.error("No location has been clicked on the map.");
        throw new Error("Location not set");
    }

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lastClickCoords.lat}&lon=${lastClickCoords.lng}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.address) {
            return data.address.city || data.address.town || data.address.village || "Unknown Location";
        } else {
            return "Unknown Location";
        }
    } catch (error) {
        console.error('Error fetching location:', error);
        throw new Error("Error fetching location");
    }
}

export const mapUtils = {
    awaitMapInitialization: () => mapInitializationPromise,
    initMap,
    changeMapLocation,
    getAmenitiesWithinRadius,
    clearAllMarkers,
    addMarkers,
    get map() {
        return map;
    },
    getAmenitiesWithIcon,
    getCityName,
    greenIcon,
    greyIcon,
    default_amenity
};
