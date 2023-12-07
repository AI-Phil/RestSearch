var selectedAmenities = [];

document.addEventListener('DOMContentLoaded', function() {
    mapUtils.awaitMapInitialization().then(attachReviewFunctionality).catch(error => {
        console.error('Error initializing map:', error);
    });
});

function attachReviewFunctionality(map) {
    map.on('click', async function(e) {
        if (main.getCurrentMode() === 'review') {
            var radius = parseInt(document.getElementById('reviewRadiusSlider').value);
            var closestN = parseInt(document.getElementById('numSelectionsPerClick').value);
            try {
                var amenities = await mapUtils.getAmenitiesWithinRadius(radius, 'restaurant', closestN);
                mapUtils.addMarkers(amenities, mapUtils.greenIcon);
                updateSelectedCount();
            } catch (error) {
                console.error("Error fetching amenities:", error);
            }
        }
    });
}

function updateSelectedCount() {
    selectedAmenities = mapUtils.getAmenitiesWithIcon(mapUtils.greenIcon);
    document.getElementById('selectedCountValue').textContent = selectedAmenities.length;
}

function resetSelection() {
    mapUtils.clearAllMarkers();
    updateSelectedCount();
}

function updateReviewRadiusValue(value) {
    document.getElementById('reviewRadius').textContent = value;
}


function showProgressModal(message) {
    document.getElementById('progressText').innerText = message;
    $('#progressModal').modal('show');
}

function hideProgressModal() {
    $('#progressModal').modal('hide');
}

async function generateReviews() {
    var averageReviews = parseInt(document.getElementById('averageReviews').value) || 5;
    var stdDevReviews = parseInt(document.getElementById('stdDevReviews').value) || 2;

    for (let i = 0; i < selectedAmenities.length; i++) {
        var amenity = selectedAmenities[i];
        showProgressModal(`Generating reviews for ${amenity.name} (${i + 1}/${selectedAmenities.length})`);

        // Retrieve the city name
        const cityName = await mapUtils.getCityName();

        const enhancedAmenity = {...amenity, locality_name: cityName };
                
        await fetch('/generate-reviews', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amenity: enhancedAmenity,
                average: averageReviews,
                stdDev: stdDevReviews
            })
        });

        if (i === selectedAmenities.length - 1) {
            showProgressModal("All reviews generated.");
            setTimeout(hideProgressModal, 2000);
        }
    }
}
