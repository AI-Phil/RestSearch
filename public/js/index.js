var currentMode = 'find'; // Default mode

function toggleMode() {
    if (currentMode === 'find') {
        // Switch to review mode
        document.getElementById('findWidgets').style.display = 'none';
        document.getElementById('reviewWidgets').style.display = 'block';
        document.getElementById('modeToggle').textContent = 'Exit Review Mode';
        currentMode = 'review';
    } else {
        // Switch back to find mode
        document.getElementById('findWidgets').style.display = 'block';
        document.getElementById('reviewWidgets').style.display = 'none';
        document.getElementById('modeToggle').textContent = 'Enter Review Mode';
        currentMode = 'find';
    }
    mapUtils.clearAllMarkers();
}

function changeMapLocation() {
    const locationName = document.getElementById('locationInput').value;
    if (locationName) {
        mapUtils.moveToLocation(locationName).then(() => {
            console.log("Map moved to:", locationName);
        }).catch(error => {
            console.error('Error moving map:', error);
        });
    } else {
        alert("Please enter a location name.");
    }
}

function handleKeyPress(activity, event) {
    if (activity == "changeMapLocation" && event.keyCode === 13) {
        changeMapLocation();
    }
}

function getCurrentMode() {
    return currentMode;
}

window.main = {
    getCurrentMode,
}