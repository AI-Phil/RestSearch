import { mapUtils } from './map';
import { getCurrentMode } from './index';
import { Amenity } from '../../schema/Amenity';

function attachFindFunctionality(): void {
    mapUtils.map.on('click', async function(e: L.LeafletMouseEvent) {
        if (getCurrentMode() === 'find') {
            const radiusSlider = document.getElementById('findRadiusSlider') as HTMLInputElement;
            const searchInput = document.getElementById('searchTextInput') as HTMLInputElement;
            const findLimitInput = document.getElementById('numFindLocations') as HTMLInputElement;
            const radius = parseInt(radiusSlider.value, 10);
            const searchText = searchInput.value.trim();
            const findLimit = parseInt(findLimitInput.value, 10)

            let amenities: Amenity[] = [];    
            if (searchText) {
                amenities = await findTextWithinRadius(searchText, findLimit, radius, e.latlng.lat, e.latlng.lng);
            } else {
                amenities = await mapUtils.getAmenitiesWithinRadius(radius, mapUtils.default_amenity, findLimit);
            }
    
            mapUtils.clearAllMarkers();
            mapUtils.addMarkers(amenities, mapUtils.greenIcon);
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

function updateFindRadiusValue(value: string): void {
    const findRadius = document.getElementById('findRadius') as HTMLElement;
    if (findRadius) {
        findRadius.textContent = value;
    }
}

async function findTextWithinRadius(searchText: string, k: number, radius: number, lat: number, lon: number): Promise<Amenity[]> {
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