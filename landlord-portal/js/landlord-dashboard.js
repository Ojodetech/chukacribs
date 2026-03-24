// Dashboard JavaScript - Externalized to bypass CSP restrictions
// Check authentication on page load
window.addEventListener('DOMContentLoaded', async () => {
    console.log('Dashboard page loaded');
    
    // Check authentication from backend (source of truth)
    const isAuth = await checkLandlordAuth();
    
    if (!isAuth) {
        console.log('Not authenticated, redirecting to login');
        window.location.href = '/landlord-portal/landlord-login.html';
        return;
    }
    
    console.log('✅ Authenticated - Loading dashboard');
    loadDashboard();
    setupEventListeners();
});

// Check landlord authentication from backend
async function checkLandlordAuth() {
    try {
        const response = await fetch('/api/auth/me', {
            method: 'GET',
            credentials: 'include', // Include secure cookies
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            return false;
        }

        const user = await response.json();
        return user && user.role === 'landlord';
    } catch (err) {
        console.error('Error checking landlord auth:', err);
        return false;
    }
}

function setupEventListeners() {
    console.log('Setting up event listeners...');
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // Action buttons
    const addPropertyBtn = document.getElementById('addPropertyBtn');
    if (addPropertyBtn) {
        addPropertyBtn.addEventListener('click', openAddPropertyModal);
    }

    const managePropertiesBtn = document.getElementById('managePropertiesBtn');
    if (managePropertiesBtn) {
        managePropertiesBtn.addEventListener('click', openManagePropertiesModal);
    }

    const viewBookingsBtn = document.getElementById('viewBookingsBtn');
    if (viewBookingsBtn) {
        viewBookingsBtn.addEventListener('click', openViewBookingsModal);
    }

    const accountSettingsBtn = document.getElementById('accountSettingsBtn');
    if (accountSettingsBtn) {
        accountSettingsBtn.addEventListener('click', openAccountSettingsModal);
    }

    // Modal controls for Add Property
    const closeModalBtn = document.getElementById('closeModalBtn');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeAddPropertyModal);
    }

    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeAddPropertyModal);
    }

    const propertyForm = document.getElementById('propertyForm');
    if (propertyForm) {
        console.log('Property form found, attaching submit listener');
        propertyForm.addEventListener('submit', handleAddProperty);
    } else {
        console.warn('Property form not found!');
    }

    // Modal controls for Account Settings
    const accountSettingsForm = document.getElementById('accountSettingsForm');
    if (accountSettingsForm) {
        accountSettingsForm.addEventListener('submit', saveAccountSettings);
    }

    // Close modals when clicking outside
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });

    // Handle close buttons with data attributes
    const closeButtons = document.querySelectorAll('[data-close]');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const modalId = btn.getAttribute('data-close');
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.remove('show');
            }
        });
    });
}

async function loadDashboard() {
    try {
        // Create abort controller with 5 second timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        // Fetch user profile from backend
        const response = await fetch('/api/auth/me', {
            method: 'GET',
            credentials: 'include', // Include secure auth cookie
            headers: {
                'Content-Type': 'application/json'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        console.log('Profile API response status:', response.status);

        if (!response.ok) {
            if (response.status === 401) {
                // Token invalid/expired
                localStorage.removeItem('token');
                window.location.href = '/landlord-portal/landlord-login.html';
                return;
            }
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log('Profile data received:', data);
        
        // Update user info
        document.getElementById('userName').textContent = data.name || 'Landlord';
        document.getElementById('userEmail').textContent = data.email || '';

        // Calculate stats
        const properties = data.properties || [];
        console.log('Properties found:', properties.length);
        const activeListings = properties.filter(p => p.status === 'published').length;
        const totalViews = properties.reduce((sum, p) => sum + (p.views || 0), 0);
        const bookings = (data.bookings || []).length;

        // Update statistics
        document.getElementById('totalProperties').textContent = properties.length;
        document.getElementById('activeListings').textContent = activeListings;
        document.getElementById('totalBookings').textContent = bookings;
        document.getElementById('totalViews').textContent = totalViews;

        // Display properties
        displayProperties(properties);

        // Show content, hide loading
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('dashboardContent').classList.remove('hidden');

    } catch (error) {
        console.error('Dashboard error:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        showError('Failed to load dashboard. Showing empty dashboard...');
        
        // Fallback: Show content anyway with zeros
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('dashboardContent').classList.remove('hidden');
    }
    
    // Ensure dashboard is shown after 3 seconds regardless
    setTimeout(() => {
        const loadingState = document.getElementById('loadingState');
        const dashboardContent = document.getElementById('dashboardContent');
        if (loadingState && !loadingState.classList.contains('hidden')) {
            console.log('Forcing dashboard to show after timeout');
            loadingState.classList.add('hidden');
            dashboardContent.classList.remove('hidden');
            showError('Dashboard loaded but could not fetch data. Please refresh to try again.');
        }
    }, 3000);
}

function displayProperties(properties) {
    const grid = document.getElementById('propertiesGrid');
    
    if (!properties || properties.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🏠</div>
                <p>No properties listed yet</p>
                <p class="empty-property-msg">Add your first property to get started!</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = properties.map(property => `
        <div class="property-card">
            <div class="property-image">🏠</div>
            <div class="property-info">
                <div class="property-title">${property.title || 'Untitled Property'}</div>
                <div class="property-price">KSH ${property.price ? property.price.toLocaleString() : '0'}</div>
                <div class="property-location">📍 ${property.location || 'Chuka, Kenya'}</div>
                <span class="property-status ${property.status === 'published' ? 'status-active' : 'status-pending'}">
                    ${property.status === 'published' ? '✓ Active' : '⏳ Pending'}
                </span>
            </div>
        </div>
    `).join('');
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
    setTimeout(() => {
        errorDiv.classList.remove('show');
    }, 5000);
}

function showComingSoon(feature) {
    alert(`${feature} - Coming Soon! 🚀`);
}

// Account Settings
async function openAccountSettingsModal() {
    const modal = document.getElementById('accountSettingsModal');
    if (!modal) {return;}

    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/api/auth/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const user = await response.json();

        document.getElementById('settingsName').value = user.name || '';
        document.getElementById('settingsEmail').value = user.email || '';
        document.getElementById('settingsPhone').value = user.phone || '';

        modal.classList.add('show');
    } catch (error) {
        alert('Error loading account settings');
    }
}

function closeAccountSettingsModal() {
    const modal = document.getElementById('accountSettingsModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

async function saveAccountSettings(e) {
    e.preventDefault();
    
    const name = document.getElementById('settingsName').value.trim();
    const email = document.getElementById('settingsEmail').value.trim();
    const phone = document.getElementById('settingsPhone').value.trim();

    if (!name || !email || !phone) {
        alert('All fields are required');
        return;
    }

    try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        const response = await fetch('/api/auth/profile', {
            method: 'PATCH',
            credentials: 'include',  // Include secure HTTP-only cookie
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, phone })
        });

        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';

        if (!response.ok) {
            const error = await response.json();
            alert(`Error: ${error.message}`);
            return;
        }

        alert('Account settings updated successfully!');
        closeAccountSettingsModal();
    } catch (error) {
        console.error('Error saving settings:', error);
        alert('Error saving settings');
    }
}

// Manage Properties
async function openManagePropertiesModal() {
    const modal = document.getElementById('managePropertiesModal');
    if (!modal) {return;}

    try {
        const response = await fetch('/api/landlord-properties', {
            credentials: 'include',  // Include secure HTTP-only cookie
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        const properties = data.properties || [];

        const container = document.getElementById('managedPropertiesContainer');
        if (properties.length === 0) {
            container.innerHTML = '<p class="empty-state-msg">No properties yet</p>';
        } else {
            container.innerHTML = properties.map(prop => `
                <div class="managed-property-item">
                    <div class="property-info">
                        <h4>${prop.title}</h4>
                        <p>📍 ${prop.location} | KSH ${prop.price?.toLocaleString()}/month</p>
                        <p>Status: <strong>${prop.status === 'published' ? '✅ Active' : '⏳ Pending Approval'}</strong></p>
                    </div>
                    <div class="property-actions">
                        <button class="btn-small" data-action="edit" data-property-id="${prop._id}">✏️ Edit</button>
                        <button class="btn-small btn-danger" data-action="delete" data-property-id="${prop._id}">🗑️ Delete</button>
                    </div>
                </div>
            `).join('');

            // Add event listeners to the dynamically created buttons
            container.querySelectorAll('[data-action="edit"]').forEach(btn => {
                btn.addEventListener('click', (e) => editProperty(e.target.getAttribute('data-property-id')));
            });
            container.querySelectorAll('[data-action="delete"]').forEach(btn => {
                btn.addEventListener('click', (e) => deleteProperty(e.target.getAttribute('data-property-id')));
            });
        }

        modal.classList.add('show');
    } catch (error) {
        alert('Error loading properties');
    }
}

function closeManagePropertiesModal() {
    const modal = document.getElementById('managePropertiesModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

function editProperty(propertyId) {
    alert(`Edit property ${propertyId} - Coming Soon! 🚀`);
}

async function deleteProperty(propertyId) {
    if (!confirm('Are you sure you want to delete this property?')) {return;}

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`/api/houses/${propertyId}/landlord`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const error = await response.json();
            alert(`Error: ${error.message}`);
            return;
        }

        alert('Property deleted successfully');
        openManagePropertiesModal();
    } catch (error) {
        console.error('Error deleting property:', error);
        alert('Error deleting property');
    }
}

// View Bookings
async function openViewBookingsModal() {
    const modal = document.getElementById('viewBookingsModal');
    if (!modal) {return;}

    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/api/auth/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        const bookings = data.bookings || [];

        const container = document.getElementById('bookingsContainer');
        if (bookings.length === 0) {
            container.innerHTML = '<p class="empty-state-msg">No bookings yet</p>';
        } else {
            container.innerHTML = bookings.map(booking => `
                <div class="booking-item">
                    <div class="booking-info">
                        <h4>${booking.propertyTitle || 'Property'}</h4>
                        <p>👤 Guest: ${booking.guestName || 'N/A'}</p>
                        <p>📅 Check-in: ${new Date(booking.checkInDate).toLocaleDateString()}</p>
                        <p>📅 Check-out: ${new Date(booking.checkOutDate).toLocaleDateString()}</p>
                        <p>Status: <strong>${booking.status || 'Pending'}</strong></p>
                    </div>
                </div>
            `).join('');
        }

        modal.classList.add('show');
    } catch (error) {
        alert('Error loading bookings');
    }
}

function closeViewBookingsModal() {
    const modal = document.getElementById('viewBookingsModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

function openAddPropertyModal() {
    const modal = document.getElementById('addPropertyModal');
    if (modal) {
        modal.classList.add('show');
    }
}

function closeAddPropertyModal() {
    const modal = document.getElementById('addPropertyModal');
    if (modal) {
        modal.classList.remove('show');
        // Reset form
        document.getElementById('propertyForm').reset();
        document.getElementById('successMessage').classList.remove('show');
    }
}

async function handleAddProperty(e) {
    console.log('=== PROPERTY FORM SUBMITTED ===');
    console.log('Event:', e);
    console.log('Event type:', e.type);
    e.preventDefault();
    e.stopPropagation();
    console.log('preventDefault and stopPropagation called');

    // Token is in secure HTTP-only cookie, send with credentials: 'include'
    console.log('Using secure HTTP-only cookie for authentication');

    // Get form values
    const title = document.getElementById('propertyTitle').value.trim();
    const location = document.getElementById('propertyLocation').value.trim();
    const priceValue = document.getElementById('propertyPrice').value.trim();
    const type = document.getElementById('propertyType').value.trim();
    const bedroomsValue = document.getElementById('propertyBedrooms').value.trim();

    console.log('Form values:', { title, location, priceValue, type, bedroomsValue });

    // Get amenity checkboxes
    const hasWifi = document.getElementById('propertyWifi').checked;
    const hasWater = document.getElementById('propertyWater').checked;
    const hasElectricity = document.getElementById('propertyElectricity').checked;

    // Get combined media input
    const mediaInput = document.getElementById('propertyMedia');

    console.log('Files:', {
        media: mediaInput.files.length
    });

    // Client-side validation
    const validationErrors = [];

    if (!title || title.length === 0) {
        validationErrors.push('Property title is required');
    }
    if (!location || location.length === 0) {
        validationErrors.push('Location is required');
    }
    if (!priceValue || isNaN(parseInt(priceValue)) || parseInt(priceValue) <= 0) {
        validationErrors.push('Price must be a valid positive number');
    }
    if (!type || type.length === 0) {
        validationErrors.push('Property type is required');
    }
    if (!bedroomsValue || isNaN(parseInt(bedroomsValue)) || parseInt(bedroomsValue) < 0) {
        validationErrors.push('Bedrooms must be a valid number');
    }
    if (!mediaInput.files || mediaInput.files.length === 0) {
        validationErrors.push('Please upload at least one image or video');
    }

    // Check file types on client side
    if (mediaInput.files.length > 0) {
        for (const file of mediaInput.files) {
            if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
                validationErrors.push(`File "${file.name}" must be an image or video file`);
            }
        }
    }

    // Display validation errors
    if (validationErrors.length > 0) {
        console.error('Validation errors:', validationErrors);
        alert(`Please fix these errors:\n\n${  validationErrors.join('\n')}`);
        return;
    }

    console.log('Validation passed, proceeding with upload...');

    try {
        const submitBtn = document.querySelector('#propertyForm button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading...';
        console.log('Submit button disabled, text changed to "Uploading..."');

        // Parse values
        const price = parseInt(priceValue);
        const bedrooms = parseInt(bedroomsValue);

        // Create FormData for file uploads
        const formData = new FormData();
        formData.append('title', title);
        formData.append('location', location);
        formData.append('price', price);
        formData.append('type', type);
        formData.append('bedrooms', bedrooms);
        formData.append('status', 'pending');

        // Add amenities
        formData.append('wifi', hasWifi.toString());
        formData.append('water', hasWater.toString());
        formData.append('electricity', hasElectricity.toString());

        // Note: landlordName and contact are auto-filled by backend from authenticated user

        // Add media files (both images and videos)
        if (mediaInput.files.length > 0) {
            for (let i = 0; i < mediaInput.files.length; i++) {
                const file = mediaInput.files[i];
                if (file.type.startsWith('image/')) {
                    formData.append('images', file);
                } else if (file.type.startsWith('video/')) {
                    formData.append('videos', file);
                }
            }
        }

        // Log formData contents for debugging
        console.log('FormData contents:');
        for (const [key, value] of formData.entries()) {
            if (value instanceof File) {
                console.log(`  ${key}: ${value.name} (${value.type}, ${value.size} bytes)`);
            } else {
                console.log(`  ${key}: ${value}`);
            }
        }

        console.log('Sending fetch request to /api/landlord-properties...');
        const response = await fetch('/api/landlord-properties', {
            method: 'POST',
            credentials: 'include',  // Include secure HTTP-only cookie
            body: formData
        });

        console.log('Response received');
        console.log('Response status:', response.status);
        console.log('Response statusText:', response.statusText);
        console.log('Response headers:', Array.from(response.headers.entries()));

        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Property';

        if (!response.ok) {
            let errorMsg = 'Failed to add property';
            try {
                const error = await response.json();
                console.error('Server error response:', error);
                errorMsg = error.message || error.error || errorMsg;
            } catch (e) {
                console.error('Could not parse error response:', e);
                const text = await response.text();
                console.error('Response text:', text);
            }
            
            // Log full details for debugging
            console.error('Property upload failed:', {
                status: response.status,
                statusText: response.statusText,
                message: errorMsg
            });
            
            alert(`Server Error (${response.status}):\n${errorMsg}\n\nCheck browser console (F12) for more details`);
            return;
        }

        const result = await response.json();
        console.log('Property added successfully:', result);

        // Show success message
        const successMsg = document.getElementById('successMessage');
        if (successMsg) {
            successMsg.classList.add('show');
        }

        // Reset form and reload dashboard after 3 seconds
        setTimeout(() => {
            const form = document.getElementById('propertyForm');
            if (form) {form.reset();}
            closeAddPropertyModal();
            loadDashboard();
        }, 3000);

    } catch (error) {
        console.error('Exception during property addition:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        alert(`Error: ${error.message}`);
        const submitBtn = document.querySelector('#propertyForm button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Property';
    }
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        // Call backend to clear auth cookie
        fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        }).then(() => {
            window.location.href = '/landlord-portal/landlord-login.html';
        }).catch(err => {
            console.error('Logout error:', err);
            window.location.href = '/landlord-portal/landlord-login.html';
        });
    }
}
