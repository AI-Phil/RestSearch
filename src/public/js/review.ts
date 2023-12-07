import { mapUtils } from './map';
import { getCurrentMode } from './index'; 
import { Amenity } from '../../schema/Amenity';

declare const $: JQueryStatic;
let selectedAmenities: Amenity[] = [];

function attachReviewFunctionality(): void {
    mapUtils.map.on('click', async function(e: L.LeafletMouseEvent) {
        if (getCurrentMode() === 'review') {
            const radiusSlider = document.getElementById('reviewRadiusSlider') as HTMLInputElement;
            const closestNSlider = document.getElementById('numSelectionsPerClick') as HTMLInputElement;
            const radius = parseInt(radiusSlider.value, 10);
            const closestN = parseInt(closestNSlider.value, 10);
            try {
                const amenities = await mapUtils.getAmenitiesWithinRadius(radius, 'restaurant', closestN);
                mapUtils.addMarkers(amenities, mapUtils.greenIcon);
                updateSelectedCount();
            } catch (error) {
                console.error("Error fetching amenities:", error);
            }
        }
    });

    const generateReviewsButton = document.getElementById('generateReviewsButton') as HTMLButtonElement;
    if (generateReviewsButton) {
        generateReviewsButton.addEventListener('click', generateReviews);
    }

    const resetSelectionButton = document.getElementById('resetSelectionButton') as HTMLButtonElement;
    if (resetSelectionButton) {
        resetSelectionButton.addEventListener('click', resetSelection);
    }    

}

function updateSelectedCount(): void {
    selectedAmenities = mapUtils.getAmenitiesWithIcon(mapUtils.greenIcon);
    const selectedCountValue = document.getElementById('selectedCountValue');
    if (selectedCountValue) {
        selectedCountValue.textContent = selectedAmenities.length.toString();
    }
}

function resetSelection(): void {
    mapUtils.clearAllMarkers();
    updateSelectedCount();
}

function updateReviewRadiusValue(value: string): void {
    const reviewRadius = document.getElementById('reviewRadius');
    if (reviewRadius) {
        reviewRadius.textContent = value;
    }
}
function showProgressModal(message: string): void {
    const progressText = document.getElementById('progressText');
    if (progressText) {
        progressText.textContent = message;
    }
    $('#progressModal').modal('show');
}

function hideProgressModal(): void {
    $('#progressModal').modal('hide');
}

async function generateReviews(): Promise<void> {
    const averageReviewsInput = document.getElementById('averageReviews') as HTMLInputElement;
    const stdDevReviewsInput = document.getElementById('stdDevReviews') as HTMLInputElement;
    const averageReviews = parseInt(averageReviewsInput.value, 10) || 5;
    const stdDevReviews = parseInt(stdDevReviewsInput.value, 10) || 2;

    for (let i = 0; i < selectedAmenities.length; i++) {
        const amenity = selectedAmenities[i];
        showProgressModal(`Generating reviews for ${amenity.name} (${i + 1}/${selectedAmenities.length})`);

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

export { attachReviewFunctionality, showProgressModal, hideProgressModal, generateReviews };
