// Dashboard State
let landlordData = null;
const currentToken = localStorage.getItem('landlordToken');

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
  // Check authentication
  if (!currentToken) {
    window.location.href = '/landlord-login.html';
    return;
  }

  // Load landlord profile
  loadLandlordProfile();

  // Setup event listeners
  setupEventListeners();

  // Load initial data
  loadDashboard();
});

// Setup Event Listeners
function setupEventListeners() {
  // Navigation links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.dataset.section;
      navigateSection(section);
    });
  });

  // Logout button
  document.getElementById('logoutBtn').addEventListener('click', logout);

  // Add property form
  document.getElementById('addPropertyForm').addEventListener('submit', addProperty);

  // Profile form
  document.getElementById('profileForm').addEventListener('submit', updateProfile);

  // Sidebar toggle
  document.getElementById('toggleSidebar')?.addEventListener('click', toggleSidebar);

  // Delegated action handlers
  document.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    const id = e.target.dataset.id;

    if (action === 'view') {
      viewPropertyDetails(id);
    } else if (action === 'edit') {
      editProperty(id);
    } else if (action === 'toggle') {
      toggleAvailability(id);
    } else if (action === 'delete') {
      deleteProperty(id);
    } else if (action === 'confirm') {
      confirmBooking(id);
    } else if (action === 'reject') {
      rejectBooking(id);
    } else if (action === 'submit-edit') {
      submitEditProperty(id);
    } else if (action === 'close') {
      closeModal();
    }
  });
}

// Navigate Between Sections
function navigateSection(section) {
  // Hide all sections
  document.querySelectorAll('.content-section').forEach(s => {
    s.classList.remove('active');
  });

  // Show selected section
  document.getElementById(section).classList.add('active');

  // Update nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.section === section) {
      link.classList.add('active');
    }
  });

  // Update page title
  const titles = {
    dashboard: 'Dashboard',
    properties: 'My Properties',
    'add-property': 'Add New Property',
    bookings: 'Bookings',
    profile: 'My Profile'
  };
  document.getElementById('pageTitle').textContent = titles[section] || 'Dashboard';

  // Load section-specific data
  if (section === 'properties') {
    loadProperties();
  } else if (section === 'bookings') {
    loadBookings();
  } else if (section === 'profile') {
    loadProfileForm();
  }
}

// Load Landlord Profile
async function loadLandlordProfile() {
  try {
    const response = await fetch('/api/auth/profile', {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });

    if (!response.ok) {
      if (response.status === 401) {
        logout();
        return;
      }
      throw new Error('Failed to load profile');
    }

    landlordData = await response.json();
    updateDashboardWithProfile();
  } catch (error) {
    console.error('Error loading profile:', error);
    showToast('Error loading profile', 'error');
  }
}

// Update Dashboard with Profile
function updateDashboardWithProfile() {
  const totalViews = landlordData.properties?.reduce((sum, prop) => sum + (prop.views || 0), 0) || 0;
  const avgRating = landlordData.rating || 0;

  document.getElementById('totalProperties').textContent = landlordData.properties?.length || 0;
  document.getElementById('totalViews').textContent = totalViews;
  document.getElementById('activeBookings').textContent = landlordData.totalBookings || 0;
  document.getElementById('avgRating').textContent = avgRating.toFixed(1);
}

// Load Dashboard
async function loadDashboard() {
  try {
    const response = await fetch('/api/landlord-properties', {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });

    if (!response.ok) {throw new Error('Failed to load properties');}

    const data = await response.json();
    displayRecentProperties(data.properties || []);
  } catch (error) {
    console.error('Error loading dashboard:', error);
    showToast('Error loading dashboard', 'error');
  }
}

// Display Recent Properties
function displayRecentProperties(properties) {
  const container = document.getElementById('recentProperties');
  if (properties.length === 0) {
    container.innerHTML = '<p class="empty-state">No properties yet</p>';
    return;
  }

  const recent = properties.slice(0, 3);
  container.innerHTML = recent.map(prop => `
    <div class="property-item">
      <div class="property-item-info">
        <h3>${prop.title}</h3>
        <div class="property-item-meta">
          <span>📍 ${prop.location}</span>
          <span>💰 KSH ${prop.price.toLocaleString()}</span>
          <span>👁️ ${prop.views || 0} views</span>
          <span>⭐ ${(prop.rating || 0).toFixed(1)}</span>
        </div>
      </div>
      <button class="btn btn-primary" data-action="view" data-id="${prop._id}">View</button>
    </div>
  `).join('');
}

// Load Properties
async function loadProperties() {
  try {
    const response = await fetch('/api/landlord-properties', {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });

    if (!response.ok) {throw new Error('Failed to load properties');}

    const data = await response.json();
    displayProperties(data.properties || []);
  } catch (error) {
    console.error('Error loading properties:', error);
    showToast('Error loading properties', 'error');
  }
}

// Display Properties
function displayProperties(properties) {
  const container = document.getElementById('propertiesList');
  const noProperties = document.getElementById('noProperties');

  if (properties.length === 0) {
    container.innerHTML = '';
    noProperties.classList.remove('hidden');
    return;
  }

  noProperties.classList.add('hidden');
  container.innerHTML = properties.map(prop => `
    <div class="property-card">
      <div class="property-image">
        🏠
        <div class="property-status ${!prop.available ? 'unavailable' : ''}">
          ${prop.available ? 'Available' : 'Unavailable'}
        </div>
        <div class="property-approval-status ${prop.approved ? 'approved' : 'pending'}">
          ${prop.approved ? '✅ Approved' : '⏳ Pending Approval'}
        </div>
      </div>
      <div class="property-content">
        <div class="property-title">${prop.title}</div>
        <div class="property-location">📍 ${prop.location}</div>
        <div class="property-price">KSH ${prop.price.toLocaleString()}</div>
        <div class="property-stats">
          <div class="stat">
            <div class="stat-number">${prop.views || 0}</div>
            <div class="stat-label-small">Views</div>
          </div>
          <div class="stat">
            <div class="stat-number">${prop.type}</div>
            <div class="stat-label-small">Type</div>
          </div>
          <div class="stat">
            <div class="stat-number">${(prop.rating || 0).toFixed(1)}</div>
            <div class="stat-label-small">Rating</div>
          </div>
        </div>
        <div class="property-actions">
          <button class="btn-edit" data-action="edit" data-id="${prop._id}">Edit</button>
          <button class="btn-toggle" data-action="toggle" data-id="${prop._id}">Toggle</button>
          <button class="btn-delete" data-action="delete" data-id="${prop._id}id}">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

// Add Property
async function addProperty(e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const data = {
    title: formData.get('title'),
    location: formData.get('location'),
    price: parseInt(formData.get('price')),
    type: formData.get('type'),
    landlordName: formData.get('landlordName'),
    contact: formData.get('contact'),
    description: formData.get('description'),
    images: formData.get('images') ? formData.get('images').split(',').map(s => s.trim()) : [],
    videos: formData.get('videos') ? formData.get('videos').split(',').map(s => s.trim()) : [],
    features: formData.get('features') ? formData.get('features').split(',').map(s => s.trim()) : []
  };

  try {
    const response = await fetch('/api/landlord-properties', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {throw new Error('Failed to create property');}

    showToast('✅ Property submitted successfully! Awaiting admin approval.', 'success');
    e.target.reset();
    setTimeout(() => navigateSection('properties'), 1500);
  } catch (error) {
    console.error('Error adding property:', error);
    showToast('Error creating property', 'error');
  }
}

// Edit Property
function editProperty(propertyId) {
  const property = landlordData.properties.find(p => p._id === propertyId);
  if (!property) {
    showToast('Property not found', 'error');
    return;
  }

  const editHTML = `
    <h3>Edit Property</h3>
    <form id="editPropertyForm" class="property-form">
      <div class="form-row">
        <div class="form-group">
          <label>Property Title *</label>
          <input type="text" id="editTitle" value="${property.title}" required>
        </div>
        <div class="form-group">
          <label>Location *</label>
          <input type="text" id="editLocation" value="${property.location}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Price (KSH) *</label>
          <input type="number" id="editPrice" value="${property.price}" required min="0">
        </div>
        <div class="form-group">
          <label>Type *</label>
          <select id="editType" required>
            <option value="single" ${property.type === 'single' ? 'selected' : ''}>Single Room</option>
            <option value="apartment" ${property.type === 'apartment' ? 'selected' : ''}>Apartment</option>
            <option value="bedsitter" ${property.type === 'bedsitter' ? 'selected' : ''}>Bedsitter</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Description *</label>
        <textarea id="editDescription" required>${property.description}</textarea>
      </div>
      <div class="form-group">
        <label>Features</label>
        <textarea id="editFeatures">${(property.features || []).join(', ')}</textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-primary" data-action="submit-edit" data-id="${propertyId}">Save</button>
        <button type="button" class="btn btn-secondary" data-action="close">Cancel</button>
      </div>
    </form>
  `;
  document.getElementById('propertyDetails').innerHTML = editHTML;
  document.getElementById('propertyModal').classList.add('active');
}

// Delete Property
async function deleteProperty(propertyId) {
  if (!confirm('Are you sure you want to delete this property?')) {return;}

  try {
    const response = await fetch(`/api/landlord-properties/${propertyId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });

    if (!response.ok) {throw new Error('Failed to delete property');}

    showToast('Property deleted successfully', 'success');
    loadProperties();
  } catch (error) {
    console.error('Error deleting property:', error);
    showToast('Error deleting property', 'error');
  }
}

// Toggle Availability
async function toggleAvailability(propertyId) {
  try {
    const response = await fetch(`/api/landlord-properties/${propertyId}/toggle-availability`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });

    if (!response.ok) {throw new Error('Failed to toggle availability');}

    const result = await response.json();
    showToast(result.message, 'success');
    loadProperties();
  } catch (error) {
    console.error('Error toggling availability:', error);
    showToast('Error toggling availability', 'error');
  }
}

// View Property Details
function viewPropertyDetails(propertyId) {
  const property = landlordData.properties.find(p => p._id === propertyId);
  if (!property) {
    showToast('Property not found', 'error');
    return;
  }
  const detailsHTML = `
    <h3>${property.title}</h3>
    <div class="property-details-content">
      <p><strong>Location:</strong> ${property.location}</p>
      <p><strong>Price:</strong> KSH ${property.price.toLocaleString()}</p>
      <p><strong>Type:</strong> ${property.type}</p>
      <p><strong>Description:</strong> ${property.description}</p>
      <p><strong>Features:</strong> ${(property.features || []).join(', ')}</p>
      <p><strong>Status:</strong> ${property.available ? '✅ Available' : '❌ Unavailable'}</p>
      <p><strong>Approval:</strong> ${property.approved ? '✅ Approved' : '⏳ Pending'}</p>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" data-action="close">Close</button>
    </div>
  `;
  document.getElementById('propertyDetails').innerHTML = detailsHTML;
  document.getElementById('propertyModal').classList.add('active');
}

// Load Bookings
async function loadBookings() {
  try {
    const response = await fetch('/api/landlord-properties/bookings', {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    if (!response.ok) {throw new Error('Failed to load bookings');}
    const data = await response.json();
    displayBookings(data.bookings || []);
  } catch (error) {
    console.error('Error loading bookings:', error);
    const bookingsList = document.getElementById('bookingsList');
    const noBookings = document.getElementById('noBookings');
    bookingsList.innerHTML = '';
    noBookings.classList.add('hidden');
  }
}

// Display Bookings
function displayBookings(bookings) {
  const bookingsList = document.getElementById('bookingsList');
  const noBookings = document.getElementById('noBookings');
  if (bookings.length === 0) {
    bookingsList.innerHTML = '';
    noBookings.classList.add('hidden');
    return;
  }
  noBookings.classList.remove('hidden');
  bookingsList.innerHTML = bookings.map(b => `
    <div class="booking-card">
      <div class="booking-info">
        <h4>${b.property?.title || 'Property'}</h4>
        <p><strong>Tenant:</strong> ${b.tenant?.name || 'Unknown'}</p>
        <p><strong>Check-in:</strong> ${new Date(b.checkIn).toLocaleDateString()}</p>
        <p><strong>Check-out:</strong> ${new Date(b.checkOut).toLocaleDateString()}</p>
        <p><strong>Status:</strong> <span class="status-badge ${b.status}">${b.status}</span></p>
      </div>
      <div class="booking-actions">
        <button class="btn btn-small" data-action="confirm" data-id="${b._id}">Confirm</button>
        <button class="btn btn-danger btn-small" data-action="reject" data-id="${b._id}">Reject</button>
      </div>
    </div>
  `).join('');
}

// Confirm Booking
function confirmBooking(bookingId) {
  fetch(`/api/landlord-properties/bookings/${bookingId}/confirm`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${currentToken}` }
  })
  .then(r => r.ok ? r.json() : Promise.reject('Failed'))
  .then(() => {
    showToast('Booking confirmed!', 'success');
    loadBookings();
  })
  .catch(() => showToast('Error confirming booking', 'error'));
}

// Reject Booking
function rejectBooking(bookingId) {
  if (!confirm('Reject this booking?')) {return;}
  fetch(`/api/landlord-properties/bookings/${bookingId}/reject`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${currentToken}` }
  })
  .then(r => r.ok ? r.json() : Promise.reject('Failed'))
  .then(() => {
    showToast('Booking rejected', 'success');
    loadBookings();
  })
  .catch(() => showToast('Error rejecting booking', 'error'));
}

// Submit Edit Property
function submitEditProperty(propertyId) {
  const data = {
    title: document.getElementById('editTitle').value,
    location: document.getElementById('editLocation').value,
    price: parseInt(document.getElementById('editPrice').value),
    type: document.getElementById('editType').value,
    description: document.getElementById('editDescription').value,
    features: document.getElementById('editFeatures').value.split(',').map(f => f.trim()).filter(f => f)
  };
  fetch(`/api/landlord-properties/${propertyId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentToken}`
    },
    body: JSON.stringify(data)
  })
  .then(r => r.ok ? r.json() : Promise.reject('Failed'))
  .then(() => {
    showToast('Property updated!', 'success');
    closeModal();
    loadProperties();
  })
  .catch(() => showToast('Error updating property', 'error'));
}

// Load Profile Form
function loadProfileForm() {
  if (!landlordData) {return;}

  document.getElementById('profileName').value = landlordData.name;
  document.getElementById('profileEmail').value = landlordData.email;
  document.getElementById('profilePhone').value = landlordData.phone;
  document.getElementById('profileId').value = landlordData.idNumber;
  document.getElementById('profileBank').value = landlordData.bankName || '';
  document.getElementById('profileAccount').value = landlordData.bankAccount || '';
}

// Update Profile
async function updateProfile(e) {
  e.preventDefault();

  const data = {
    name: document.getElementById('profileName').value,
    phone: document.getElementById('profilePhone').value,
    bankName: document.getElementById('profileBank').value,
    bankAccount: document.getElementById('profileAccount').value
  };

  try {
    const response = await fetch('/api/auth/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {throw new Error('Failed to update profile');}

    showToast('Profile updated successfully', 'success');
    await loadLandlordProfile();
  } catch (error) {
    console.error('Error updating profile:', error);
    showToast('Error updating profile', 'error');
  }
}

// Logout
function logout() {
  if (confirm('Are you sure you want to logout?')) {
    localStorage.removeItem('landlordToken');
    window.location.href = '/landlord-login.html';
  }
}

// Toggle Sidebar
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('active');
}

// Close Modal
function closeModal() {
  document.getElementById('propertyModal').classList.remove('active');
}

// Show Toast Notification
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}