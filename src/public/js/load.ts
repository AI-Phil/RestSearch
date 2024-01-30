function attachLoadFunctionality() {
    const loadModeButton = document.getElementById('loadModeButton') as HTMLButtonElement;
    const loadDataButton = document.getElementById('loadDataButton') as HTMLButtonElement;
    const progressText = document.getElementById('progress-text') as HTMLElement;

    if (!progressText || !loadDataButton || !loadModeButton) {
        console.error('Required elements not found in the DOM');
        return;
    }

    loadDataButton.addEventListener('click', () => {
        loadModeButton.style.display = 'none'; // Hide the Load Data button        
        loadDataButton.style.display = 'none'; // Hide the Load Data button        

        // Start the load process
        fetch('/load')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Load request failed');
                }
                // Don't wait for the load to complete, start updating progress immediately
                updateProgress();
            }).catch(error => {
                console.error('Error starting load:', error);
                progressText.innerText = 'Error starting load.';
            });
    
        // Start updating the progress immediately after initiating the load
        updateProgress();
    });
        
    function updateProgress() {
        fetch('/load-progress')
            .then(response => response.json())
            .then(data => {
                if (data.loadedRecords === -1) {
                    // Load complete
                    progressText.innerText = 'Load Complete!';
                    loadModeButton.style.display = 'block';
                } else {
                    // Update progress text
                    progressText.innerText = `Records loaded: ${data.loadedRecords}`;
                    setTimeout(updateProgress, 1000); // Continue updating every second
                }
            })
            .catch(error => {
                console.error('Error:', error);
                progressText.innerText = 'Error fetching progress.';
            });
    }
}

export { attachLoadFunctionality };
