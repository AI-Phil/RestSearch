var default_zoom = 16;

// Grafton Street, Dublin, Ireland
var default_lat = 53.3416362; 
var default_lon = -6.2627662;

var currentMarkers = [];
var allRestaurantMarkers = [];

var map = L.map('map').setView([default_lat, default_lon], default_zoom);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
}).addTo(map);

function searchLocation() {
    var inputLocation = document.getElementById('locationSearch').value;

    // Check if the input is in the format of coordinates
    var coordPattern = /^-?\d+(\.\d+)?, ?-?\d+(\.\d+)?$/;
    if (coordPattern.test(inputLocation)) {
        // Input is coordinates
        var coords = inputLocation.split(',').map(function(item) {
            return parseFloat(item.trim());
        });

        map.setView(coords, default_zoom);
    } else {
        // Input is treated as an address, use geocoding
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${inputLocation}`)
            .then(response => response.json())
            .then(data => {
                if (data.length > 0) {
                    var lat = data[0].lat;
                    var lon = data[0].lon;
                    map.setView([lat, lon], default_zoom);
                } else {
                    alert("Location not found!");
                }
            })
            .catch(error => {
                console.error('Error:', error);
            });
    }
}

map.on('click', function(e) {
    currentMarkers.forEach(function(marker) {
        map.removeLayer(marker);
    });
    currentMarkers = [];

    var lat = e.latlng.lat;
    var lon = e.latlng.lng;
    fetchRestaurants(lat, lon);
});

function updateRadiusValue(value) {
    document.getElementById('radiusValue').textContent = value;
}

function fetchRestaurants(lat, lon) {
    var radius = document.getElementById('radiusSlider').value;

    var query = `
        [out:json];
        (
          node["amenity"="restaurant"](around:${radius},${lat},${lon});
          way["amenity"="restaurant"](around:${radius},${lat},${lon});
          rel["amenity"="restaurant"](around:${radius},${lat},${lon});
        );
        out center;
    `;

    fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
            // Process and display the data
            displayRestaurants(data);
        })
        .catch(error => {
            console.error('Error fetching restaurants:', error);
        });
}

function displayRestaurants(data) {
    var cuisineSet = new Set(); // To store unique cuisines

    // Clear existing markers
    clearMarkers();

    data.elements.forEach(function(element) {
        var lat = element.lat || element.center.lat;
        var lon = element.lon || element.center.lon;
        var name = element.tags.name || 'Restaurant';
        var cuisine = element.tags.cuisine || 'Unknown';

        cuisineSet.add(cuisine);

        // Create and add marker
        var marker = L.marker([lat, lon], { icon: greenIcon }).addTo(map)
            .bindPopup(`${name}<br>Cuisine: ${cuisine}`);
        marker.cuisine = cuisine;
        allRestaurantMarkers.push(marker);
    });

    // Populate the cuisine selector
    populateCuisineSelector(Array.from(cuisineSet));
}

function populateCuisineSelector(cuisines) {
    var select = document.getElementById('cuisineSelect');
    select.innerHTML = '<option value="">Select Cuisine</option>'; // Reset options

    cuisines.forEach(function(cuisine) {
        var option = document.createElement('option');
        option.value = option.textContent = cuisine;
        select.appendChild(option);
    });
}

function filterCuisine() {
    var selectedCuisine = document.getElementById('cuisineSelect').value;
    allRestaurantMarkers.forEach(function(marker) {
        if (selectedCuisine === "" || marker.cuisine === selectedCuisine) {
            marker.setIcon(greenIcon);
            marker.setOpacity(1);
        } else {
            marker.setIcon(greyIcon);
            marker.setOpacity(0.5);
        }
    });
}

function clearMarkers() {
    allRestaurantMarkers.forEach(function(marker) {
        map.removeLayer(marker);
    });
    allRestaurantMarkers = [];
}


var greenIcon = L.divIcon({
    className: 'green-marker',
    html: '<span class="material-symbols-outlined">location_on</span>',
    iconSize: [48, 48],
    iconAnchor: [12, 24]
});

var greyIcon = L.divIcon({
    className: 'grey-marker',
    html: '<span class="material-symbols-outlined">location_on</span>',
    iconAnchor: [12, 24]
});

