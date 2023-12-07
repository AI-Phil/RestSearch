document.addEventListener('DOMContentLoaded', function() {
    mapUtils.awaitMapInitialization().then(attachFindFunctionality).catch(error => {
        console.error('Error initializing map:', error);
    });
});

function attachFindFunctionality(map) {
    map.on('click', async function(e) {
        if (main.getCurrentMode() === 'find') {
            mapUtils.clearAllMarkers();
            var radius = parseInt(document.getElementById('findRadiusSlider').value);
            var amenities = await mapUtils.getAmenitiesWithinRadius(radius, 'restaurant');
            mapUtils.addMarkers(amenities, mapUtils.greenIcon);
        }
    });
}

function updateFindRadiusValue(value) {
    document.getElementById('findRadius').textContent = value;
}
