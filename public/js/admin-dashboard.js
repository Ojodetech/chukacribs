/**
 * Admin Dashboard - Complete Dashboard with multiple sections
 * Features: Properties, Users, Bookings, Analytics, Overview
 */

// Initialize error manager for styled alerts
const errorMgr = typeof ErrorManager !== 'undefined' ? new ErrorManager() : null;

class AdminDashboard {
  constructor() {
    this.apiUrl = `${window.location.protocol}//${window.location.host}/api`;
    this.adminToken = localStorage.getItem('adminToken');
    this.currentTab = 'overview';
    this.data = {
      properties: [],
      users: [],
      bookings: [],
      stats: {}
    };
    this.init();
  }

  init() {
    if (!this.adminToken) {
      console.log('No admin token, using legacy admin panel');
      this.initLegacyDashboard();
      return;
    }

    this.createDashboardStyles();
    this.createDashboardHTML();
    this.loadDashboardData();
    this.attachEventListeners();
  }

  initLegacyDashboard() {
    // Keep legacy functionality for backward compatibility
    window.showMessage = (message, type = 'info') => {
      const container = document.getElementById('messageContainer');
      if (!container) {return;}
      const messageEl = document.createElement('div');
      messageEl.className = `message ${type}`;
      messageEl.textContent = message;
      container.appendChild(messageEl);
      setTimeout(() => messageEl.remove(), 4000);
    };
    this.loadLegacyStats();
  }

  async loadLegacyStats() {
    try {
      const propertiesRes = await fetch('/api/houses/admin/pending', { 
        method: 'GET',
        credentials: 'include'
      });
      if (propertiesRes.ok) {
        const data = await propertiesRes.json();
        const pendingEl = document.getElementById('pendingCount');
        if (pendingEl) {pendingEl.textContent = data.houses ? data.houses.length : 0;}
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  createDashboardStyles() {
    if (document.getElementById('admin-dashboard-styles')) {return;}

    const style = document.createElement('style');
    style.id = 'admin-dashboard-styles';
    style.textContent = `
      /* Admin Dashboard Styles */
      .admin-dashboard-wrapper {
        display: grid;
        grid-template-columns: 250px 1fr;
        gap: 0;
        min-height: 100vh;
        background-color: #f5f5f5;
      }

      .admin-sidebar {
        background-color: #2c3e50;
        color: white;
        padding: 20px;
        position: fixed;
        left: 0;
        top: 0;
        height: 100vh;
        width: 250px;
        overflow-y: auto;
        box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
      }

      .admin-sidebar-header {
        padding-bottom: 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        margin-bottom: 20px;
      }

      .admin-sidebar-title {
        font-size: 1.3rem;
        font-weight: bold;
        margin: 0;
        color: #6366f1;
      }

      .admin-sidebar-nav {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .sidebar-nav-item {
        padding: 12px 15px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.3s;
        border-left: 3px solid transparent;
        color: rgba(255, 255, 255, 0.7);
        font-weight: 500;
      }

      .sidebar-nav-item:hover {
        background-color: rgba(255, 255, 255, 0.1);
        color: white;
      }

      .sidebar-nav-item.active {
        background-color: #6366f1;
        color: white;
        border-left-color: #fff;
      }

      .admin-main {
        margin-left: 250px;
        padding: 30px;
      }

      .admin-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30px;
        background-color: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .admin-header h1 {
        margin: 0;
        color: #2c3e50;
        font-size: 1.8rem;
      }

      .admin-stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin-bottom: 30px;
      }

      .stat-card {
        background-color: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        border-left: 4px solid #6366f1;
        transition: all 0.3s;
      }

      .stat-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      .stat-label {
        font-size: 0.9rem;
        color: #666;
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .stat-value {
        font-size: 2.5rem;
        font-weight: bold;
        color: #2c3e50;
      }

      .admin-section {
        background-color: white;
        padding: 25px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        display: none;
      }

      .admin-section.active {
        display: block;
      }

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 25px;
        padding-bottom: 15px;
        border-bottom: 2px solid #f0f0f0;
      }

      .section-header h2 {
        margin: 0;
        color: #2c3e50;
      }

      .admin-table {
        width: 100%;
        border-collapse: collapse;
      }

      .admin-table thead {
        background-color: #f8f9fa;
        border-bottom: 2px solid #dee2e6;
      }

      .admin-table th {
        padding: 12px;
        text-align: left;
        font-weight: 600;
        color: #2c3e50;
        font-size: 0.9rem;
        text-transform: uppercase;
      }

      .admin-table td {
        padding: 15px 12px;
        border-bottom: 1px solid #dee2e6;
        color: #555;
      }

      .admin-table tbody tr:hover {
        background-color: #f8f9fa;
      }

      .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.85rem;
        font-weight: 600;
      }

      .status-pending {
        background-color: #fff3cd;
        color: #856404;
      }

      .status-approved {
        background-color: #d4edda;
        color: #155724;
      }

      .status-rejected {
        background-color: #f8d7da;
        color: #721c24;
      }

      @media (max-width: 768px) {
        .admin-dashboard-wrapper {
          grid-template-columns: 1fr;
        }

        .admin-sidebar {
          position: relative;
          width: 100%;
          height: auto;
        }

        .admin-main {
          margin-left: 0;
        }

        .admin-stats-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
    `;
    document.head.appendChild(style);
  }

  createDashboardHTML() {
    const dashboardSection = document.getElementById('dashboardSection');
    if (!dashboardSection) {return;}

    dashboardSection.innerHTML = `
      <div class="admin-dashboard-wrapper">
        <!-- Sidebar -->
        <aside class="admin-sidebar">
          <div class="admin-sidebar-header">
            <h3 class="admin-sidebar-title">📊 Dashboard</h3>
          </div>
          <nav class="admin-sidebar-nav">
            <div class="sidebar-nav-item active" data-tab="overview">
              📈 Overview
            </div>
            <div class="sidebar-nav-item" data-tab="properties">
              🏠 Properties
            </div>
            <div class="sidebar-nav-item" data-tab="users">
              👥 Users
            </div>
            <div class="sidebar-nav-item" data-tab="bookings">
              📅 Bookings
            </div>
            <div class="sidebar-nav-item" data-tab="feedback">
              📝 Feedback
            </div>
          </nav>
        </aside>

        <!-- Main Content -->
        <div class="admin-main">
          <div class="admin-header">
            <h1 id="sectionTitle">📈 Overview</h1>
          </div>

          <!-- Overview Tab -->
          <div class="admin-section active" data-section="overview">
            <div class="admin-stats-grid" id="statsGrid"></div>
          </div>

          <!-- Properties Tab -->
          <div class="admin-section" data-section="properties">
            <div class="section-header">
              <h2>🏠 Property Management</h2>
            </div>
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Location</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="propertiesTable"></tbody>
            </table>
          </div>

          <!-- Users Tab -->
          <div class="admin-section" data-section="users">
            <div class="section-header">
              <h2>👥 User Management</h2>
            </div>
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Type</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody id="usersTable"></tbody>
            </table>
          </div>

          <!-- Bookings Tab -->
          <div class="admin-section" data-section="bookings">
            <div class="section-header">
              <h2>📅 Booking Management</h2>
            </div>
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Property</th>
                  <th>Check-in</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody id="bookingsTable"></tbody>
            </table>
          </div>
          <!-- Feedback Tab -->
          <div class="admin-section" data-section="feedback">
            <div class="section-header">
              <h2>📝 Site Feedback</h2>
            </div>
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Message</th>
                  <th>Rating</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="feedbackTable"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  async loadDashboardData() {
    try {
      const [propertiesRes, usersRes, bookingsRes, feedbackRes] = await Promise.all([
        fetch(`${this.apiUrl}/admin/properties`, {
          headers: { 'Authorization': `Bearer ${this.adminToken}` }
        }).catch(() => ({ ok: false })),
        fetch(`${this.apiUrl}/admin/users`, {
          headers: { 'Authorization': `Bearer ${this.adminToken}` }
        }).catch(() => ({ ok: false })),
        fetch(`${this.apiUrl}/admin/bookings`, {
          headers: { 'Authorization': `Bearer ${this.adminToken}` }
        }).catch(() => ({ ok: false }))
        , fetch(`${this.apiUrl}/feedback/pending`, {
          headers: { 'Authorization': `Bearer ${this.adminToken}` }
        }).catch(() => ({ ok: false }))
      ]);

      if (propertiesRes.ok) {
        const data = await propertiesRes.json();
        this.data.properties = data.properties || [];
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        this.data.users = data.users || [];
      }

      if (bookingsRes.ok) {
        const data = await bookingsRes.json();
        this.data.bookings = data.bookings || [];
      }

      if (feedbackRes && feedbackRes.ok) {
        const data = await feedbackRes.json();
        this.data.feedback = data.reviews || [];
      }

      this.calculateStats();
      this.renderOverview();
      this.renderProperties();
      this.renderUsers();
      this.renderBookings();
      this.renderFeedback();
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  }

  calculateStats() {
    this.data.stats = {
      totalProperties: this.data.properties.length,
      pendingProperties: this.data.properties.filter(p => p.status === 'pending').length,
      approvedProperties: this.data.properties.filter(p => p.status === 'approved').length,
      totalUsers: this.data.users.length,
      totalBookings: this.data.bookings.length
    };
  }

  renderOverview() {
    const statsGrid = document.getElementById('statsGrid');
    if (!statsGrid) {return;}

    const stats = [
      { label: 'Total Properties', value: this.data.stats.totalProperties, icon: '🏠' },
      { label: 'Pending Review', value: this.data.stats.pendingProperties, icon: '⏳' },
      { label: 'Approved', value: this.data.stats.approvedProperties, icon: '✅' },
      { label: 'Total Users', value: this.data.stats.totalUsers, icon: '👥' },
      { label: 'Total Bookings', value: this.data.stats.totalBookings, icon: '📅' }
    ];

    statsGrid.innerHTML = stats.map(stat => `
      <div class="stat-card">
        <div style="font-size: 2rem; margin-bottom: 10px;">${stat.icon}</div>
        <div class="stat-label">${stat.label}</div>
        <div class="stat-value">${stat.value}</div>
      </div>
    `).join('');
  }

  renderProperties() {
    const tbody = document.getElementById('propertiesTable');
    if (!tbody) {return;}

    tbody.innerHTML = this.data.properties.slice(0, 10).map(prop => `
      <tr>
        <td>${prop.title || 'N/A'}</td>
        <td>${prop.location || 'N/A'}</td>
        <td>KSH ${(prop.price || 0).toLocaleString()}</td>
        <td><span class="status-badge status-${prop.status || 'pending'}">${prop.status || 'pending'}</span></td>
        <td><button style="padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; background-color: #6366f1; color: white;">View</button></td>
      </tr>
    `).join('') || '<tr><td colspan="5" style="text-align: center; padding: 40px;">No properties found</td></tr>';
  }

  renderUsers() {
    const tbody = document.getElementById('usersTable');
    if (!tbody) {return;}

    tbody.innerHTML = this.data.users.slice(0, 10).map(user => `
      <tr>
        <td>${user.name || 'N/A'}</td>
        <td>${user.email || 'N/A'}</td>
        <td>${user.role === 'student' ? '🎓 Student' : '🏢 Landlord'}</td>
        <td>${new Date(user.createdAt || Date.now()).toLocaleDateString()}</td>
      </tr>
    `).join('') || '<tr><td colspan="4" style="text-align: center; padding: 40px;">No users found</td></tr>';
  }

  renderBookings() {
    const tbody = document.getElementById('bookingsTable');
    if (!tbody) {return;}

    tbody.innerHTML = this.data.bookings.slice(0, 10).map(booking => `
      <tr>
        <td>${booking.studentName || 'N/A'}</td>
        <td>${booking.houseTitle || 'N/A'}</td>
        <td>${new Date(booking.checkInDate || Date.now()).toLocaleDateString()}</td>
        <td><span class="status-badge status-${booking.status || 'pending'}">${booking.status || 'pending'}</span></td>
        <td>KSH ${(booking.amount || 0).toLocaleString()}</td>
      </tr>
    `).join('') || '<tr><td colspan="5" style="text-align: center; padding: 40px;">No bookings found</td></tr>';
  }

  renderFeedback() {
    const tbody = document.getElementById('feedbackTable');
    if (!tbody) return;

    const list = (this.data.feedback || []).slice(0, 50);
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px">No pending feedback</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(item => `
      <tr>
        <td>${item.name || 'N/A'}</td>
        <td>${item.email || 'N/A'}</td>
        <td>${(item.message || '').slice(0, 120)}</td>
        <td>${item.rating || '-'}</td>
        <td>${new Date(item.createdAt).toLocaleString()}</td>
        <td>
          <button class="approve-btn" data-id="${item._id}" style="margin-right:8px;background:#10b981;color:#fff;border:none;padding:6px 10px;border-radius:4px;cursor:pointer">Approve</button>
          <button class="reject-btn" data-id="${item._id}" style="background:#ef4444;color:#fff;border:none;padding:6px 10px;border-radius:4px;cursor:pointer">Reject</button>
        </td>
      </tr>
    `).join('');

    // attach actions
    document.querySelectorAll('.approve-btn').forEach(b => {
      b.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        try {
          const res = await fetch(`${this.apiUrl}/feedback/${id}/approve`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${this.adminToken}` } });
          if (res.ok) {
            e.target.textContent = 'Approved';
            e.target.disabled = true;
            this.loadDashboardData();
          }
        } catch (err) { console.error(err); }
      });
    });

    document.querySelectorAll('.reject-btn').forEach(b => {
      b.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        try {
          const res = await fetch(`${this.apiUrl}/feedback/${id}/reject`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${this.adminToken}` } });
          if (res.ok) {
            e.target.textContent = 'Rejected';
            e.target.disabled = true;
            this.loadDashboardData();
          }
        } catch (err) { console.error(err); }
      });
    });
  }

  attachEventListeners() {
    // Tab navigation
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab;
        
        // Update sidebar
        document.querySelectorAll('.sidebar-nav-item').forEach(i => {
          i.classList.toggle('active', i === e.target);
        });

        // Update sections
        document.querySelectorAll('.admin-section').forEach(section => {
          section.classList.toggle('active', section.dataset.section === tab);
        });

        // Update header
        const titles = {
          'overview': '📈 Overview',
          'properties': '🏠 Properties',
          'users': '👥 Users',
          'bookings': '📅 Bookings',
          'feedback': '📝 Site Feedback'
        };
        document.getElementById('sectionTitle').textContent = titles[tab] || 'Dashboard';
      });
    });
  }
}

// Initialize dashboard when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.adminDash = new AdminDashboard();
  });
} else {
  window.adminDash = new AdminDashboard();
}

// Keep legacy functions for backward compatibility
function goToPropertyPanel() { window.location.href = '/admin-panel.html'; }
function viewStatistics() { errorMgr.show('📊 Statistics feature coming soon!', 'info'); }
function openSettings() { errorMgr.show('⚙️ Settings feature coming soon!', 'info'); }
function redirect(url) { window.location.href = url; }
function showMessage(message, type = 'info') { if (errorMgr) errorMgr.show(message, type); else console.log(message); }

