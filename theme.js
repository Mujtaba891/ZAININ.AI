/**
 * ZAININ AI - Global Theme Script
 * @description Handles loading and applying the saved theme preference (light/dark)
 * on page load for consistency across the site.
 */

document.addEventListener('DOMContentLoaded', () => {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const body = document.body;

    // Function to apply the theme
    function applyTheme(theme) {
        if (theme === 'light') {
            body.classList.add('light-theme');
            // Update toggle button icon if it exists
            if (themeToggleBtn) {
                 themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
            }
        } else { // Default to dark theme
            body.classList.remove('light-theme');
             // Update toggle button icon if it exists
             if (themeToggleBtn) {
                 themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
             }
        }
    }

    // Function to toggle and save the theme
    function toggleTheme() {
        const currentTheme = body.classList.contains('light-theme') ? 'light' : 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        applyTheme(newTheme); // Apply the new theme immediately
        localStorage.setItem('theme', newTheme); // Save preference to localStorage
         console.log(`Theme toggled to: ${newTheme}`);
    }

    // --- Initialization ---

    // 1. Check localStorage for saved theme preference
    const savedTheme = localStorage.getItem('theme');

    // 2. Apply saved theme or default to dark if no preference is found
    if (savedTheme) {
        applyTheme(savedTheme);
         console.log(`Applied saved theme: ${savedTheme}`);
    } else {
        // Optional: Check system preference (prefers-color-scheme) if no saved theme
        // if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        //     applyTheme('light');
        // } else {
             applyTheme('dark'); // Default to dark
             console.log("No saved theme found, applying default dark theme.");
        // }
    }

    // 3. Add event listener to the toggle button (only if it exists on the page)
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
         console.log("Theme toggle button listener added.");
    } else {
         console.log("Theme toggle button not found on this page.");
    }
});