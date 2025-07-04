// js/theme.js
// Basic Theme Toggle Logic

document.addEventListener('DOMContentLoaded', () => {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeIcon = themeToggleBtn ? themeToggleBtn.querySelector('i') : null;

    // Check local storage for theme preference, default to dark
    let currentTheme = localStorage.getItem('theme') || 'dark';

    function applyTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if (themeIcon) {
            if (theme === 'dark') {
                themeIcon.classList.remove('fa-sun');
                themeIcon.classList.add('fa-moon');
            } else { // light
                themeIcon.classList.remove('fa-moon');
                themeIcon.classList.add('fa-sun');
            }
        }
        // Optional: Update CSS variables based on theme
        // This requires a more complex setup where CSS variables are defined per theme
        // For simplicity here, we assume CSS handles the data-theme attribute
        // Or, you could dynamically update --primary-color etc. here
         if (theme === 'light') {
            // Example: Define light theme variables (add these to style.css under body[data-theme="light"])
            /*
            document.body.style.setProperty('--bg-color', '#f0f0f0');
            document.body.style.setProperty('--surface-color', '#ffffff');
            document.body.style.setProperty('--text-color', '#333');
            // etc.
            */
             console.warn("Light theme styles are not fully implemented in style.css.");
         } else {
              // Reset to default (dark theme variables)
              /*
             document.body.style.removeProperty('--bg-color');
             // etc.
              */
         }
    }

    // Apply the saved theme on load
    applyTheme(currentTheme);

    // Add event listener to the toggle button
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(currentTheme);
        });
    } else {
        console.warn("Theme toggle button not found.");
    }
});

// Note: You need to add CSS rules in style.css based on body[data-theme="light"]
/*
body[data-theme="light"] {
    --bg-color: #f0f2f5;
    --surface-color: #ffffff;
    --text-color: #333;
    --muted-text-color: #666;
    --border-color: #ddd;
    --input-bg: #eee;
    --button-bg: #007bff;
    --button-color: #fff;
    --link-color: #007bff;
    --chat-user-bg: #e2e6ea;
    --chat-bot-bg: #007bff;
     --scrollbar-thumb: #aaa;
    --scrollbar-track: #eee;
}

body[data-theme="light"] .chat-bot-bg {
     background: #007bff; // Simple solid color for light mode
}

body[data-theme="light"] #google-signin-btn {
    background-color: #4285f4; // Keep standard Google button color
    color: white;
}
*/