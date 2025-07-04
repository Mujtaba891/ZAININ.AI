"use strict";

/**
 * ZAININ AI - API Key Management & Tutorial Script
 * @description Handles saving user-provided API keys to localStorage and manages the tutorial video modal.
 */

document.addEventListener('DOMContentLoaded', () => {
    const openrouterKeyInput = document.getElementById('openrouter-key');
    const serpapiKeyInput = document.getElementById('serpapi-key');
    const saveButton = document.getElementById('save-api-keys-btn');
    const messageText = document.getElementById('api-key-message');

    const tutorialBtn = document.getElementById('tutorial-btn');
    const tutorialOverlay = document.getElementById('tutorial-overlay');
    const tutorialModal = document.getElementById('tutorial-modal');
    const tutorialCloseBtn = document.getElementById('tutorial-close-btn');
    const videoContainer = document.getElementById('video-container');

    // --- API Key Logic ---

    // Load existing keys on page load
    openrouterKeyInput.value = localStorage.getItem('openrouterKey') || '';
    serpapiKeyInput.value = localStorage.getItem('serpapiKey') || '';

    // Add event listener to save button
    saveButton.addEventListener('click', () => {
        const openrouterKey = openrouterKeyInput.value.trim();
        const serpapiKey = serpapiKeyInput.value.trim(); // SerpApi key is optional

        if (!openrouterKey) {
            messageText.textContent = 'OpenRouter API Key is required.';
            messageText.style.color = 'var(--color-error)';
            messageText.style.opacity = 1; // Ensure visible
            return;
        }

        // Save to localStorage
        localStorage.setItem('openrouterKey', openrouterKey);
        localStorage.setItem('serpapiKey', serpapiKey); // Save even if empty/removed

        messageText.textContent = 'API Keys saved successfully!';
        messageText.style.color = 'var(--color-success)';
        messageText.style.opacity = 1; // Ensure visible

        // Optional: Fade out message after a few seconds
        setTimeout(() => {
            messageText.style.opacity = 0; // Fade out
        }, 3000);
    });


    // --- Tutorial Modal Logic ---

    // Placeholder for video source. You can replace this with a link to a local video or another YouTube video.
    // Using a YouTube embed URL is generally easier as YouTube handles the player and controls.
    const tutorialVideoSrc = 'https://www.youtube.com/embed/FjcNeYiZWDk?si=mYCd9_2W8Dcr2MZv'; // Example YouTube embed URL (Rickroll - replace with real tutorial!)
    const isYouTube = tutorialVideoSrc.includes('youtube.com') || tutorialVideoSrc.includes('youtu.be');
    // For a local video: const tutorialVideoSrc = '/assets/videos/api_tutorial.mp4'; const isYouTube = false;


    /**
     * Opens the tutorial modal and loads the video.
     */
    function openTutorialModal() {
        tutorialOverlay.classList.remove('hidden');
        tutorialModal.classList.remove('hidden'); // Assuming modal is display: none by default
        // Allow backdrop-filter transition to complete before showing content if needed

        // Clear previous video content
        videoContainer.innerHTML = '';

        if (isYouTube) {
            // Create YouTube iframe
            const iframe = document.createElement('iframe');
            iframe.setAttribute('src', tutorialVideoSrc);
            iframe.setAttribute('frameborder', '0');
            iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
            iframe.setAttribute('allowfullscreen', '');
            iframe.style.width = '100%'; // Style via CSS class if preferred
            iframe.style.height = '100%'; // Style via CSS class if preferred
            videoContainer.appendChild(iframe);
             console.log("Loading YouTube tutorial:", tutorialVideoSrc);

        } else {
            // Create local video element (basic controls)
            const video = document.createElement('video');
            video.setAttribute('src', tutorialVideoSrc);
            video.setAttribute('controls', ''); // Add default browser controls
            video.setAttribute('autoplay', ''); // Autoplay (might be blocked by browsers)
             video.setAttribute('playsinline', ''); // Recommended for mobile autoplay
            video.style.width = '100%'; // Style via CSS class if preferred
            video.style.height = 'auto'; // Maintain aspect ratio
            videoContainer.appendChild(video);
             console.log("Loading local tutorial:", tutorialVideoSrc);

            // If you need custom controls, you would add them here and implement their JS logic.
            // This example uses default controls for local video for simplicity.
        }
    }

    /**
     * Closes the tutorial modal and stops the video.
     */
    function closeTutorialModal() {
        // Stop video playback
        videoContainer.innerHTML = ''; // This removes the video element and stops playback

        tutorialOverlay.classList.add('hidden');
        // Optionally hide the modal content sooner if you have exit animations
        // tutorialModal.classList.add('hidden');
         console.log("Closing tutorial modal.");
    }

    // Add event listeners for tutorial modal
    if (tutorialBtn) {
        tutorialBtn.addEventListener('click', openTutorialModal);
    }
    if (tutorialCloseBtn) {
        tutorialCloseBtn.addEventListener('click', closeTutorialModal);
    }
    if (tutorialOverlay) {
        // Close modal if clicking on the overlay itself (but not the modal content)
        tutorialOverlay.addEventListener('click', (event) => {
            if (event.target === tutorialOverlay) {
                closeTutorialModal();
            }
        });
    }
    // Close on Escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !tutorialOverlay.classList.contains('hidden')) {
            closeTutorialModal();
        }
    });
});