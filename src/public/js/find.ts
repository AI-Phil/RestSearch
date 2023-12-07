import { mapUtils } from './map';
import { getCurrentMode } from './index';

function attachFindFunctionality(): void {
    mapUtils.map.on('click', async function(e: L.LeafletMouseEvent) {
        if (getCurrentMode() === 'find') {
            mapUtils.clearAllMarkers();
            const radiusSlider = document.getElementById('findRadiusSlider') as HTMLInputElement;
            const radius = parseInt(radiusSlider.value, 10);
            const amenities = await mapUtils.getAmenitiesWithinRadius(radius, 'restaurant');
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

function handleKeyPress(activity: string, event: KeyboardEvent): void {
    if (activity === "changeMapLocation" && event.key === 'Enter') {
        mapUtils.changeMapLocation();
    }
}

export { attachFindFunctionality }