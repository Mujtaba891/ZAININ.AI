/**
 * ZAININ AI - Global Theme Script
 * @description Handles loading and applying the saved theme preference (light/dark)
 * on page load for consistency across the site. Should be included synchronously in <head>.
 */

(function() {
    const body = document.body;

    // Function to apply the theme class and icon immediately
    function applyTheme(theme) {
        if (theme === 'light') {
            body.classList.add('light-theme');
        } else { // Default to dark theme
            body.classList.remove('light-theme');
        }
        // Update toggle button icon if it exists after the DOM is ready
        // This part needs to be handled after DOMContentLoaded or within the main scripts
    }

    // Check localStorage for saved theme preference *before* DOMContentLoaded
    // This prevents a flash of the wrong theme (FOUC).
    const savedTheme = localStorage.getItem('theme');

    // Apply saved theme or default to dark if no preference is found
    if (savedTheme) {
        applyTheme(savedTheme);
        // console.log(`Applied saved theme synchronously: ${savedTheme}`);
    } else {
        // Optional: Check system preference (prefers-color-scheme) if no saved theme
        // const systemPrefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
        // if (systemPrefersLight) {
        //     applyTheme('light');
        // } else {
             applyTheme('dark'); // Default to dark
             // console.log("No saved theme found, applying default dark theme synchronously.");
        // }
    }


    // --- Deferred Logic for DOM-dependent tasks (like button listener) ---
    document.addEventListener('DOMContentLoaded', () => {
         const themeToggleBtn = document.getElementById('theme-toggle-btn');

         // Function to update the button icon based on the current theme
         function updateThemeToggleButtonIcon() {
             if (themeToggleBtn) {
                 const isLightTheme = body.classList.contains('light-theme');
                 themeToggleBtn.innerHTML = isLightTheme
                     ? '<i class="fas fa-moon"></i>' // Show moon icon for light theme (toggle to dark)
                     : '<i class="fas fa-sun"></i>';  // Show sun icon for dark theme (toggle to light)
                 themeToggleBtn.title = isLightTheme ? 'Switch to Dark Theme' : 'Switch to Light Theme';
             }
         }

         // Function to toggle theme and save preference
         function toggleTheme() {
             const currentTheme = body.classList.contains('light-theme') ? 'light' : 'dark';
             const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

             applyTheme(newTheme); // Apply the new theme immediately (updates class)
             localStorage.setItem('theme', newTheme); // Save preference to localStorage
              console.log(`Theme toggled to: ${newTheme}`);
             updateThemeToggleButtonIcon(); // Update the button icon
         }

         // 1. Initialize the button icon state correctly on page load
         updateThemeToggleButtonIcon();

         // 2. Add event listener to the toggle button (only if it exists on the page)
         if (themeToggleBtn) {
             themeToggleBtn.addEventListener('click', toggleTheme);
             console.log("Theme toggle button listener added.");
         } else {
             // This is expected on pages like auth, privacy, terms, profile unless you add the button there
             // console.log("Theme toggle button not found on this page.");
         }
    });

})(); // Immediately Invoked Function Expression to keep variables out of global scope