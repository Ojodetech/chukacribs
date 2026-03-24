/**
 * Admin Panel Handler
 * Manages admin authentication, property review, and approval workflows
 * CSP-Compliant: No inline scripts, all logic in external file
 */

// ============== STATE ==============
const state = {
    isAuthenticated: false,
    properties: [],
    actionInProgress: new Set()
};

// ============== DOM ==============
const DOM = {
    loginSection: document.getElementById('loginSection'),
    dashboardSection: document.getElementById('dashboardSection'),
    secretKey: document.getElementById('secretKey'),
    loginAlert: document.getElementById('loginAlert'),
    dashboardAlert: document.getElementById('dashboardAlert'),
    propertiesGrid: document.getElementById('propertiesGrid'),
    loginSubmitBtn: document.getElementById('loginSubmitBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    dashboardLink: document.getElementById('dashboardLink')
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    initializeAdminPanel();
});

/**
 * Initialize admin panel and attach event listeners
 */
function initializeAdminPanel() {
    console.log('🔧 Initializing admin panel...');

    showLoginUI(true);
    state.isAuthenticated = false;
    state.properties = [];
    state.actionInProgress.clear();

    console.log('📋 DOM Elements check:');
    console.log('  loginSubmitBtn:', DOM.loginSubmitBtn);
    console.log('  secretKey:', DOM.secretKey);
    console.log('  logoutBtn:', DOM.logoutBtn);

    // Attach event listeners with explicit error handling
    attachEventListeners();

    console.log('✅ Admin panel initialization complete');
}

/**
 * Attach all event listeners
 */
function attachEventListeners() {
    try {
        if (DOM.loginSubmitBtn) {
            console.log('✅ Attaching login button click listener');
            DOM.loginSubmitBtn.addEventListener('click', handleLogin);
        } else {
            console.error('❌ Login button DOM element is null!');
        }
    } catch (e) {
        console.error('❌ Error attaching login button listener:', e);
    }

    try {
        if (DOM.secretKey) {
            console.log('✅ Attaching secret key keypress listener');
            DOM.secretKey.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    console.log('⏎ Enter key pressed');
                    handleLogin();
                }
            });
        }
    } catch (e) {
        console.error('❌ Error attaching keypress listener:', e);
    }

    try {
        if (DOM.logoutBtn) {
            console.log('✅ Attaching logout button click listener');
            DOM.logoutBtn.addEventListener('click', handleLogout);
        } else {
            console.error('❌ Logout button DOM element is null!');
        }
    } catch (e) {
        console.error('❌ Error attaching logout button listener:', e);
    }

    // Attach image error handlers
    document.querySelectorAll('img.property-image').forEach(img => {
        img.addEventListener('error', function() {
            this.src = 'https://via.placeholder.com/350x200?text=No+Image';
        });
    });
}

/**
 * Show alert message
 */
function showAlert(containerId, message, type = 'info') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<div class="alert ${type}">${message}</div>`;

        if (type !== 'error') {
            setTimeout(() => {
                container.innerHTML = '';
            }, 5000);
        }
    }
}

/**
 * Make API call with credentials
 */
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(endpoint, {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
            throw new Error(errorData.message || `HTTP Error ${response.status}`);
        }

        const data = await response.json();
        console.log(`API Response from ${endpoint}:`, data);
        return data;
    } catch (error) {
        console.error(`API Error on ${endpoint}:`, error);
        throw error;
    }
}

/**
 * Handle admin login
 */
async function handleLogin() {
    console.log('🔐 handleLogin() called');
    const secretKey = DOM.secretKey.value.trim();

    if (!secretKey) {
        console.warn('⚠️ No secret key entered');
        showAlert('loginAlert', '❌ Please enter the admin secret key', 'error');
        return;
    }

    console.log('🔑 Secret key entered, attempting authentication...');
    DOM.loginSubmitBtn.disabled = true;
    DOM.loginSubmitBtn.innerHTML = '<span class="loading"></span> Authenticating...';

    try {
        console.log('📍 Calling /api/auth/admin/login...');
        const loginRes = await apiCall('/api/auth/admin/login', {
            method: 'POST',
            body: JSON.stringify({ secretKey })
        });

        console.log('✅ Login response:', loginRes);

        if (!loginRes.success) {
            throw new Error(loginRes.message || 'Authentication failed');
        }

        console.log('🎯 Login successful, verifying admin role...');
        // Verify authentication before showing dashboard
        const authRes = await apiCall('/api/auth/me/admin', { method: 'GET' });

        console.log('🔍 Auth verification response:', authRes);

        if (authRes.role !== 'admin') {
            throw new Error('Invalid admin role');
        }

        console.log('✅ Admin role verified');
        // Only set authenticated after both checks pass
        state.isAuthenticated = true;
        showLoginUI(false);
        await loadProperties();
        showAlert('dashboardAlert', '✅ Login successful!', 'success');
    } catch (error) {
        console.error('❌ Login error:', error);
        showAlert('loginAlert', `❌ ${error.message}`, 'error');
        // Clear any state on failure
        state.isAuthenticated = false;
    } finally {
        DOM.loginSubmitBtn.disabled = false;
        DOM.loginSubmitBtn.innerHTML = 'Authenticate';
    }
}

/**
 * Load pending properties from backend
 */
async function loadProperties() {
    DOM.propertiesGrid.innerHTML = '<p class="loading-placeholder"><span class="loading"></span> Loading properties...</p>';

    try {
        const data = await apiCall('/api/houses/admin/pending', { method: 'GET' });
        state.properties = data.houses || [];
        renderProperties();
    } catch (error) {
        showAlert('dashboardAlert', `❌ Failed to load properties: ${error.message}`, 'error');
        DOM.propertiesGrid.innerHTML = '<div class="empty-state"><p>❌ Error loading properties</p></div>';
    }
}

/**
 * Render properties grid
 */
function renderProperties() {
    if (state.properties.length === 0) {
        DOM.propertiesGrid.innerHTML = '<div class="empty-state"><p>✅ No pending properties</p></div>';
        return;
    }

    DOM.propertiesGrid.innerHTML = state.properties.map(property => `
        <div class="property-card">
            <img
                src="${property.images && property.images[0] ? property.images[0] : 'https://via.placeholder.com/350x200?text=No+Image'}"
                alt="${escapeHtml(property.title)}"
                class="property-image"
            >
            <div class="property-content">
                <h3 class="property-title">${escapeHtml(property.title)}</h3>
                <div class="property-info">
                    <p><strong>Location:</strong> ${escapeHtml(property.location)}</p>
                    <p><strong>Price:</strong> KSH ${property.price.toLocaleString()}</p>
                    <p><strong>Type:</strong> ${escapeHtml(property.type)}</p>
                </div>
                <div class="property-landlord">
                    <strong>${escapeHtml(property.landlord)}</strong>
                    ${property.landlordEmail ? `<p>${escapeHtml(property.landlordEmail)}</p>` : ''}
                    ${property.landlordPhone ? `<p>${escapeHtml(property.landlordPhone)}</p>` : ''}
                </div>
                <div class="property-actions">
                    <button class="btn btn-approve approve-btn" data-id="${property._id}" ${state.actionInProgress.has(`approve-${property._id}`) ? 'disabled' : ''}>
                        ${state.actionInProgress.has(`approve-${property._id}`) ? '⏳' : '✅'} Approve
                    </button>
                    <button class="btn btn-reject reject-btn" data-id="${property._id}" ${state.actionInProgress.has(`reject-${property._id}`) ? 'disabled' : ''}>
                        ${state.actionInProgress.has(`reject-${property._id}`) ? '⏳' : '❌'} Reject
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    // Add event listeners to approval buttons
    document.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', () => approveProperty(btn.dataset.id));
    });

    document.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', () => rejectProperty(btn.dataset.id));
    });
}

/**
 * Approve a property
 */
async function approveProperty(propertyId) {
    await updatePropertyStatus(propertyId, 'approved', 'approve');
}

/**
 * Reject a property
 */
async function rejectProperty(propertyId) {
    await updatePropertyStatus(propertyId, 'rejected', 'reject');
}

/**
 * Update property status (approve/reject)
 */
async function updatePropertyStatus(propertyId, status, action) {
    const actionKey = `${action}-${propertyId}`;
    if (state.actionInProgress.has(actionKey)) {return;}

    state.actionInProgress.add(actionKey);
    renderProperties();

    try {
        await apiCall(`/api/houses/${propertyId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });

        state.properties = state.properties.filter(p => p._id !== propertyId);
        renderProperties();

        const message = status === 'approved'
            ? '✅ Property approved successfully!'
            : '❌ Property rejected successfully!';
        showAlert('dashboardAlert', message, 'success');
    } catch (error) {
        showAlert('dashboardAlert', `❌ Failed to ${action} property: ${error.message}`, 'error');
        renderProperties();
    } finally {
        state.actionInProgress.delete(actionKey);
    }
}

/**
 * Show or hide UI based on authentication state
 */
function showLoginUI(show) {
    // Security: Prevent bypassing login via JavaScript
    if (show === false && !state.isAuthenticated) {
        console.warn('⚠️ Security: Attempted to show dashboard without authentication');
        DOM.loginSection.classList.add('d-flex');
        DOM.loginSection.classList.remove('hidden');
        DOM.dashboardSection.classList.remove('active');
        DOM.logoutBtn.classList.add('hidden');
        DOM.dashboardLink.classList.add('hidden');
        return;
    }

    if (show) {
        DOM.loginSection.classList.add('d-flex');
        DOM.loginSection.classList.remove('hidden');
        DOM.dashboardSection.classList.remove('active');
        DOM.logoutBtn.classList.add('hidden');
        DOM.dashboardLink.classList.add('hidden');
    } else {
        DOM.loginSection.classList.remove('d-flex');
        DOM.loginSection.classList.add('hidden');
        DOM.dashboardSection.classList.add('active');
        DOM.logoutBtn.classList.remove('hidden');
        DOM.dashboardLink.classList.remove('hidden');
    }
}

/**
 * Handle admin logout
 */
async function handleLogout() {
    console.log('🚪 handleLogout() called');
    try {
        console.log('📍 Calling logout endpoint...');
        await apiCall('/api/auth/logout', {
            method: 'POST'
        }).catch((e) => {
            console.warn('⚠️ Logout API call failed:', e);
        });
    } catch (error) {
        console.error('❌ Logout error:', error);
    }

    console.log('🔄 Clearing session state');
    state.isAuthenticated = false;
    state.properties = [];
    state.actionInProgress.clear();
    DOM.secretKey.value = '';
    DOM.loginAlert.innerHTML = '';
    DOM.dashboardAlert.innerHTML = '';
    showLoginUI(true);
    showAlert('loginAlert', '✅ Logged out successfully', 'success');
    console.log('✅ Logout complete');
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) {return '';}
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
