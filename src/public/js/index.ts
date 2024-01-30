import { mapUtils } from './map';
import { attachFindFunctionality } from './find';
import { attachReviewFunctionality } from './review';
import { attachLoadFunctionality } from './load';

document.addEventListener('DOMContentLoaded', function() {
    fetchConfig().then(config => {
        mapUtils.initMap(config.MAP_INIT_LATITUDE, config.MAP_INIT_LONGITUDE).then(() => {
            attachFindFunctionality();
            attachReviewFunctionality();
            attachLoadFunctionality();
        }).catch(error => {
            console.error('Error initializing map:', error);
        });    
    });
    
    const reviewModeButton = document.getElementById('reviewModeButton') as HTMLButtonElement;
    if (reviewModeButton) {
        reviewModeButton.addEventListener('click', toggleReviewMode);
    }

    const loadModeButton = document.getElementById('loadModeButton') as HTMLButtonElement;
    if (loadModeButton) {
        loadModeButton.addEventListener('click', toggleLoadMode);
    }

});

type Mode = 'find' | 'review' | 'load';
let currentMode: Mode = 'find';

function toggleReviewMode(): void {
    const findWidgets = document.getElementById('findWidgets') as HTMLElement;
    const reviewWidgets = document.getElementById('reviewWidgets') as HTMLElement;
    const loadModeButton = document.getElementById('loadModeButton') as HTMLButtonElement;
    const reviewModeButton = document.getElementById('reviewModeButton') as HTMLButtonElement;

    if (currentMode !== 'review') {
        reviewWidgets.style.display = 'block';
        findWidgets.style.display = 'none';
        loadModeButton.style.display = 'none';
        reviewModeButton.textContent = 'Exit Review Mode';
        currentMode = 'review';
    } else {
        findWidgets.style.display = 'block';
        loadModeButton.style.display = 'block';
        reviewWidgets.style.display = 'none';
        reviewModeButton.textContent = 'Review Mode';
        currentMode = 'find';
    }
    mapUtils.clearAllMarkers();
}

function toggleLoadMode(): void {
    const findWidgets = document.getElementById('findWidgets') as HTMLElement;
    const loadWidgets = document.getElementById('loadWidgets') as HTMLElement;
    const loadModeButton = document.getElementById('loadModeButton') as HTMLButtonElement;
    const reviewModeButton = document.getElementById('reviewModeButton') as HTMLButtonElement;

    if (currentMode !== 'load') {
        loadWidgets.style.display = 'block';
        findWidgets.style.display = 'none';
        reviewModeButton.style.display = 'none';
        loadModeButton.textContent = 'Exit Load Mode';
        currentMode = 'load';
    } else {
        findWidgets.style.display = 'block';
        reviewModeButton.style.display = 'block';
        loadWidgets.style.display = 'none';
        loadModeButton.textContent = 'Load Mode';
        currentMode = 'find';
    }
    mapUtils.clearAllMarkers();
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
