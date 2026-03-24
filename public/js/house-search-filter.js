// Enhanced Search & Filtering for House Listings
class HouseSearchFilter {
  constructor() {
    this.allHouses = [];
    this.filteredHouses = [];
    this.init();
  }

  init() {
    this.cacheElements();
    this.attachEventListeners();
    this.loadHouses();
  }

  cacheElements() {
    this.searchInput = document.getElementById('searchInput');
    this.priceFilter = document.getElementById('priceFilter');
    this.typeFilter = document.getElementById('typeFilter');
    this.sortSelect = document.getElementById('sortSelect');
    this.listingsContainer = document.getElementById('listingsContainer');
    this.noListings = document.getElementById('noListings');
    this.resultsCount = document.getElementById('resultsCount');
    this.searchBtn = document.querySelector('.search-btn');
  }

  attachEventListeners() {
    this.searchInput?.addEventListener('input', () => this.applyFilters());
    this.searchInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {this.applyFilters();}
    });
    this.priceFilter?.addEventListener('change', () => this.applyFilters());
    this.typeFilter?.addEventListener('change', () => this.applyFilters());
    this.sortSelect?.addEventListener('change', () => this.applySorting());
    this.searchBtn?.addEventListener('click', () => this.applyFilters());
  }

  async loadHouses() {
    try {
      const response = await fetch('/api/houses');
      if (!response.ok) {throw new Error('Failed to fetch houses');}
      this.allHouses = await response.json();
      this.filteredHouses = [...this.allHouses];
      this.render();
    } catch (err) {
      console.error('Error loading houses:', err);
      this.listingsContainer.innerHTML = '<p class="error">Failed to load listings</p>';
    }
  }

  applyFilters() {
    const searchTerm = this.searchInput?.value.toLowerCase() || '';
    const priceRange = this.priceFilter?.value || '';
    const type = this.typeFilter?.value || '';

    this.filteredHouses = this.allHouses.filter(house => {
      // Search filter
      const matchesSearch =
        !searchTerm ||
        house.title?.toLowerCase().includes(searchTerm) ||
        house.location?.toLowerCase().includes(searchTerm) ||
        house.description?.toLowerCase().includes(searchTerm) ||
        house.amenities?.some(a => a.toLowerCase().includes(searchTerm));

      // Price filter
      let matchesPrice = true;
      if (priceRange) {
        const price = house.price || 0;
        if (priceRange === '0-5000') {matchesPrice = price <= 5000;}
        else if (priceRange === '5000-10000') {matchesPrice = price >= 5000 && price <= 10000;}
        else if (priceRange === '10000-20000') {matchesPrice = price >= 10000 && price <= 20000;}
        else if (priceRange === '20000+') {matchesPrice = price >= 20000;}
      }

      // Type filter
      const matchesType = !type || house.type === type;

      return matchesSearch && matchesPrice && matchesType;
    });

    this.applySorting();
  }

  applySorting() {
    const sortBy = this.sortSelect?.value || 'newest';

    switch (sortBy) {
      case 'price-low':
        this.filteredHouses.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'price-high':
        this.filteredHouses.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'rating':
        this.filteredHouses.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
        break;
      case 'newest':
      default:
        this.filteredHouses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    this.render();
  }

  render() {
    if (this.filteredHouses.length === 0) {
      this.listingsContainer.innerHTML = '';
      this.noListings?.classList.remove('hidden');
      if (this.resultsCount) {this.resultsCount.textContent = '0 results';}
      return;
    }

    this.noListings?.classList.add('hidden');
    if (this.resultsCount) {this.resultsCount.textContent = `${this.filteredHouses.length} result${this.filteredHouses.length !== 1 ? 's' : ''}`;}

    this.listingsContainer.innerHTML = this.filteredHouses
      .map(house => this.createHouseCard(house))
      .join('');

    this.attachCardListeners();
  }

  createHouseCard(house) {
    const image = house.images?.[0] || '/images/placeholder.jpg';
    const rating = house.averageRating ? house.averageRating.toFixed(1) : 'N/A';
    const reviewCount = house.reviewCount || 0;
    const amenitiesDisplay = house.amenities?.slice(0, 3).join(', ') || 'No amenities listed';

    return `
      <div class="house-card" data-id="${house._id}">
        <div class="house-image">
          <img src="${image}" alt="${house.title}" loading="lazy">
          <span class="house-badge">${house.type || 'Room'}</span>
        </div>
        <div class="house-info">
          <h3 class="house-title">${house.title || 'Untitled'}</h3>
          <p class="house-location">📍 ${house.location || 'Location not specified'}</p>
          <p class="house-price">💰 ${house.price ? house.price.toLocaleString() : '0'} KSH/month</p>
          <div class="house-rating">
            <span class="stars">${this.renderStars(rating)}</span>
            <span class="rating-text">${rating} (${reviewCount} reviews)</span>
          </div>
          <p class="house-amenities">${amenitiesDisplay}</p>
          <div class="house-actions">
            <button class="view-btn" data-id="${house._id}">View Details</button>
            <button class="book-btn" data-id="${house._id}">Book Now</button>
          </div>
        </div>
      </div>
    `;
  }

  renderStars(rating) {
    if (rating === 'N/A') {return '⭐ No ratings yet';}
    const stars = Math.round(rating);
    return '⭐'.repeat(Math.min(stars, 5));
  }

  attachCardListeners() {
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const houseId = e.target.dataset.id;
        window.location.href = `/listings/${houseId}`;
      });
    });

    document.querySelectorAll('.book-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const houseId = e.target.dataset.id;
        // For now, redirect to listings page with booking intent
        window.location.href = `/listings/${houseId}?book=true`;
      });
    });
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  new HouseSearchFilter();
});
