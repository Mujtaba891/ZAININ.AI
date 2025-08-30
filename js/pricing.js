// js/pricing.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const pricingMessage = document.getElementById('pricing-message');
    const freePlanCard = document.getElementById('free-plan-card');
    const premiumPlanCard = document.getElementById('premium-plan-card');
    const freeTierMessageLimitDisplay = document.getElementById('free-tier-message-limit-display');

    let currentUser = null;
    let adminSettings = {
        freemiumEnabled: false,
        freeTierMessageLimit: 10,
        razorpayKeyId: null
    };
    let userProfile = {
        isPremium: false,
        planType: 'free'
    };

    // --- Authentication State & Data Load ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            console.log("Pricing page: User logged in", user.uid);
            await loadPricingPageData();
        } else {
            console.log("No user on Pricing page, redirecting to auth.");
            window.location.href = '/auth.html';
        }
    });

    // --- Load Data from Firestore ---
    async function loadPricingPageData() {
        if (!currentUser) return;

        showPricingMessage('Loading pricing information...', 'message-text');
        
        // Load global admin settings
        try {
            const adminSettingsRef = doc(db, 'admin_settings', 'global_settings');
            const adminSnap = await getDoc(adminSettingsRef);
            if (adminSnap.exists()) {
                const data = adminSnap.data();
                adminSettings.freemiumEnabled = data.freemiumEnabled || false;
                adminSettings.freeTierMessageLimit = data.freeTierMessageLimit || 10;
                adminSettings.razorpayKeyId = data.razorpayKeyId || null;
                console.log("Admin settings loaded:", adminSettings);
            } else {
                console.warn("No admin settings found. Freemium features might be limited.");
            }
        } catch (error) {
            console.error("Error loading admin settings:", error);
            showPricingMessage('Error loading global settings. Please try again later.', 'error-message');
            // Disable buttons if critical settings fail to load
            updatePlanCardUI();
            return;
        }

        // Load user profile
        try {
            const userProfileRef = doc(db, 'users', currentUser.uid, 'profile', 'data');
            const profileSnap = await getDoc(userProfileRef);
            if (profileSnap.exists()) {
                const data = profileSnap.data();
                userProfile.isPremium = data.isPremium || false;
                userProfile.planType = data.planType || 'free';
                console.log("User profile loaded:", userProfile);
            } else {
                // If no profile, create a default one (free user)
                console.log("No user profile found, creating default.");
                await setDoc(userProfileRef, { isPremium: false, planType: 'free', createdAt: serverTimestamp() }, { merge: true });
                userProfile.isPremium = false;
                userProfile.planType = 'free';
            }
        } catch (error) {
            console.error("Error loading user profile:", error);
            showPricingMessage('Error loading your profile. Please try again later.', 'error-message');
            // Disable buttons if critical settings fail to load
            updatePlanCardUI();
            return;
        }
        
        updatePlanCardUI();
        showPricingMessage('', 'message-text'); // Clear message if all loaded successfully
    }

    // --- UI Update Logic ---
    function updatePlanCardUI() {
        // Update free tier message limit display
        freeTierMessageLimitDisplay.textContent = adminSettings.freeTierMessageLimit;

        // Reset all buttons to default hidden state
        freePlanCard.querySelector('.plan-btn.current-plan-btn').classList.add('hidden');
        freePlanCard.querySelector('.plan-btn.disabled').classList.add('hidden');
        premiumPlanCard.querySelector('.plan-btn.upgrade-btn').classList.add('hidden');
        premiumPlanCard.querySelector('.plan-btn.current-plan-btn').classList.add('hidden');
        premiumPlanCard.querySelector('.plan-btn.disabled').classList.add('hidden');

        // Logic for Free Plan Card
        if (userProfile.planType === 'free') {
            freePlanCard.querySelector('.plan-btn.current-plan-btn').classList.remove('hidden');
        } else {
            // User is premium, so they cannot select the free plan
            freePlanCard.querySelector('.plan-btn.disabled').textContent = "Not Current Plan";
            freePlanCard.querySelector('.plan-btn.disabled').classList.remove('hidden');
        }

        // Logic for Premium Plan Card
        if (!adminSettings.freemiumEnabled) {
            premiumPlanCard.querySelector('.plan-btn.disabled').textContent = "Freemium Disabled by Admin";
            premiumPlanCard.querySelector('.plan-btn.disabled').classList.remove('hidden');
        } else if (!adminSettings.razorpayKeyId) {
            premiumPlanCard.querySelector('.plan-btn.disabled').textContent = "Razorpay Key Missing (Admin)";
            premiumPlanCard.querySelector('.plan-btn.disabled').classList.remove('hidden');
        } else if (userProfile.planType === 'premium') {
            premiumPlanCard.querySelector('.plan-btn.current-plan-btn').classList.remove('hidden');
        } else {
            // User is free, freemium is enabled, Razorpay key is present
            const upgradeBtn = premiumPlanCard.querySelector('.plan-btn.upgrade-btn');
            upgradeBtn.classList.remove('hidden');
            upgradeBtn.disabled = false; // Enable for click
        }
    }

    // --- Razorpay Payment Integration ---
    async function initiateRazorpayPayment(planId, amountInPaisa) {
        if (!currentUser) {
            showPricingMessage('Please log in to upgrade your plan.', 'error-message');
            return;
        }
        if (!adminSettings.freemiumEnabled) {
            showPricingMessage('Freemium mode is currently disabled by the administrator.', 'warning-message');
            return;
        }
        if (!adminSettings.razorpayKeyId) {
            showPricingMessage('Razorpay Key ID is missing from admin settings. Cannot process payment.', 'error-message');
            return;
        }

        const options = {
            key: adminSettings.razorpayKeyId, // Public Key ID!
            amount: amountInPaisa, // Amount in paisa
            currency: "INR",
            name: "ZAININ AI Premium",
            description: `Upgrade to ${planId.toUpperCase()} Plan`,
            image: "/assets/logo.jpg", // Your logo URL
            handler: async function (response) {
                console.log("Razorpay payment successful:", response);
                showPricingMessage('Payment successful! Updating your plan...', 'success-message');
                try {
                    await updateUserPlanInFirestore(currentUser.uid, planId, response.razorpay_payment_id);
                    showPricingMessage('Your plan has been upgraded to Premium! Redirecting...', 'success-message');
                    setTimeout(() => {
                        window.location.href = '/profile.html'; // Or '/index.html'
                    }, 2000);
                } catch (dbError) {
                    console.error("Error updating user plan in Firestore after successful payment:", dbError);
                    showPricingMessage(`Payment successful, but failed to update your plan: ${dbError.message}. Please contact support with payment ID: ${response.razorpay_payment_id}`, 'error-message');
                }
            },
            prefill: {
                name: currentUser.displayName || '',
                email: currentUser.email || '',
                contact: '' // Optional, user can enter this in Razorpay dialog
            },
            notes: {
                userId: currentUser.uid,
                plan: planId,
                email: currentUser.email
            },
            theme: {
                color: "#4A90E2" // A accent color matching your theme
            }
        };

        const rzp = new Razorpay(options);
        rzp.on('payment.failed', function (response) {
            console.error("Razorpay payment failed:", response);
            showPricingMessage(`Payment failed: ${response.error.description}. Please try again or contact support. Code: ${response.error.code}`, 'error-message');
        });

        // Ensure buttons are disabled during payment process
        disableUpgradeButtons(true);
        rzp.open();
    }

    // --- Update User Plan in Firestore ---
    async function updateUserPlanInFirestore(uid, planId, paymentId) {
        const userProfileRef = doc(db, 'users', uid, 'profile', 'data');
        await updateDoc(userProfileRef, {
            isPremium: true,
            planType: planId,
            razorpayPaymentId: paymentId,
            subscriptionStartDate: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        userProfile.isPremium = true;
        userProfile.planType = planId;
        console.log(`User ${uid} plan updated to ${planId}.`);
    }

    // --- Helper Functions ---
    function showPricingMessage(text, className) {
        pricingMessage.textContent = text;
        pricingMessage.className = 'message-text'; // Reset classes
        if (className && className !== 'message-text') {
            pricingMessage.classList.add(className);
        }
        if (text) {
            pricingMessage.classList.remove('hidden');
        } else {
            pricingMessage.classList.add('hidden');
        }
    }

    function disableUpgradeButtons(disable) {
        const upgradeBtn = premiumPlanCard.querySelector('.plan-btn.upgrade-btn');
        if (upgradeBtn) {
            upgradeBtn.disabled = disable;
            if (disable) {
                upgradeBtn.classList.add('disabled');
            } else {
                upgradeBtn.classList.remove('disabled');
            }
        }
    }

    // --- Event Listeners ---
    premiumPlanCard.addEventListener('click', (e) => {
        const upgradeBtn = e.target.closest('.plan-btn.upgrade-btn');
        if (upgradeBtn && !upgradeBtn.disabled) {
            const planId = upgradeBtn.dataset.plan;
            const amount = parseInt(upgradeBtn.dataset.amount, 10); // Amount in paisa
            initiateRazorpayPayment(planId, amount);
        }
    });
});