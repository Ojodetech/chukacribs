// DOM Elements - Listings Page
const listingsContainer = document.getElementById('listingsContainer');
const houseModal = document.getElementById('houseModal');
const bookingModal = document.getElementById('bookingModal');

const searchInput = document.getElementById('searchInput');
const priceFilter = document.getElementById('priceFilter');
const typeFilter = document.getElementById('typeFilter');
const sortSelect = document.getElementById('sortSelect');
const searchBtn = document.querySelector('.search-btn');

// Initialize utility managers
const loader = new LoadingManager();
const errorMgr = new ErrorManager();

let allHouses = [];
let selectedHouse = null;
let userAccessStatus = null;

// Initialize Listings Page
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Listings page loaded');
    loader.show('Checking access...');
    
    // Check access status from backend
    userAccessStatus = await checkAccessStatus();
    loader.hide();
    
    if (!userAccessStatus || !userAccessStatus.hasAccess) {
        console.log('No valid access, redirecting to home');
        errorMgr.show('Access expired or not purchased. Redirecting...', 'error', 2000);
        setTimeout(() => window.location.href = 'index.html', 2000);
        return;
    }

    console.log('✅ Access verified:', userAccessStatus);
    
    loadHousesFromAPI();
    setupEventListeners();
    
    // If user has paid access, start expiration timer
    if (userAccessStatus.expiresAt) {
        console.log('⏰ Starting access expiration timer...');
        console.log('📌 IMPORTANT: Bookings do NOT affect your 24-hour access');
        startExpirationTimer();
    }
});

// Check access status from backend
async function checkAccessStatus() {
    try {
        const response = await fetch('/api/access/status', {
            method: 'GET',
            credentials: 'include', // Include secure cookies
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to check access status');
        }

        const data = await response.json();
        // Store server response time to avoid client-side clock skew
        data.checkedAt = Date.now();
        return data;
    } catch (err) {
        console.error('❌ Error checking access status:', err);
        return null;
    }
}

// Start expiration timer and update button
// Timer only displays remaining time - actual expiry is server-side
function startExpirationTimer() {
    if (!userAccessStatus || !userAccessStatus.expiresAt) {return;}

    const updateTimer = async () => {
        const now = Date.now();
        const expiresAtTime = userAccessStatus.expiresAt;
        const timeRemaining = expiresAtTime - now;

        if (timeRemaining <= 0) {
            // Token should be expired - verify with server
            console.log('⏰ Timer shows expired - verifying with server...');
            const currentStatus = await checkAccessStatus();

            if (!currentStatus || !currentStatus.hasAccess) {
                // Confirmed expired
                clearInterval(timerInterval);

                // Show message and redirect after 3 seconds
                errorMgr.show('Your access has expired. Please purchase access again.', 'error', 3000);
                setTimeout(() => window.location.href = 'index.html', 3000);
                return;
            } else {
                // Server says still valid, update the expiry time
                userAccessStatus = currentStatus;
            }
        }

        // Calculate hours, minutes, seconds
        const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
        const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

        // Log remaining time (since no button to display it)
        console.log(`⏰ Access expires in: ${hours}h ${minutes}m ${seconds}s`);

        // Show warnings at certain intervals
        if (hours === 0 && minutes < 15 && timeRemaining % 60000 < 1000) { // Every minute in last 15 min
            errorMgr.show(`Your access will expire in ${minutes} minutes. Save any important information.`, 'warning', 5000);
        } else if (hours === 0 && minutes === 30 && seconds === 0) { // At 30 minutes
            errorMgr.show('Your access will expire in 30 minutes.', 'info', 3000);
        }
    };

    // Update immediately and then every second
    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);

    // Store interval ID to clear it later if needed
    window.expirationTimerInterval = timerInterval;

    // Periodically refresh access status from server (every 5 minutes)
    // This ensures we stay in sync if token was invalidated for other reasons
    setInterval(async () => {
        console.log('🔄 Refreshing access status from server...');
        const freshStatus = await checkAccessStatus();
        if (freshStatus && freshStatus.hasAccess && freshStatus.expiresAt) {
            userAccessStatus = freshStatus;
            console.log('✅ Access status refreshed - expires at:', new Date(freshStatus.expiresAt));
        }
    }, 5 * 60 * 1000); // Every 5 minutes
}

function loadHousesFromAPI() {
    loader.show('Loading listings...');

    fetch('/api/houses')
        .then(response => response.json())
        .then(data => {
            console.log('Loaded', data.length, 'houses from API');
            allHouses = data.map(house => ({
                id: house._id,
                title: house.title,
                location: house.location,
                price: house.price,
                type: house.type,
                description: house.description,
                images: house.images || ['data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%236366f1" width="400" height="300"/%3E%3Ctext x="50%" y="50%" font-size="20" fill="white" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E'],
                videos: house.videos || [],
                features: house.features || [],
                landlord: house.landlord,
                contact: house.contact
            }));
            displayHouses(allHouses);
            loader.hide();
        })
        .catch(error => {
            console.error('Error loading houses:', error);
            loader.hide();
            errorMgr.show('Error loading listings. Please try again.', 'error', 3000);
        });
}

function displayHouses(houses) {
    const noListings = document.getElementById('noListings');
    
    if (houses.length === 0) {
        listingsContainer.innerHTML = '';
        noListings.classList.remove('hidden');
        return;
    }

    noListings.classList.add('hidden');
    listingsContainer.innerHTML = houses.map(house => `
        <div class="house-card" data-house-id="${house.id}">
            <div class="card-image">
                <img src="${house.images && house.images[0] ? house.images[0] : 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%230B1F3B%22 width=%22400%22 height=%22300%22/%3E%3Ctext x=%2250%%22 y=%2250%%22 font-size=%2220%22 fill=%22white%22 text-anchor=%22middle%22 dy=%22.3em%22%3ENo Image%3C/text%3E%3C/svg%3E'}" alt="${house.title}">
                <div class="card-badge">Available</div>
            </div>
            <div class="card-content">
                <h3 class="card-title">${house.title}</h3>
                <p class="card-location">📍 ${house.location}</p>
                <p class="card-price">KSH ${house.price.toLocaleString()}</p>
                <div class="card-landlord-info card-landlord-panel">
                    <p class=""><strong>👤 ${house.landlord || 'Landlord'}</strong></p>
                    ${house.landlordPhone ? `<p class="muted-sm">📱 ${house.landlordPhone}</p>` : ''}
                    ${house.landlordEmail ? `<p class="muted-sm break-all">✉️ ${house.landlordEmail}</p>` : ''}
                </div>
                <div class="card-features">
                    ${house.features && house.features.length > 0 ? house.features.slice(0, 3).map(f => `<span class="feature-tag">${f}</span>`).join('') : '<span class="feature-tag">Listed</span>'}
                </div>
                <div class="card-footer">
                    <button class="btn-view">View Details</button>
                    <button class="btn-book">Book Now</button>
                    <button class="btn-like">❤️</button>
                </div>
            </div>
        </div>
    `).join('');

    // Add event listeners to cards
    document.querySelectorAll('.house-card').forEach(card => {
        const viewBtn = card.querySelector('.btn-view');
        const bookBtn = card.querySelector('.btn-book');
        const likeBtn = card.querySelector('.btn-like');
        const houseId = card.getAttribute('data-house-id');

        // View button click
        if (viewBtn) {
            viewBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('View Details clicked for house:', houseId);
                viewHouse(houseId);
            });
        }

        // Book button click
        if (bookBtn) {
            bookBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Book Now clicked for house:', houseId);
                bookHouse(houseId);
            });
        }

        // Like button click
        if (likeBtn) {
            likeBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Like clicked');
                this.classList.toggle('liked');
            });
        }

        // Card click
        card.addEventListener('click', function(e) {
            if (e.target.closest('.btn-like') || e.target.closest('.btn-view') || e.target.closest('.btn-book')) {
                return;
            }
            console.log('Card clicked for house:', houseId);
            viewHouse(houseId);
        });
    });
}

function viewHouse(houseId) {
    const house = allHouses.find(h => h.id === houseId);
    if (!house) {
        console.error('House not found:', houseId);
        errorMgr.show('House details not available', 'error');
        return;
    }

    selectedHouse = house;
    
    // Always show the preview/restricted view initially.
    // Only show full details after user completes a booking in the current session.
    console.log('Showing preview modal (standard view)');
    showPreviewModal(house);
}

function bookHouse(houseId) {
    const house = allHouses.find(h => h.id === houseId);
    if (!house) {
        console.error('House not found:', houseId);
        errorMgr.show('House not available for booking', 'error');
        return;
    }

    selectedHouse = house;
    console.log('Booking house directly:', houseId);
    openPaymentModal();
}

// Check if user has active booking for a house
async function checkUserBooking(houseId) {
    try {
        const userEmail = localStorage.getItem('userEmail') || 'guest@chukacrribs.local';
        
        if (!houseId) {
            console.warn('checkUserBooking: houseId not provided');
            return false;
        }
        
        const response = await fetch('/api/bookings/check-status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                houseId: String(houseId),
                userEmail: String(userEmail)
            })
        });
        
        if (!response.ok) {
            console.warn('checkUserBooking: API returned status', response.status);
            return false;
        }
        
        const data = await response.json();
        
        if (!data.success) {
            console.warn('checkUserBooking: API returned success: false');
            return false;
        }
        
        const hasBooking = data.hasBooking === true;
        const isExpired = data.booking && data.booking.isExpired === true;
        
        console.log('checkUserBooking result:', { houseId, hasBooking, isExpired, booking: data.booking });
        
        return hasBooking && !isExpired;
    } catch (error) {
        console.error('Error checking booking:', error);
        return false;
    }
}

function showPreviewModal(house) {
    // RESTRICTED VIEW - Before Booking
    // Only show: Price, Images, Videos, Amenities (features)
    // Hide: Landlord contact, full description
    
    const previewModal = document.getElementById('housePreviewModal');
    if (!previewModal) {
        console.error('Preview modal element not found in DOM');
        errorMgr.show('Cannot display house details. Please refresh the page.', 'error');
        return;
    }

    try {
        const mainImage = document.getElementById('mainImage');
        const galleryThumbnails = document.getElementById('galleryThumbnails');
        
        if (mainImage && house.images && house.images.length > 0) {
            mainImage.innerHTML = `<img src="${house.images[0]}" alt="${house.title}" class="img-responsive">`;
        }
        
        // Show image gallery
        if (galleryThumbnails && house.images && house.images.length > 1) {
            galleryThumbnails.innerHTML = house.images.map((img, idx) => `
                <div class="thumbnail" data-img="${img}">
                    <img src="${img}" alt="Thumbnail ${idx + 1}" class="thumbnail-img">
                </div>
            `).join('');
            
            // Add event listeners for thumbnails
            galleryThumbnails.querySelectorAll('.thumbnail').forEach(thumb => {
                thumb.addEventListener('click', function() {
                    changeMainImage(this.dataset.img, this);
                });
            });
        }

        // Set preview content - LIMITED VISIBILITY
        const previewTitle = document.getElementById('previewTitle');
        if (previewTitle) {previewTitle.textContent = house.title;}
        
        const previewType = document.getElementById('previewType');
        if (previewType) {previewType.textContent = `Type: ${house.type || 'House'}`;}
        
        const previewLocation = document.getElementById('previewLocation');
        if (previewLocation) {previewLocation.textContent = `📍 ${  previewLocation.textContent.includes('Location hidden') ? 'Location hidden until booking' : house.location}`;}
        
        const previewPrice = document.getElementById('previewPrice');
        if (previewPrice && house.price) {
            previewPrice.textContent = `KSH ${house.price.toLocaleString()}/month`;
        }
        
        // Show only amenities/features (not full description)
        const previewDescription = document.getElementById('previewDescription');
        if (previewDescription) {
            const featuresHtml = house.features && house.features.length > 0 
                ? house.features.map(f => `<span class="feature-tag">${f}</span>`).join('')
                : '<span class="feature-tag">Standard amenities</span>';
            previewDescription.innerHTML = `<strong>Amenities:</strong> ${featuresHtml}`;
        }
        
        // HIDE landlord info until booking
        const previewLandlordName = document.getElementById('previewLandlordName');
        if (previewLandlordName) {previewLandlordName.textContent = '📞 Available after booking via SMS';}
        
        const previewLandlordPhone = document.getElementById('previewLandlordPhone');
        if (previewLandlordPhone) {previewLandlordPhone.textContent = '';}
        
        // Show videos if available
        const previewVideos = document.getElementById('previewVideos');
        if (previewVideos && house.videos && house.videos.length > 0) {
            const videosHtml = house.videos.map((video, idx) => `
                <div class="video-item">
                    <h4>Video Tour ${idx + 1}</h4>
                    <div class="video-container">
                        <video width="100%" height="300" controls>
                            <source src="${video}" type="video/mp4">
                            Your browser does not support the video tag.
                        </video>
                    </div>
                </div>
            `).join('');
            previewVideos.innerHTML = videosHtml;
        }
        
        // Show book button
        const bookBtn = document.getElementById('bookBtn');
        if (bookBtn) {
            bookBtn.textContent = 'Book This House & Unlock Landlord Contact';
            bookBtn.classList.remove('hidden');
        }
        
        // Hide full modal, show preview modal
        houseModal.classList.add('hidden');
        previewModal.classList.remove('hidden');
        
        console.log('✅ Preview modal opened (limited view - landlord info hidden until booking)');
    } catch (error) {
        console.error('Error showing preview modal:', error);
        errorMgr.show('Error displaying house preview. Please try again.', 'error');
    }
}

function showFullDetailsModal(house, isBookedByUser = false) {
    // FULL VIEW - After Booking
    // Show all information including landlord details
    
    try {
        const mainImage = document.getElementById('mainImage');
        const galleryThumbnails = document.getElementById('galleryThumbnails');
        
        if (mainImage && house.images && house.images.length > 0) {
            mainImage.innerHTML = `<img src="${house.images[0]}" alt="${house.title}" class="img-responsive">`;
        }
        
        if (galleryThumbnails && house.images && house.images.length > 1) {
            galleryThumbnails.innerHTML = house.images.map((img, idx) => `
                <div class="thumbnail" data-img="${img}">
                    <img src="${img}" alt="Thumbnail ${idx + 1}" class="thumbnail-img">
                </div>
            `).join('');
            
            // Add event listeners for thumbnails
            galleryThumbnails.querySelectorAll('.thumbnail').forEach(thumb => {
                thumb.addEventListener('click', function() {
                    changeMainImage(this.dataset.img, this);
                });
            });
        }

        const modalTitle = document.getElementById('modalTitle');
        if (modalTitle) {modalTitle.textContent = house.title || 'Property Details';}
        
        const modalLocation = document.getElementById('modalLocation');
        if (modalLocation) {modalLocation.textContent = `📍 ${house.location || 'Location not specified'}`;}
        
        const modalPrice = document.getElementById('modalPrice');
        if (modalPrice && house.price) {modalPrice.textContent = `KSH ${house.price.toLocaleString()}/month`;}
        
        const modalDescription = document.getElementById('modalDescription');
        if (modalDescription) {modalDescription.textContent = house.description || 'No description available';}
        
        const modalFeatures = document.getElementById('modalFeatures');
        if (modalFeatures) {
            const featuresHtml = (house.features && house.features.length > 0)
                ? house.features.map(f => `<div class="feature-item">${f}</div>`).join('')
                : '<div class="feature-item">Standard amenities</div>';
            modalFeatures.innerHTML = `<div class="features">${featuresHtml}</div>`;
        }

        // SHOW landlord information (full details)
        const modalLandlordInfo = document.getElementById('modalLandlordInfo');
        if (modalLandlordInfo) {
            const landlordHtml = `
                <div class="landlord-details">
                    <h3>👤 Landlord Information</h3>
                    <p><strong>Name:</strong> ${house.landlord || 'Not provided'}</p>
                    <p><strong>Contact:</strong> ${house.contact || 'Contact available after booking'}</p>
                    ${isBookedByUser ? '<p class="text-success font-bold">✅ You have an active booking for this property</p>' : ''}
                </div>
            `;
            modalLandlordInfo.innerHTML = landlordHtml;
        }

        const modalVideos = document.getElementById('modalVideos');
        if (modalVideos && house.videos && house.videos.length > 0) {
            const videosHtml = `
                <h3>House Tours</h3>
                ${house.videos.map(video => `
                    <div class="video-container">
                        <video width="100%" height="300" controls>
                            <source src="${video}" type="video/mp4">
                            Your browser does not support the video tag.
                        </video>
                    </div>
                `).join('')}
            `;
            modalVideos.innerHTML = videosHtml;
        }

        console.log('✅ Full details modal opened for:', house.title);
        houseModal.classList.remove('hidden');
        const previewModal = document.getElementById('housePreviewModal');
        if (previewModal) {previewModal.classList.add('hidden');}
    } catch (error) {
        console.error('Error showing full details modal:', error);
        errorMgr.show('Error displaying house details. Please try again.', 'error');
    }
}

function changeMainImage(imageSrc, element) {
    try {
        const mainImage = document.getElementById('mainImage');
        if (mainImage) {
            mainImage.innerHTML = `<img src="${imageSrc}" alt="House image" class="img-responsive">`;
        }
        
        document.querySelectorAll('.thumbnail').forEach(thumb => {
            thumb.classList.remove('thumbnail-selected');
        });
        
        if (element) {
            element.classList.add('thumbnail-selected');
        }
    } catch (error) {
        console.error('Error changing image:', error);
    }
}

function openBookingModal() {
    if (!selectedHouse) {return;}
    
    document.getElementById('bookingDetails').innerHTML = `
        <div class="booking-details-panel">
            <p><strong>Property:</strong> ${selectedHouse.title}</p>
            <p><strong>Location:</strong> ${selectedHouse.location}</p>
            <p><strong>Price:</strong> KSH ${selectedHouse.price.toLocaleString()}/month</p>
            <p><strong>Landlord:</strong> ${selectedHouse.landlord}</p>
            <p><strong>Contact:</strong> ${selectedHouse.contact}</p>
        </div>
    `;
    
    houseModal.classList.add('hidden');
    bookingModal.classList.remove('hidden');
}

async function confirmBooking() {
    const confirmBtn = document.getElementById('confirmBookingBtn');
    confirmBtn.textContent = 'Processing...';
    confirmBtn.disabled = true;

    try {
        // Get user details from localStorage or form
        const userEmail = localStorage.getItem('userEmail') || prompt('Enter your email:') || 'guest@chukacrribs.local';
        const userName = localStorage.getItem('userName') || prompt('Enter your name:') || 'Guest User';
        const userPhone = localStorage.getItem('userPhone') || prompt('Enter your phone number (e.g., +254701234567):') || '+254701234567';
        const token = localStorage.getItem('accessToken') || '';

        // Save user info for future reference
        localStorage.setItem('userEmail', userEmail);
        localStorage.setItem('userName', userName);
        localStorage.setItem('userPhone', userPhone);

        // Create booking via API
        const response = await fetch('/api/bookings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                houseId: selectedHouse.id,
                userEmail: userEmail,
                userName: userName,
                userPhone: userPhone,
                moveInDate: new Date().toISOString(),
                tokenUsed: token
            })
        });

        const data = await response.json();

        if (data.success) {
            // Show success confirmation modal
            const confirmationDetails = [
                `✅ ${data.booking.confirmationMessage}`,
                `Landlord: ${data.booking.landlord}`,
                `Location: ${data.booking.location}`,
                `SMS confirmation sent to ${userPhone}`
            ];
            
            errorMgr.showConfirmation('Booking Confirmed!', confirmationDetails, () => {
                // Remove the booked listing from allHouses array
                allHouses = allHouses.filter(house => house.id !== selectedHouse.id);
                
                // Remove from DOM if it exists
                const listingElement = document.querySelector(`[data-house-id="${selectedHouse.id}"]`);
                if (listingElement) {
                    listingElement.remove();
                }
                
                // Check if there are no more listings
                if (allHouses.length === 0) {
                    const noListings = document.getElementById('noListings');
                    if (noListings) {noListings.classList.remove('hidden');}
                }
                
                // Close modals
                bookingModal.classList.add('hidden');
                houseModal.classList.add('hidden');
                
                // Reload listings to refresh booking status (with slight delay)
                setTimeout(() => {
                    loadHousesFromAPI();
                }, 1500);
            });
        } else {
            errorMgr.show(`❌ Booking failed: ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('Error confirming booking:', error);
        errorMgr.show(`Network error: ${error.message}`, 'error');
    } finally {
        confirmBtn.textContent = 'Confirm Booking';
        confirmBtn.disabled = false;
    }
}

function setupEventListeners() {
    console.log('Setting up event listeners for listings page');
    
    // Close buttons
    document.querySelectorAll('.close').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const modal = this.closest('.modal');
            if (modal) {
                modal.classList.add('hidden');
                console.log('Modal closed');
            }
        });
    });

    // Close modals when clicking outside
    document.addEventListener('click', function(e) {
        if (!houseModal.classList.contains('hidden') && e.target === houseModal) {
            houseModal.classList.add('hidden');
        }
        if (!bookingModal.classList.contains('hidden') && e.target === bookingModal) {
            bookingModal.classList.add('hidden');
        }
    });

    // Book button from PREVIEW MODAL (before payment) - Triggers payment flow
    const bookBtn = document.getElementById('bookBtn');
    if (bookBtn) {
        bookBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Book button clicked from preview modal - Opening payment');
            openPaymentModal();
        });
    }

    // Book button from FULL DETAILS MODAL (after payment) - Triggers booking
    const fullBookBtn = document.getElementById('fullBookBtn');
    if (fullBookBtn) {
        fullBookBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Manage booking button clicked');
            openBookingModal();
        });
    }

    // Booking buttons
    const confirmBookingBtn = document.getElementById('confirmBookingBtn');
    const cancelBookingBtn = document.getElementById('cancelBookingBtn');
    
    if (confirmBookingBtn) {
        confirmBookingBtn.addEventListener('click', function(e) {
            e.preventDefault();
            confirmBooking();
        });
    }
    
    if (cancelBookingBtn) {
            cancelBookingBtn.addEventListener('click', function(e) {
            e.preventDefault();
            bookingModal.classList.add('hidden');
        });
    }

    // Search and filter
    if (searchBtn) {
        searchBtn.addEventListener('click', function(e) {
            e.preventDefault();
            filterHouses();
        });
    }
    if (searchInput) {searchInput.addEventListener('keyup', filterHouses);}
    if (priceFilter) {priceFilter.addEventListener('change', filterHouses);}
    if (typeFilter) {typeFilter.addEventListener('change', filterHouses);}
    if (sortSelect) {sortSelect.addEventListener('change', filterHouses);}
}

function filterHouses() {
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const priceRange = priceFilter ? priceFilter.value : '';
    const type = typeFilter ? typeFilter.value : '';
    const sortBy = sortSelect ? sortSelect.value : 'newest';

    let filtered = allHouses.filter(house => {
        const matchesSearch = house.title.toLowerCase().includes(searchTerm) ||
                            house.location.toLowerCase().includes(searchTerm) ||
                            house.description.toLowerCase().includes(searchTerm);
        
        const matchesPrice = !priceRange || checkPriceRange(house.price, priceRange);
        const matchesType = !type || house.type === type;

        return matchesSearch && matchesPrice && matchesType;
    });

    // Apply sorting
    filtered = sortHouses(filtered, sortBy);

    displayHouses(filtered);
}

function checkPriceRange(price, range) {
    const [min, max] = range.split('-').map(p => parseInt(p) || Infinity);
    return price >= min && price <= max;
}

function sortHouses(houses, sortBy) {
    return houses.sort((a, b) => {
        switch (sortBy) {
            case 'price-low':
                return a.price - b.price;
            case 'price-high':
                return b.price - a.price;
            case 'rating':
                return (b.rating || 0) - (a.rating || 0);
            case 'newest':
            default:
                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        }
    });
}
