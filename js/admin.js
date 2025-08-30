// js/admin.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const adminGeminiApiKeyInput = document.getElementById('admin-gemini-api-key');
    const adminWeatherApiKeyInput = document.getElementById('admin-weatherapi-key'); // New
    const adminReplicateApiTokenInput = document.getElementById('admin-replicate-api-token'); // New
    const freemiumToggle = document.getElementById('freemium-toggle');
    const freeTierMessageLimitInput = document.getElementById('free-tier-message-limit');
    const adminRazorpayKeyIdInput = document.getElementById('admin-razorpay-key-id');
    const saveAdminSettingsBtn = document.getElementById('save-admin-settings-btn');
    const adminMessageElement = document.getElementById('admin-message');

    // Revenue Overview Elements
    const totalUsersCount = document.getElementById('total-users-count');
    const premiumUsersCount = document.getElementById('premium-users-count');
    const monthlyRevenue = document.getElementById('monthly-revenue');
    const userDistributionChartCanvas = document.getElementById('user-distribution-chart');

    let currentUser = null;
    let userChart = null; // To store the Chart.js instance

    // --- Configuration for revenue calculation ---
    const PLAN_PRICES = {
        'basic': 2.50,
        'premium': 5.00
    };

    // --- Authentication State & Admin Check ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            console.log("Admin page: User logged in", user.uid);
            const userProfileRef = doc(db, 'users', user.uid, 'profile', 'data');
            const profileSnap = await getDoc(userProfileRef);

            if (profileSnap.exists() && profileSnap.data().isAdmin) {
                console.log("Admin user confirmed. Loading settings.");
                loadAdminSettings();
                loadUserStats(); // Load and display user statistics
            } else {
                console.warn("User is not an admin, redirecting to chat.");
                window.location.href = '/index.html';
            }
        } else {
            console.log("No user on Admin page, redirecting to auth.");
            window.location.href = '/auth.html';
        }
    });

    // --- Firebase Data Loading ---
    async function loadAdminSettings() {
        try {
            const adminSettingsRef = doc(db, 'admin_settings', 'global_settings');
            const docSnap = await getDoc(adminSettingsRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                adminGeminiApiKeyInput.value = data.geminiApiKey || '';
                adminWeatherApiKeyInput.value = data.weatherApiKey || ''; // New
                adminReplicateApiTokenInput.value = data.replicateApiToken || ''; // New
                freemiumToggle.checked = data.freemiumEnabled || false;
                freeTierMessageLimitInput.value = data.freeTierMessageLimit || 10;
                adminRazorpayKeyIdInput.value = data.razorpayKeyId || '';
                showMessage('', 'message-text');
                console.log("Admin settings loaded from Firestore.");
            } else {
                adminGeminiApiKeyInput.value = '';
                adminWeatherApiKeyInput.value = '';
                adminReplicateApiTokenInput.value = '';
                freemiumToggle.checked = false;
                freeTierMessageLimitInput.value = 10;
                adminRazorpayKeyIdInput.value = '';
                showMessage('No admin settings found. Please configure them.', 'warning-message');
                console.log("No admin settings document found.");
            }
        } catch (error) {
            console.error("Error loading admin settings: ", error);
            showMessage('Error loading admin settings.', 'error-message');
        } finally {
            // Ensure inputs are enabled after load attempt
            adminGeminiApiKeyInput.disabled = false;
            adminWeatherApiKeyInput.disabled = false; // New
            adminReplicateApiTokenInput.disabled = false; // New
            freemiumToggle.disabled = false;
            freeTierMessageLimitInput.disabled = false;
            adminRazorpayKeyIdInput.disabled = false;
            saveAdminSettingsBtn.disabled = false;
        }
    }

    // --- Firebase Data Saving ---
    async function saveAdminSettings() {
        if (!currentUser) {
            showMessage('User not logged in. Cannot save settings.', 'error-message');
            return;
        }

        const geminiApiKey = adminGeminiApiKeyInput.value.trim();
        const weatherApiKey = adminWeatherApiKeyInput.value.trim(); // New
        const replicateApiToken = adminReplicateApiTokenInput.value.trim(); // New
        const freemiumEnabled = freemiumToggle.checked;
        const freeTierMessageLimit = parseInt(freeTierMessageLimitInput.value, 10);
        const razorpayKeyId = adminRazorpayKeyIdInput.value.trim();

        // Basic validation
        if (!geminiApiKey) {
            showMessage('Google Gemini API key is required for AI functionality.', 'warning-message');
            return;
        }
        if (!weatherApiKey) { // Weather key is now essential for weather features
             showMessage('WeatherAPI.com Key is required for weather updates.', 'warning-message');
             return;
        }
        if (!replicateApiToken) { // Replicate token is now essential for image generation
             showMessage('Replicate API Token is required for image generation.', 'warning-message');
             return;
        }
        if (isNaN(freeTierMessageLimit) || freeTierMessageLimit < 1) {
            showMessage('Free tier message limit must be a number greater than 0.', 'warning-message');
            return;
        }
        if (freemiumEnabled && !razorpayKeyId) {
             showMessage('Razorpay Key ID is required if Freemium Mode is enabled.', 'warning-message');
             return;
        }


        saveAdminSettingsBtn.disabled = true;
        showMessage('Saving settings...', '');

        try {
            const adminSettingsRef = doc(db, 'admin_settings', 'global_settings');
            await setDoc(adminSettingsRef, {
                geminiApiKey: geminiApiKey,
                weatherApiKey: weatherApiKey, // New
                replicateApiToken: replicateApiToken, // New
                freemiumEnabled: freemiumEnabled,
                freeTierMessageLimit: freeTierMessageLimit,
                razorpayKeyId: razorpayKeyId,
                updatedAt: new Date()
            }, { merge: true });

            showMessage('Admin Settings saved successfully!', 'success-message');
            console.log("Admin settings saved to Firestore.");

        } catch (error) {
            console.error("Error saving admin settings: ", error);
            showMessage(`Error saving settings: ${error.message}`, 'error-message');
        } finally {
            saveAdminSettingsBtn.disabled = false;
            setTimeout(() => {
                showMessage('', 'message-text');
            }, 5000);
        }
    }

    // --- User Statistics and Revenue Overview ---
    async function loadUserStats() {
        try {
            const usersCollectionRef = collection(db, 'users');
            const querySnapshot = await getDocs(usersCollectionRef);

            let totalUsers = 0;
            let freeUsers = 0;
            let basicUsers = 0;
            let premiumUsers = 0;
            let totalMonthlyRevenue = 0;

            for (const userDoc of querySnapshot.docs) {
                totalUsers++;
                const profileRef = doc(db, 'users', userDoc.id, 'profile', 'data');
                const profileSnap = await getDoc(profileRef);
                
                let planType = 'free';
                if (profileSnap.exists()) {
                    planType = profileSnap.data().planType || 'free';
                }

                switch (planType) {
                    case 'basic':
                        basicUsers++;
                        totalMonthlyRevenue += (PLAN_PRICES.basic || 0);
                        break;
                    case 'premium':
                        premiumUsers++;
                        totalMonthlyRevenue += (PLAN_PRICES.premium || 0);
                        break;
                    case 'free':
                    default:
                        freeUsers++;
                        break;
                }
            }

            totalUsersCount.textContent = totalUsers;
            premiumUsersCount.textContent = (basicUsers + premiumUsers); // Display total paid users
            monthlyRevenue.textContent = `$${totalMonthlyRevenue.toFixed(2)}`;

            renderUserDistributionChart(freeUsers, basicUsers, premiumUsers);

        } catch (error) {
            console.error("Error loading user statistics:", error);
            totalUsersCount.textContent = 'Error';
            premiumUsersCount.textContent = 'Error';
            monthlyRevenue.textContent = 'Error';
        }
    }

    function renderUserDistributionChart(freeUsers, basicUsers, premiumUsers) {
        const ctx = userDistributionChartCanvas.getContext('2d');

        if (userChart) {
            userChart.destroy(); // Destroy existing chart before creating a new one
        }

        userChart = new Chart(ctx, {
            type: 'bar', // Can be 'pie', 'doughnut', 'line', 'bar'
            data: {
                labels: ['Free Users', 'Basic Users', 'Premium Users'], // Updated labels
                datasets: [{
                    label: 'Number of Users',
                    data: [freeUsers, basicUsers, premiumUsers], // Updated data
                    backgroundColor: [
                        'rgba(102, 102, 153, 0.7)', // Muted purple for free
                        'rgba(74, 144, 226, 0.7)',  // Accent blue for basic
                        'rgba(160, 95, 255, 0.7)' // Accent purple for premium
                    ],
                    borderColor: [
                        'rgba(102, 102, 153, 1)',
                        'rgba(74, 144, 226, 1)',
                        'rgba(160, 95, 255, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0,
                            color: getComputedStyle(document.body).getPropertyValue('--muted-text-color')
                        },
                        grid: {
                             color: getComputedStyle(document.body).getPropertyValue('--border-color')
                        }
                    },
                    x: {
                        ticks: {
                            color: getComputedStyle(document.body).getPropertyValue('--muted-text-color')
                        },
                         grid: {
                             color: getComputedStyle(document.body).getPropertyValue('--border-color')
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: getComputedStyle(document.body).getPropertyValue('--text-color')
                        }
                    },
                    title: {
                        display: true,
                        text: 'User Plan Distribution',
                        color: getComputedStyle(document.body).getPropertyValue('--text-color')
                    }
                }
            }
        });
        console.log("Chart rendered.");
    }


    // --- Helper Functions ---
    function showMessage(text, className) {
        adminMessageElement.textContent = text;
        adminMessageElement.className = 'message-text';
        if (className && className !== 'message-text') {
            adminMessageElement.classList.add(className);
        }
    }

    // --- Event Listeners ---
    saveAdminSettingsBtn.addEventListener('click', saveAdminSettings);
});