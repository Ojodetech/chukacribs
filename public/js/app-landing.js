// Hamburger Menu Toggle
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

// Initialize utility managers
const loader = new LoadingManager();
const errorMgr = new ErrorManager();

if (hamburger) {
    // ensure navbar is not collapsed initially
    navLinks.classList.remove('collapsed');

    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navLinks.classList.toggle('active');
        navLinks.classList.toggle('collapsed');
    });

    // Close menu when a link is clicked
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
            navLinks.classList.remove('collapsed');
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.navbar')) {
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
        }
    });
}

// DOM Elements - Landing Page
const listingsContainer = document.getElementById('listingsContainer');
const housePreviewModal = document.getElementById('housePreviewModal');
const tokenModal = document.getElementById('tokenModal');
const accessBtn = document.getElementById('accessBtn');
const ctaBtn = document.getElementById('ctaBtn');
const rateBtn = document.getElementById('rateBtn');
const rateModal = document.getElementById('rateModal');
const noListings = document.getElementById('noListings');

let allHouses = [];
let selectedHouse = null;

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.add('hidden');
    });
}

function setSystemStatus(message, variant = 'ok') {
    const statusEl = document.getElementById('systemStatus');
    if (!statusEl) return;

    statusEl.textContent = message;
    statusEl.classList.remove('system-status--ok', 'system-status--warning', 'system-status--error');
    statusEl.classList.add(`system-status--${variant}`);
    statusEl.style.display = 'block';

    if (variant !== 'error') {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 7000);
    }
}

async function checkSystemHealth() {
    try {
        const response = await fetch('/health', { method: 'GET' });
        if (!response.ok) {
            setSystemStatus('Service status: degraded (health endpoint returns non-OK)', 'warning');
            return;
        }

        const data = await response.json();
        const status = data.status || 'ok';

        if (status === 'ok' || status === 'ready' || status === 'alive') {
            setSystemStatus('Service status: healthy', 'ok');
        } else {
            setSystemStatus(`Service status: ${status}`, 'warning');
        }
    } catch (err) {
        console.error('System health check failed:', err);
        setSystemStatus('Service status: unavailable (offline?)', 'error');
    }
}

// Sample house data for landing page (mock)
const mockHouses = [
    {
        id: 1,
        title: "Cozy 2-Bedroom House",
        location: "Chuka Town Center",
        price: 8500,
        type: "apartment",
        description: "A beautiful and spacious 2-bedroom apartment in the heart of Chuka with modern amenities, furnished rooms, and 24/7 security.",
        images: [
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%230B1F3B' width='400' height='300'/%3E%3Ctext x='50%' y='50%' font-size='20' fill='white' text-anchor='middle' dy='.3em'%3E2-Bedroom Apartment%3C/text%3E%3C/svg%3E"
        ],
        features: ["2 Bedrooms", "1 Bathroom", "WiFi Included"],
        landlord: "John Kipchoge",
        contact: "+254 700 000001"
    },
    {
        id: 2,
        title: "Single Room Bedsitter",
        location: "Near Chuka University",
        price: 4500,
        type: "bedsitter",
        description: "Neat and well-maintained single room with attached bathroom, ideal for students. Close to campus and with reliable water supply.",
        images: [
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%2306b6d4' width='400' height='300'/%3E%3Ctext x='50%' y='50%' font-size='20' fill='white' text-anchor='middle' dy='.3em'%3E Bedsitter%3C/text%3E%3C/svg%3E"
        ],
        features: ["1 Bedroom", "Attached Bath", "Near Campus"],
        landlord: "Mary Wanjiru",
        contact: "+254 700 000002"
    },
    {
        id: 3,
        title: "Luxury 3-Bedroom House",
        location: "Chuka Nyumba Estate",
        price: 18000,
        type: "apartment",
        description: "Premium 3-bedroom house with modern fixtures, large living area, equipped kitchen, and beautiful compound for parking.",
        images: [
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23f59e0b' width='400' height='300'/%3E%3Ctext x='50%' y='50%' font-size='20' fill='white' text-anchor='middle' dy='.3em'%3E 3-Bedroom House%3C/text%3E%3C/svg%3E"
        ],
        features: ["3 Bedrooms", "2 Bathrooms", "Parking"],
        landlord: "David Mwangi",
        contact: "+254 700 000003"
    }
];

// Initialize Landing Page
document.addEventListener('DOMContentLoaded', () => {
    console.log('🏠 Landing page DOMContentLoaded - Initializing...');
    console.log('accessBtn:', accessBtn ? 'Found' : 'NOT FOUND');
    console.log('ctaBtn:', ctaBtn ? 'Found' : 'NOT FOUND');
    console.log('tokenModal:', tokenModal ? 'Found' : 'NOT FOUND');
    
    displayMockHouses();
    setupEventListeners();
    checkSystemHealth();
    
    // Check if returning from PesaPal payment
    const orderTrackingId = sessionStorage.getItem('orderTrackingId');
    if (orderTrackingId) {
        console.log('🔄 Returning from PesaPal - Verifying payment...');
        verifyPaymentStatus(orderTrackingId);
    }
    
    console.log('✅ Landing page fully initialized');
});

function displayMockHouses() {
    allHouses = mockHouses;
    
    if (allHouses.length === 0) {
        listingsContainer.innerHTML = '';
        noListings.classList.remove('hidden');
        return;
    }

    noListings.classList.add('hidden');
    listingsContainer.innerHTML = allHouses.map(house => {
        return `
        <div class="house-card clickable" data-house-id="${house.id}">
            <div class="card-image">
                <img src="${house.images[0]}" alt="${house.title}">
                <div class="card-badge">Sample</div>
            </div>
            <div class="card-content">
                <h3 class="card-title">${house.title}</h3>
                <p class="card-location">📍 ${house.location}</p>
                <p class="card-price">KSH ${house.price.toLocaleString()}</p>
                <div class="card-features">
                    ${house.features.slice(0, 3).map(f => `<span class="feature-tag">${f}</span>`).join('')}
                </div>
                <div class="card-footer">
                    <button class="btn-view">View Details</button>
                    <button class="btn-book">Book Now</button>
                    <button class="btn-like">❤️</button>
                </div>
            </div>
        </div>
    `}).join('');

    // Add event listeners to cards
    document.querySelectorAll('.house-card').forEach(card => {
        const viewBtn = card.querySelector('.btn-view');
        const bookBtn = card.querySelector('.btn-book');
        const likeBtn = card.querySelector('.btn-like');
        const houseId = card.getAttribute('data-house-id');

        // Card click
        card.addEventListener('click', function(e) {
            if (!e.target.closest('.btn-like') && !e.target.closest('.btn-view') && !e.target.closest('.btn-book')) {
                viewMockHouseById(houseId);
            }
        });

        // View button click
        if (viewBtn) {
            viewBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                viewMockHouseById(houseId);
            });
        }

        // Book button click
        if (bookBtn) {
            bookBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                bookMockHouseById(houseId);
            });
        }

        // Like button click
        if (likeBtn) {
            likeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                this.classList.toggle('liked');
            });
        }
    });
}

function viewMockHouse(cardElement) {
    const houseId = parseInt(cardElement.getAttribute('data-house-id'));
    const house = allHouses.find(h => h.id === houseId);
    if (!house) {return;}
    
    selectedHouse = house;
    showPreviewModal(house);
}

function viewMockHouseById(houseId) {
    const houseIdNum = parseInt(houseId);
    const house = allHouses.find(h => h.id === houseIdNum);
    if (!house) {
        console.error('House not found:', houseId);
        return;
    }
    
    selectedHouse = house;
    showPreviewModal(house);
}

function bookMockHouseById(houseId) {
    const houseIdNum = parseInt(houseId);
    const house = allHouses.find(h => h.id === houseIdNum);
    if (!house) {
        console.error('House not found:', houseId);
        return;
    }
    
    selectedHouse = house;
    console.log('Booking mock house:', houseId);
    // For demo purposes, show payment modal
    openPaymentModal();
}

function viewMockHouseFromButton(event) {
    event.stopPropagation();
    const cardElement = event.target.closest('.house-card');
    viewMockHouse(cardElement);
}

function showPreviewModal(house) {
    document.getElementById('previewTitle').textContent = house.title;
    document.getElementById('previewType').textContent = `Type: ${house.type}`;
    document.getElementById('previewLocation').textContent = house.location;
    document.getElementById('previewPrice').textContent = `KSH ${house.price.toLocaleString()}/month`;
    document.getElementById('previewDescription').textContent = house.description;
    document.getElementById('previewLandlordName').textContent = house.landlord;
    document.getElementById('previewLandlordPhone').textContent = house.contact;
    
    housePreviewModal.classList.remove('hidden');
    console.log('Preview modal opened for:', house.title);
}

function setupEventListeners() {
    console.log('📋 Setting up event listeners...');
    
    // Close modals with X button
    const closeButtons = document.querySelectorAll('.close');
    console.log('Found', closeButtons.length, 'close buttons');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const modal = this.closest('.modal');
            if (modal) {
                modal.classList.add('hidden');
                console.log('Modal closed via X button');
            }
        });
    });

    // Close modals when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target.classList && event.target.classList.contains('modal')) {
            event.target.classList.add('hidden');
            console.log('Modal closed by clicking outside');
        }
    });

    // Close modals with ESC key + move focus to CTAs for accessibility
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeAllModals();
        }
    });

    // CTA Button - Browse Verified Listings (redirect to listings page)
    if (ctaBtn) {
        console.log('✅ CTA Button found - attaching redirect listener');
        ctaBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('CTA clicked - redirecting to listings page');
            window.location.href = 'listings.html';
        });
    } else {
        console.error('❌ CTA Button NOT found!');
    }

    // Rate Us Button
    if (rateBtn) {
        console.log('✅ Rate Button found - attaching listener');
        rateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (rateModal) {
                console.log('Opening rate modal');
                rateModal.classList.remove('hidden');
                resetRatingModal();
                const firstStar = rateModal.querySelector('.star');
                if (firstStar) { firstStar.focus(); }
            } else {
                console.error('Rate modal not found');
            }
        });
    } else {
        console.error('❌ Rate Button NOT found!');
    }

    // Buy Access from Preview
    const buyAccessBtn = document.getElementById('buyAccessForPreviewBtn');
    if (buyAccessBtn) {
        console.log('✅ Buy Access button found - attaching listener');
        buyAccessBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const tokenModal = document.getElementById('tokenModal');
            if (tokenModal) {
                console.log('Opening token modal from preview');
                tokenModal.classList.remove('hidden');
                const phoneInput = tokenModal.querySelector('#phoneNumber');
                if (phoneInput) { phoneInput.focus(); }
            } else {
                console.error('Token modal not found');
            }
        });
    } else {
        console.warn('⚠️ Buy Access button not found (will only appear after modal opens)');
    }

    // Payment button
    const paymentBtn = document.getElementById('paymentBtn');
    if (paymentBtn) {
        console.log('✅ Payment Button found - attaching listener');
        paymentBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Payment button clicked - processing...');
            processPayment();
        });
    } else {
        console.error('❌ Payment Button NOT found!');
    }
    
    console.log('✅ All event listeners attached');
}

// Verify payment status after returning from PesaPal
async function verifyPaymentStatus(orderTrackingId) {
    try {
        loader.show('Checking payment status...');
        console.log('⏳ Checking payment status with order ID:', orderTrackingId);
        
        const response = await fetch('/api/payments/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                orderTrackingId: orderTrackingId
            }),
            credentials: 'include'
        });

        const data = await response.json();
        console.log('📊 Payment status response:', data);

        if (data.success && data.status === 'COMPLETED') {
            console.log('✅ Payment successful!');
            loader.hide();
            
            // Close modal
            if (tokenModal) {
                tokenModal.classList.add('hidden');
            }
            
            // Clear session data
            sessionStorage.removeItem('orderTrackingId');
            sessionStorage.removeItem('phoneNumber');
            sessionStorage.removeItem('email');
            
            // Show success message
            errorMgr.show('Payment successful! You now have 24-hour access to all listings.', 'success', 3000);
            
            // Redirect to listings
            setTimeout(() => {
                window.location.href = 'listings.html';
            }, 1500);
            
        } else if (data.status === 'PENDING') {
            console.log('⏳ Payment is still being processed...');
            loader.hide();
            errorMgr.show('Payment is being processed. Checking again...', 'info', 2000);
            
            // Retry after 3 seconds
            setTimeout(() => {
                verifyPaymentStatus(orderTrackingId);
            }, 3000);
            
        } else {
            console.log('❌ Payment failed or pending');
            loader.hide();
            errorMgr.show('Payment failed or is still processing. Please try again.', 'error', 3000);
            
            // Clear session data
            sessionStorage.removeItem('orderTrackingId');
            sessionStorage.removeItem('phoneNumber');
            sessionStorage.removeItem('email');
            
            if (tokenModal) {
                tokenModal.classList.remove('hidden');
            }
        }
    } catch (error) {
        loader.hide();
        console.error('❌ Error verifying payment:', error);
        errorMgr.handleApiError(error);
        
        // Keep order ID in session for retry
        const paymentBtn = document.getElementById('paymentBtn');
        if (paymentBtn) {
            paymentBtn.disabled = false;
            paymentBtn.textContent = 'Proceed to Payment';
        }
    }
}

// Check access status on page load
async function checkAccessStatus() {
    try {
        const response = await fetch('/api/access/status', {
            method: 'GET',
            credentials: 'include', // Include cookies
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
        // Store ONLY the access status (not token - that's in the secure cookie)
        sessionStorage.setItem('userAccessStatus', JSON.stringify(data));
        
        return data;
    } catch (err) {
        console.error('Error checking access status:', err);
        return {
            hasAccess: false,
            isPaid: false
        };
    }
}

// Initialize access check on page load
document.addEventListener('DOMContentLoaded', async () => {
    const accessStatus = await checkAccessStatus();
    console.log('Access Status:', accessStatus);
});

function processPayment() {
    console.log('💳 Processing payment with M-Pesa...');
    
    // Get form inputs
    const phoneNumber = document.getElementById('phoneNumber')?.value?.trim();
    const email = document.getElementById('email')?.value?.trim();
    const paymentBtn = document.getElementById('paymentBtn');
    
    // Validation
    if (!phoneNumber || !email) {
        errorMgr.show('Please enter your phone number and email address', 'error');
        return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        errorMgr.show('Please enter a valid email address', 'error');
        return;
    }

    // Validate phone format
    const phoneRegex = /^(\+?254|0)[1-9]\d{8}$/;
    if (!phoneRegex.test(phoneNumber)) {
        errorMgr.show('Please enter a valid Kenyan phone number (Format: 0712345678 or 254712345678)', 'error');
        return;
    }

    if (!paymentBtn) {
        console.error('❌ Payment button not found');
        return;
    }
    
    loader.showButtonLoading(paymentBtn, 'Processing...');

    // Initiate payment with M-Pesa STK Push
    (async () => {    
        try {
            console.log('📤 Sending M-Pesa payment request to backend...', { phoneNumber, email });
            if (window.showMpesaPrompt) {
                window.showMpesaPrompt('Please check your phone for the M-Pesa prompt.');
            }
            
            const response = await fetch('/api/payments/initiate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    phoneNumber: phoneNumber,
                    email: email,
                    firstName: 'User',
                    lastName: 'ChukaCribs'
                }),
                credentials: 'include' // Include cookies
            });

            console.log('📥 Response received:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                loader.hide();
                loader.hideButtonLoading(paymentBtn);
                const errorMsg = errorData.error || errorData.message || 'Payment initiation failed';
                if (window.hideMpesaPrompt) window.hideMpesaPrompt();
                throw new Error(errorMsg);
            }

            const data = await response.json();
            
            console.log('✅ M-Pesa prompt sent:', {
                checkoutRequestId: data.checkoutRequestId
            });

            if (!data.success) {
                loader.hide();
                loader.hideButtonLoading(paymentBtn);
                if (window.hideMpesaPrompt) window.hideMpesaPrompt();
                throw new Error(data.error || 'Failed to send M-Pesa prompt');
            }

            // Store checkout request ID and payment details for verification
            sessionStorage.setItem('checkoutRequestId', data.checkoutRequestId);
            sessionStorage.setItem('phoneNumber', phoneNumber);
            sessionStorage.setItem('email', email);
            
            console.log('✅ M-Pesa prompt sent successfully');
            loader.hide();
            loader.hideButtonLoading(paymentBtn);
            
            // Show prompt received message
            if (window.showMpesaPrompt) window.showMpesaPrompt('M-Pesa prompt sent to ' + phoneNumber + '. Waiting for confirmation...');
            errorMgr.show('M-Pesa prompt sent to ' + phoneNumber + '. Enter your PIN to complete payment.', 'success', 4000);
            
            // Start polling for payment status
            pollPaymentStatus(data.checkoutRequestId, phoneNumber);
            
        } catch (err) {
            loader.hide();
            loader.hideButtonLoading(paymentBtn);
            console.error('❌ Payment error:', err.message);
            errorMgr.show(`Payment failed: ${err.message}`, 'error', 4000);
        }
    })();
}

// Poll M-Pesa payment status
function pollPaymentStatus(checkoutRequestId, phoneNumber) {
    let pollCount = 0;
    const maxPolls = 30; // Poll for maximum 90 seconds (30 * 3s)
    
    const pollInterval = setInterval(async () => {
        pollCount++;
        
        if (pollCount > maxPolls) {
            clearInterval(pollInterval);
            console.log('⏱️ Payment verification timeout');
            errorMgr.show('Payment timeout. You can check your account. If payment was successful, you should receive a confirmation.', 'info', 5000);
            return;
        }
        
        try {
            const response = await fetch('/api/payments/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    orderTrackingId: checkoutRequestId
                }),
                credentials: 'include'
            });

            const data = await response.json();
            
            if (data.success && data.status === 'COMPLETED') {
                clearInterval(pollInterval);
                console.log('✅ Payment successful!');
                
                // Clear session data
                sessionStorage.removeItem('checkoutRequestId');
                sessionStorage.removeItem('phoneNumber');
                sessionStorage.removeItem('email');
                
                // Show success message
                errorMgr.show('Payment successful! You now have 24-hour access to all listings.', 'success', 3000);
                
                // Close modal and refresh page to reflect token
                if (tokenModal) {
                    tokenModal.classList.add('hidden');
                }
                
                // Redirect to listings after a short delay
                setTimeout(() => {
                    window.location.href = 'listings.html';
                }, 2000);
                
            } else if (data.status === 'PENDING') {
                console.log('⏳ Payment still pending...');
                // Continue polling
            }
        } catch (err) {
            console.error('Error checking payment status:', err);
            // Continue polling even if there's an error
        }
    }, 3000); // Poll every 3 seconds
}

function toggleLike(event) {
    event.stopPropagation();
    event.target.classList.toggle('liked');
}

// Rating Modal Functions
let currentRating = 0;

function resetRatingModal() {
    currentRating = 0;
    document.querySelectorAll('.star').forEach(star => {
        star.classList.remove('active');
    });
    document.getElementById('ratingText').textContent = 'Click to rate';
    document.getElementById('ratingComment').value = '';
    document.getElementById('submitRatingBtn').disabled = true;
}

function setupRatingModal() {
    // Star rating functionality
    document.querySelectorAll('.star').forEach(star => {
        star.addEventListener('click', function() {
            const rating = parseInt(this.getAttribute('data-rating'));
            currentRating = rating;
            
            // Update star display
            document.querySelectorAll('.star').forEach((s, index) => {
                if (index < rating) {
                    s.classList.add('active');
                } else {
                    s.classList.remove('active');
                }
            });
            
            // Update rating text
            const ratingTexts = {
                1: 'Poor',
                2: 'Fair',
                3: 'Good',
                4: 'Very Good',
                5: 'Excellent'
            };
            document.getElementById('ratingText').textContent = ratingTexts[rating] || 'Click to rate';
            
            // Enable submit button
            document.getElementById('submitRatingBtn').disabled = false;
        });
    });
    
    // Submit rating
    document.getElementById('submitRatingBtn').addEventListener('click', function() {
        const comment = document.getElementById('ratingComment').value.trim();
        
        // Here you would typically send the rating to your backend
        console.log('Rating submitted:', { rating: currentRating, comment });
        
        // Show success message
        errorMgr.show(`Thank you for rating us ${'⭐'.repeat(currentRating)}!`, 'success', 3000);
        
        // Close modal
        rateModal.classList.add('hidden');
        
        // Reset for next time
        resetRatingModal();
    });
    
    // Cancel rating
    document.getElementById('cancelRatingBtn').addEventListener('click', function() {
        rateModal.classList.add('hidden');
        resetRatingModal();
    });
}

// Initialize rating modal when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setupRatingModal();
});
