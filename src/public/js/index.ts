import { mapUtils } from './map';
import { attachFindFunctionality } from './find';
import { attachReviewFunctionality } from './review';

document.addEventListener('DOMContentLoaded', function() {
    fetchConfig().then(config => {
        mapUtils.initMap(config.MAP_INIT_LATITUDE, config.MAP_INIT_LONGITUDE).then(() => {
            attachFindFunctionality();
            attachReviewFunctionality();
        }).catch(error => {
            console.error('Error initializing map:', error);
        });    
    });
    
    const modeToggle = document.getElementById('modeToggle') as HTMLButtonElement;
    if (modeToggle) {
        modeToggle.addEventListener('click', toggleMode);
    }

});

type Mode = 'find' | 'review';
let currentMode: Mode = 'find';

function toggleMode(): void {
    const findWidgets = document.getElementById('findWidgets') as HTMLElement;
    const reviewWidgets = document.getElementById('reviewWidgets') as HTMLElement;
    const modeToggle = document.getElementById('modeToggle') as HTMLButtonElement;

    if (currentMode === 'find') {
        findWidgets.style.display = 'none';
        reviewWidgets.style.display = 'block';
        modeToggle.textContent = 'Exit Review Mode';
        currentMode = 'review';
    } else {
        findWidgets.style.display = 'block';
        reviewWidgets.style.display = 'none';
        modeToggle.textContent = 'Enter Review Mode';
        currentMode = 'find';
    }
    mapUtils.clearAllMarkers(); // Ensure mapUtils is properly typed or declared
}

function getCurrentMode(): Mode {
    return currentMode;
}

async function fetchConfig() {
    const response = await fetch('/config');
    const config = await response.json();
    return config;
}

export { getCurrentMode, fetchConfig };
