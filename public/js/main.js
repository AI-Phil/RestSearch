var default_zoom = 16;

// Grafton Street, Dublin, Ireland
var default_lat = 53.3416362; 
var default_lon = -6.2627662;

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

