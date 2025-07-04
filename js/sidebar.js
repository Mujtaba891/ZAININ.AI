// js/sidebar.js

function initSidebarToggle() {
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    const mainContent = document.querySelector('.main-content'); // Assuming main content needs adjustment

    if (!sidebar || !sidebarToggleBtn || !mainContent) {
        console.warn("Sidebar elements not found.");
        return;
    }

    sidebarToggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('active');
         // Add/remove class to main content to push it or not
        mainContent.classList.toggle('sidebar-active');
    });

    // Optional: Close sidebar when clicking outside on smaller screens
    // (Needs more complex logic checking screen size and click target)
}

// Call initSidebarToggle from index.js and profile.js when DOM is ready
// Example: initSidebarToggle(); at the end of DOMContentLoaded listener