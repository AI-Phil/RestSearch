import { mapUtils } from './map';
import { getCurrentMode } from './index';
import { Amenity } from '../../schema/Amenity';

function attachFindFunctionality(): void {
    mapUtils.map.on('click', async function(e: L.LeafletMouseEvent) {
        if (getCurrentMode() === 'find') {
            showMarkers(e);
        }
    });

    const locationInput = document.getElementById('locationInput') as HTMLInputElement;
    if (locationInput) {
        locationInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                mapUtils.changeMapLocation();
            }
        });
    }

    const locationButton = document.getElementById('locationButton') as HTMLButtonElement;
    if (locationButton) {
        locationButton.addEventListener('click', mapUtils.changeMapLocation);
    }

    const findRadiusSlider = document.getElementById('findRadiusSlider') as HTMLInputElement;
    if (findRadiusSlider) {
        findRadiusSlider.addEventListener('input', (event) => {
            // Ensure event.target is not null and is an instance of HTMLInputElement
            if (event.target && event.target instanceof HTMLInputElement) {
                updateFindRadiusValue(event.target.value);
            }
        });
    }   
}

async function showMarkers(e: L.LeafletMouseEvent) {
    const radiusSlider = document.getElementById('findRadiusSlider') as HTMLInputElement;
    const searchInput = document.getElementById('searchTextInput') as HTMLInputElement;
    const findLimitInput = document.getElementById('numFindLocations') as HTMLInputElement;

    const radius = parseInt(radiusSlider.value, 10);
    const searchText = searchInput.value.trim();
    const findLimit = parseInt(findLimitInput.value, 10)

    mapUtils.clearAllMarkers();

    let amenities: Amenity[] = [];    
    amenities = await findWithinRadius(searchText, findLimit, radius, e.latlng.lat, e.latlng.lng);

    mapUtils.addMarkers(amenities, mapUtils.greenIcon, updateReviewsContainer);
}

function updateReviewsContainer(amenity: Amenity) {
    const reviewsContainer = document.getElementById('reviewsContainer');
    if (reviewsContainer) {
        // Clear existing content and set a title for the reviews section
        reviewsContainer.innerHTML = `
        <hr>
        <h4>Reviews for ${amenity.name}</h4>`;

        reviewsContainer.innerHTML += `
        <div id="disclaimerReview" class="disclaimer">
        <span>Disclaimer: All reviews are fabricated by an LLM and are not representative of real-world establishments.</span>
        </div>`;

        // Start the table with headers
        let tableHTML = `
            <table class="reviews-table">
                <thead>
                    <tr>
                        <th>Reviewer & Rating</th>
                        <th>Review</th>
                    </tr>
                </thead>
                <tbody>`;

        // Populate the table rows with review data
        amenity.reviews.forEach(review => {
            const similarityText = (review.similarity && review.similarity !== undefined) ? ` (${(review.similarity * 100).toFixed(0)}%)` : ''

            tableHTML += `
                <tr>
                    <td>
                        <strong>${review.reviewer}</strong><br>
                        Rating: ${review.rating}
                    </td>
                    <td>${review.review_text}${similarityText}</td>
                </tr>
            `;
        });

        // Close the table tags
        tableHTML += '</tbody></table>';

        // Update the container's HTML
        reviewsContainer.innerHTML += tableHTML;
    }
}

function updateFindRadiusValue(value: string): void {
    const findRadius = document.getElementById('findRadius') as HTMLElement;
    if (findRadius) {
        findRadius.textContent = value;
    }
}

async function findWithinRadius(searchText: string, k: number, radius: number, lat: number, lon: number): Promise<Amenity[]> {
    try {
        const response = await fetch('/find-within-radius', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: searchText,
                k: k,
                radius,
                lat,
                lon
            })
        });

        if (!response.ok) {
            // Throw an error with response status to handle it in the catch block
            throw new Error(`Error fetching data: ${response.status}`);
        }

        // If response is OK, parse and return the JSON data
        return await response.json();
    } catch (error) {
        // Log the error for debugging purposes
        console.error('Error fetching amenities:', error);
        // Return an empty array or handle the error as per your app's logic
        return [];
    }
}


export { attachFindFunctionality }