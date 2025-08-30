// js/pricing.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const freePlanCard = document.getElementById('free-plan-card');
    const premiumPlanCard = document.getElementById('premium-plan-card');
    const subscribePremiumBtn = document.getElementById('subscribe-premium-btn');
    const pricingMessageElement = document.getElementById('pricing-message');

    let currentUser = null;
    let razorpayKeyId = null; // Global Razorpay Key ID from admin settings

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            console.log("Pricing page: User logged in", user.uid);
            await loadAdminSettings(); // Load Razorpay Key ID
            await updateUserPlanUI(); // Update UI based on user's current plan
        } else {
            console.log("No user on Pricing page, redirecting to auth.");
            window.location.href = '/auth.html';
        }
    });

    /**
     * Loads Razorpay Key ID from admin settings.
     */
    async function loadAdminSettings() {
        try {
            const adminSettingsRef = doc(db, 'admin_settings', 'global_settings');
            const docSnap = await getDoc(adminSettingsRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                razorpayKeyId = data.razorpayKeyId || null;
                console.log("Razorpay Key ID loaded:", razorpayKeyId ? '***' : 'N/A');
                if (!razorpayKeyId) {
                    showMessage('Razorpay Key ID not configured by admin. Payments are disabled.', 'error-message');
                    subscribePremiumBtn.disabled = true;
                }
            } else {
                showMessage('Admin settings not found. Payments are disabled.', 'error-message');
                subscribePremiumBtn.disabled = true;
            }
        } catch (error) {
            console.error("Error loading admin settings:", error);
            showMessage('Error loading payment settings.', 'error-message');
            subscribePremiumBtn.disabled = true;
        }
    }

    /**
     * Updates the UI to reflect the user's current plan (Free or Premium).
     */
    async function updateUserPlanUI() {
        if (!currentUser) return;

        try {
            const profileDocRef = doc(db, 'users', currentUser.uid, 'profile', 'data');
            const profileSnap = await getDoc(profileDocRef);
            const isPremium = profileSnap.exists() && profileSnap.data().isPremium;

            if (isPremium) {
                freePlanCard.classList.remove('active');
                premiumPlanCard.classList.add('active');
                subscribePremiumBtn.textContent = 'Current Plan';
                subscribePremiumBtn.disabled = true;
                subscribePremiumBtn.classList.remove('subscribe-btn');
                subscribePremiumBtn.classList.add('current-plan-btn');
            } else {
                freePlanCard.classList.add('active');
                premiumPlanCard.classList.remove('active');
                subscribePremiumBtn.textContent = 'Upgrade Now';
                subscribePremiumBtn.disabled = !razorpayKeyId; // Only enable if Razorpay key is available
                subscribePremiumBtn.classList.add('subscribe-btn');
                subscribePremiumBtn.classList.remove('current-plan-btn');
            }
        } catch (error) {
            console.error("Error updating user plan UI:", error);
            showMessage('Could not load your current plan status.', 'error-message');
        }
    }

    /**
     * Initiates the Razorpay payment process.
     */
    async function initiateRazorpayPayment() {
        if (!currentUser) {
            showMessage('You must be logged in to subscribe.', 'error-message');
            return;
        }
        if (!razorpayKeyId) {
            showMessage('Payment system not configured by admin.', 'error-message');
            return;
        }

        // Disable button during payment initiation
        subscribePremiumBtn.disabled = true;
        showMessage('Initiating payment...', '');

        const planAmount = 500; // Example: 500 paise = 5.00 INR
        const currency = 'INR';

        // In a real application, you would make a POST request to your backend
        // to create a Razorpay Order ID. The backend would handle the amount, currency,
        // and generate the order.id securely.
        // For this client-side demo, we'll simulate the order creation response.
        const orderId = `order_${Math.random().toString(36).substring(2, 15)}`; // Mock order ID

        const options = {
            key: razorpayKeyId, // Your Key ID from the Admin Panel
            amount: planAmount, // Amount is in paise (smallest currency unit)
            currency: currency,
            name: "ZAININ AI Premium Subscription",
            description: "Unlock unlimited features!",
            order_id: orderId, // This would come from your backend order creation
            handler: async function (response) {
                // This function is called on successful payment
                console.log("Payment successful:", response);
                // In a real app, you'd send `response.razorpay_payment_id`, `response.razorpay_order_id`,
                // `response.razorpay_signature` to your backend for server-side verification.

                try {
                    // Mock: Directly update user's premium status after client-side payment success
                    const profileDocRef = doc(db, 'users', currentUser.uid, 'profile', 'data');
                    await updateDoc(profileDocRef, {
                        isPremium: true,
                        subscriptionId: `sub_${response.razorpay_payment_id}`, // Mock subscription ID
                        premiumActivatedAt: serverTimestamp(),
                        lastPaymentId: response.razorpay_payment_id
                    }, { merge: true });

                    showMessage('Payment successful! You are now a Premium user!', 'success-message');
                    await updateUserPlanUI(); // Update UI
                    setTimeout(() => window.location.href = '/profile.html', 2000); // Redirect to profile
                } catch (dbError) {
                    console.error("Error updating user premium status in Firestore:", dbError);
                    showMessage('Payment successful, but failed to update your status. Please contact support.', 'error-message');
                }
            },
            prefill: {
                name: currentUser.displayName || '',
                email: currentUser.email || '',
                contact: '' // Optional: User's phone number
            },
            notes: {
                userId: currentUser.uid,
                plan: "premium"
            },
            theme: {
                color: "#6050dc" // Customize Razorpay checkout theme
            }
        };

        const rzp1 = new Razorpay(options);
        rzp1.on('payment.failed', function (response) {
            console.error("Payment failed:", response);
            showMessage(`Payment failed: ${response.error.description}`, 'error-message');
            subscribePremiumBtn.disabled = false; // Re-enable button
        });

        rzp1.open();
        subscribePremiumBtn.disabled = false; // Re-enable button immediately after opening for re-attempts if popup closed
    }

    // --- Helper Functions ---
    function showMessage(text, className) {
        pricingMessageElement.textContent = text;
        pricingMessageElement.className = 'message-text';
        if (className && className !== 'message-text') {
            pricingMessageElement.classList.add(className);
        }
        scrollToBottom(); // Ensure message is visible
    }

    function scrollToBottom() {
        // Simple scroll to ensure the message is visible, especially on smaller screens
        pricingMessageElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    // --- Event Listeners ---
    subscribePremiumBtn.addEventListener('click', initiateRazorpayPayment);
});