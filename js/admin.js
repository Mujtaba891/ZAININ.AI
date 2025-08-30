// js/admin.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const adminOpenrouterKeyInput = document.getElementById('admin-openrouter-key');
    const adminGeminiVisionKeyInput = document.getElementById('admin-gemini-vision-key');
    const adminSerpapiKeyInput = document.getElementById('admin-serpapi-key');
    const freemiumToggle = document.getElementById('freemium-toggle');
    const freeTierMessageLimitInput = document.getElementById('free-tier-message-limit');
    const adminRazorpayKeyIdInput = document.getElementById('admin-razorpay-key-id'); // New: Razorpay Key ID
    const saveAdminSettingsBtn = document.getElementById('save-admin-settings-btn');
    const adminMessageElement = document.getElementById('admin-message');

    // Revenue Overview Elements
    const totalUsersCount = document.getElementById('total-users-count');
    const premiumUsersCount = document.getElementById('premium-users-count');
    const monthlyRevenue = document.getElementById('monthly-revenue');
    const userDistributionChartCanvas = document.getElementById('user-distribution-chart');

    let currentUser = null;
    let userChart = null; // To store the Chart.js instance

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
                adminOpenrouterKeyInput.value = data.openrouterKey || '';
                adminGeminiVisionKeyInput.value = data.geminiVisionKey || '';
                adminSerpapiKeyInput.value = data.serpapiKey || '';
                freemiumToggle.checked = data.freemiumEnabled || false;
                freeTierMessageLimitInput.value = data.freeTierMessageLimit || 10;
                adminRazorpayKeyIdInput.value = data.razorpayKeyId || ''; // Load Razorpay Key ID
                showMessage('', 'message-text');
                console.log("Admin settings loaded from Firestore.");
            } else {
                adminOpenrouterKeyInput.value = '';
                adminGeminiVisionKeyInput.value = '';
                adminSerpapiKeyInput.value = '';
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
            adminOpenrouterKeyInput.disabled = false;
            adminGeminiVisionKeyInput.disabled = false;
            adminSerpapiKeyInput.disabled = false;
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

        const openrouterKey = adminOpenrouterKeyInput.value.trim();
        const geminiVisionKey = adminGeminiVisionKeyInput.value.trim();
        const serpapiKey = adminSerpapiKeyInput.value.trim();
        const freemiumEnabled = freemiumToggle.checked;
        const freeTierMessageLimit = parseInt(freeTierMessageLimitInput.value, 10);
        const razorpayKeyId = adminRazorpayKeyIdInput.value.trim(); // Get Razorpay Key ID

        // Basic validation
        if (!openrouterKey) {
            showMessage('OpenRouter key is required for AI functionality.', 'warning-message');
            return;
        }
        // Gemini vision key is required if image recognition is used, but not strictly for all AI
        // For simplicity, make it required if freemium is on or if we expect multimodal generally
        // if (!geminiVisionKey) {
        //     showMessage('Google Gemini Vision key is required for image recognition.', 'warning-message');
        //     return;
        // }
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
                openrouterKey: openrouterKey,
                geminiVisionKey: geminiVisionKey,
                serpapiKey: serpapiKey,
                freemiumEnabled: freemiumEnabled,
                freeTierMessageLimit: freeTierMessageLimit,
                razorpayKeyId: razorpayKeyId, // Save Razorpay Key ID
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
            let premiumUsers = 0;
            const premiumPlanCost = 5.00; // $5.00 per month (matches pricing.html)

            // Iterate through each user's root document to get their profile/data subcollection
            for (const userDoc of querySnapshot.docs) {
                totalUsers++;
                const profileRef = doc(db, 'users', userDoc.id, 'profile', 'data');
                const profileSnap = await getDoc(profileRef);
                if (profileSnap.exists() && profileSnap.data().isPremium) {
                    premiumUsers++;
                }
            }

            totalUsersCount.textContent = totalUsers;
            premiumUsersCount.textContent = premiumUsers;
            monthlyRevenue.textContent = `$${(premiumUsers * premiumPlanCost).toFixed(2)}`;

            renderUserDistributionChart(totalUsers - premiumUsers, premiumUsers);

        } catch (error) {
            console.error("Error loading user statistics:", error);
            totalUsersCount.textContent = 'Error';
            premiumUsersCount.textContent = 'Error';
            monthlyRevenue.textContent = 'Error';
        }
    }

    function renderUserDistributionChart(freeUsers, premiumUsers) {
        const ctx = userDistributionChartCanvas.getContext('2d');

        if (userChart) {
            userChart.destroy(); // Destroy existing chart before creating a new one
        }

        userChart = new Chart(ctx, {
            type: 'bar', // Can be 'pie', 'doughnut', 'line', 'bar'
            data: {
                labels: ['Free Users', 'Premium Users'],
                datasets: [{
                    label: 'Number of Users',
                    data: [freeUsers, premiumUsers],
                    backgroundColor: [
                        'rgba(102, 102, 153, 0.7)', // Muted purple for free (dark mode friendly)
                        'rgba(74, 144, 226, 0.7)'  // Accent blue for premium
                    ],
                    borderColor: [
                        'rgba(102, 102, 153, 1)',
                        'rgba(74, 144, 226, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Allow canvas to take available width
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0, // Ensure integer ticks
                            color: getComputedStyle(document.body).getPropertyValue('--muted-text-color')
                        },
                        grid: {
                             color: getComputedStyle(document.body).getPropertyValue('--border-color') // Match grid lines to theme
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
                            color: getComputedStyle(document.body).getPropertyValue('--text-color') // Legend text color
                        }
                    },
                    title: {
                        display: true,
                        text: 'User Plan Distribution',
                        color: getComputedStyle(document.body).getPropertyValue('--text-color') // Title text color
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