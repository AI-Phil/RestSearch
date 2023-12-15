import L from 'leaflet';
import { Amenity } from '../../schema/Amenity';
import { Review } from '../../schema/Review';
import { getClosestAmenities } from '../../api/common';
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
let default_amenity = "restaurant";
let map: L.Map;
let markers: Record<string, MarkerObject> = {};
let lastClickCoords: L.LatLng;
let mapInitializationPromise: Promise<L.Map>;

function initMap(lat: number, lon: number, zoom = default_zoom): Promise<L.Map> {
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

function resetMap(lat: number, lon: number, zoom = default_zoom) {
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
            }));

        return getClosestAmenities(amenities, lastClickCoords.lat, lastClickCoords.lng, closest_n);
    } catch (error) {
        console.error('Error fetching amenities:', error);
        return [];
    }
}

function addMarker(amenity: Amenity, onClick?: (amenity: Amenity) => void) {

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

    const markerColor = getMarkerColorBySimilarity(amenity.reviews);
    var customIcon = L.divIcon({
        className: 'green-marker',
        html: `<span class="material-symbols-outlined" style="color:${markerColor}">location_on</span>`,
        iconAnchor: [12, 24]
    });

    var marker = L.marker([amenity.lat, amenity.lon], { icon: customIcon })
        .addTo(map)
        .bindPopup(popupContent);

    markers[amenity.id] = { marker: marker, amenity: amenity };

    if (onClick) {
        marker.on('click', () => onClick(amenity));
    }
}

function addMarkers(amenities: Amenity[], onClick?: (amenity: Amenity) => void) {
    amenities.forEach(amenity => addMarker(amenity, onClick));
}

function getAmenitiesWithIcon(): Amenity[] {
    return Object.values(markers)
                 .filter(markerObj => markerObj.marker.options.icon)
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

function getMarkerColorBySimilarity(reviews: Review[]): string {
    const level5 = "#008000"
    const level4 = "#229122"
    const level3 = "#45a345"
    const level2 = "#68b568"
    const level1 = "#8bc78b"

    if (reviews.length === 0 || reviews.every(review => review.similarity === undefined)) {
        return level5;
    }

    const maxSimilarity = reviews
        .map(review => review.similarity ?? 0) 
        .reduce((max, similarity) => similarity > max ? similarity : max, 0);

    if (maxSimilarity < 0.90) {
        return level1;
    } else if (maxSimilarity < 0.92) {
        return level2;
    } else if (maxSimilarity < 0.93) {
        return level3;
    } else if (maxSimilarity < 0.94) {
        return level4;
    } else {
        return level5;
    }
}

export const mapUtils = {
    awaitMapInitialization: () => mapInitializationPromise,
    initMap,
    getAmenitiesWithinRadius,
    clearAllMarkers,
    addMarkers,
    get map() {
        return map;
    },
    getAmenitiesWithIcon,
    getCityName,
    default_amenity
};
