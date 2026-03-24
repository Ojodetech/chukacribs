/**
 * Reviews System - Handle review submission and display
 * Manages 5-star rating, review text, and review display on listings
 */

// Initialize error manager for styled alerts
const errorMgr = typeof ErrorManager !== 'undefined' ? new ErrorManager() : null;

class ReviewsSystem {
  constructor() {
    this.studentToken = localStorage.getItem('studentToken');
    this.apiUrl = `${window.location.protocol}//${window.location.host}/api`;
    this.reviews = {};
    this.init();
  }

  init() {
    this.createReviewStyles();
    this.loadReviews();
    this.attachEventListeners();
  }

  createReviewStyles() {
    if (document.getElementById('reviews-styles')) {return;}

    const style = document.createElement('style');
    style.id = 'reviews-styles';
    style.textContent = `
      /* Review Component Styles */
      .review-section {
        margin-top: 30px;
        padding: 20px;
        background-color: #f8f9fa;
        border-radius: 8px;
        border-left: 4px solid #6366f1;
      }

      .review-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      }

      .review-header h3 {
        margin: 0;
        color: #333;
        font-size: 1.2rem;
      }

      .review-count {
        background-color: #6366f1;
        color: white;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.9rem;
        font-weight: bold;
      }

      .review-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 15px;
        margin-bottom: 25px;
        padding-bottom: 20px;
        border-bottom: 1px solid #ddd;
      }

      .stat-item {
        text-align: center;
      }

      .stat-rating {
        font-size: 2rem;
        font-weight: bold;
        color: #6366f1;
      }

      .stat-label {
        font-size: 0.85rem;
        color: #666;
        margin-top: 5px;
      }

      .rating-bar {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 8px 0;
      }

      .rating-bar-label {
        font-size: 0.9rem;
        color: #666;
        min-width: 30px;
      }

      .rating-bar-fill {
        flex: 1;
        height: 8px;
        background-color: #e0e0e0;
        border-radius: 4px;
        overflow: hidden;
      }

      .rating-bar-value {
        height: 100%;
        background-color: #ffc107;
        border-radius: 4px;
        transition: width 0.3s ease;
      }

      .review-form {
        background-color: white;
        padding: 20px;
        border-radius: 8px;
        margin-bottom: 25px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .review-form h4 {
        margin-top: 0;
        color: #333;
      }

      .form-group {
        margin-bottom: 15px;
      }

      .form-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: 600;
        color: #333;
        font-size: 0.95rem;
      }

      .star-rating {
        display: flex;
        gap: 10px;
        align-items: center;
      }

      .star {
        font-size: 2rem;
        cursor: pointer;
        transition: transform 0.2s, text-shadow 0.2s;
        user-select: none;
      }

      .star:hover,
      .star.active {
        transform: scale(1.2);
        text-shadow: 0 0 10px rgba(255, 193, 7, 0.8);
      }

      .star.inactive {
        color: #ddd;
      }

      .star-value {
        margin-left: 10px;
        font-size: 0.9rem;
        color: #666;
        font-weight: 600;
      }

      .review-form textarea {
        width: 100%;
        min-height: 100px;
        padding: 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 0.95rem;
        resize: vertical;
        transition: border-color 0.3s;
      }

      .review-form textarea:focus {
        outline: none;
        border-color: #6366f1;
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
      }

      .review-form .form-buttons {
        display: flex;
        gap: 10px;
        margin-top: 15px;
      }

      .review-form .submit-btn,
      .review-form .cancel-btn {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.3s;
        font-size: 0.9rem;
      }

      .review-form .submit-btn {
        background-color: #6366f1;
        color: white;
        flex: 1;
      }

      .review-form .submit-btn:hover:not(:disabled) {
        background-color: #4f46e5;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
      }

      .review-form .submit-btn:disabled {
        background-color: #ccc;
        cursor: not-allowed;
      }

      .review-form .cancel-btn {
        background-color: #f0f0f0;
        color: #333;
      }

      .review-form .cancel-btn:hover {
        background-color: #e0e0e0;
      }

      .review-list {
        display: flex;
        flex-direction: column;
        gap: 15px;
      }

      .review-item {
        background-color: white;
        padding: 15px;
        border-radius: 6px;
        border-left: 3px solid #6366f1;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        transition: all 0.3s;
      }

      .review-item:hover {
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
        transform: translateX(4px);
      }

      .review-header-item {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 10px;
      }

      .reviewer-info {
        flex: 1;
      }

      .reviewer-name {
        font-weight: 600;
        color: #333;
        margin-bottom: 4px;
      }

      .review-date {
        font-size: 0.85rem;
        color: #999;
      }

      .review-rating-display {
        font-size: 1rem;
        margin-right: 10px;
      }

      .review-text {
        color: #555;
        line-height: 1.5;
        margin: 10px 0;
        font-size: 0.95rem;
      }

      .review-actions {
        margin-top: 10px;
        display: flex;
        gap: 10px;
        font-size: 0.85rem;
      }

      .review-action-btn {
        background: none;
        border: none;
        color: #6366f1;
        cursor: pointer;
        font-weight: 600;
        transition: color 0.3s;
      }

      .review-action-btn:hover {
        color: #4f46e5;
      }

      .no-reviews {
        text-align: center;
        padding: 30px;
        color: #999;
        background-color: white;
        border-radius: 6px;
      }

      .no-reviews-icon {
        font-size: 3rem;
        margin-bottom: 10px;
      }

      .login-prompt {
        background-color: #fff3cd;
        border: 1px solid #ffc107;
        padding: 15px;
        border-radius: 6px;
        text-align: center;
        color: #856404;
      }

      .login-prompt a {
        color: #856404;
        text-decoration: underline;
        font-weight: 600;
      }

      .review-error {
        background-color: #f8d7da;
        border: 1px solid #f5c6cb;
        color: #721c24;
        padding: 12px;
        border-radius: 6px;
        margin-bottom: 15px;
        display: none;
      }

      .review-error.show {
        display: block;
      }

      .review-success {
        background-color: #d4edda;
        border: 1px solid #c3e6cb;
        color: #155724;
        padding: 12px;
        border-radius: 6px;
        margin-bottom: 15px;
        display: none;
      }

      .review-success.show {
        display: block;
      }

      .review-loading {
        text-align: center;
        padding: 20px;
        color: #666;
      }

      .spinner-small {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid #f3f3f3;
        border-top: 2px solid #6366f1;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-right: 8px;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .expanded-reviews {
        max-height: 1000px;
        overflow: hidden;
      }

      .expand-button {
        background-color: white;
        border: 1px solid #ddd;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        color: #6366f1;
        transition: all 0.3s;
        width: 100%;
        margin-top: 15px;
      }

      .expand-button:hover {
        background-color: #f8f9fa;
        border-color: #6366f1;
      }

      @media (max-width: 768px) {
        .review-stats {
          grid-template-columns: 1fr;
        }

        .star-rating {
          gap: 5px;
        }

        .star {
          font-size: 1.5rem;
        }

        .review-form .form-buttons {
          flex-direction: column;
        }

        .review-form .submit-btn,
        .review-form .cancel-btn {
          width: 100%;
        }
      }
    `;
    document.head.appendChild(style);
  }

  async loadReviews() {
    try {
      const response = await fetch(`${this.apiUrl}/reviews`);
      if (!response.ok) {throw new Error('Failed to load reviews');}

      const data = await response.json();
      if (data.success) {
        data.reviews.forEach(review => {
          if (!this.reviews[review.houseId]) {
            this.reviews[review.houseId] = [];
          }
          this.reviews[review.houseId].push(review);
        });
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    }
  }

  attachEventListeners() {
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('write-review-btn')) {
        this.openReviewForm(e.target.dataset.houseId);
      }
      if (e.target.classList.contains('cancel-review-btn')) {
        this.closeReviewForm();
      }
      if (e.target.classList.contains('submit-review-btn')) {
        this.submitReview();
      }
      if (e.target.classList.contains('view-all-reviews-btn')) {
        this.expandReviews(e.target.dataset.houseId);
      }
      if (e.target.classList.contains('star')) {
        this.setRating(e.target.dataset.rating);
      }
    });
  }

  setRating(rating) {
    const currentRating = parseInt(rating);
    const stars = document.querySelectorAll('.star');

    stars.forEach(star => {
      const starRating = parseInt(star.dataset.rating);
      if (starRating <= currentRating) {
        star.classList.remove('inactive');
        star.classList.add('active');
      } else {
        star.classList.add('inactive');
        star.classList.remove('active');
      }
    });

    const valueDisplay = document.querySelector('.star-value');
    if (valueDisplay) {
      valueDisplay.textContent = `${currentRating}/5`;
    }

    document.getElementById('ratingInput').value = currentRating;
  }

  openReviewForm(houseId) {
    if (!this.studentToken) {
      this.showLoginPrompt();
      return;
    }

    const formContainer = document.getElementById(`review-form-${houseId}`);
    if (!formContainer) {return;}

    formContainer.style.display = 'block';
    formContainer.querySelector('textarea').focus();
    document.getElementById('houseIdInput').value = houseId;

    // Reset form
    document.getElementById('ratingInput').value = 0;
    document.querySelectorAll('.star').forEach(star => {
      star.classList.add('inactive');
      star.classList.remove('active');
    });
    document.querySelector('.star-value').textContent = '0/5';
    document.getElementById('reviewText').value = '';
  }

  closeReviewForm() {
    document.getElementById(`review-form-${document.getElementById('houseIdInput').value}`)
      ?.style.toggle('display');
  }

  async submitReview() {
    if (!this.studentToken) {
      this.showLoginPrompt();
      return;
    }

    const houseId = document.getElementById('houseIdInput').value;
    const rating = parseInt(document.getElementById('ratingInput').value);
    const text = document.getElementById('reviewText').value.trim();

    if (rating === 0) {
      this.showError('Please select a rating');
      return;
    }

    if (text.length < 10) {
      this.showError('Review must be at least 10 characters long');
      return;
    }

    const submitBtn = document.querySelector('.submit-review-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-small"></span>Submitting...';

    try {
      const response = await fetch(`${this.apiUrl}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.studentToken}`
        },
        body: JSON.stringify({ houseId, rating, text })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        this.showSuccess('Review submitted successfully!');
        document.getElementById(`review-form-${houseId}`).style.display = 'none';
        setTimeout(() => location.reload(), 1500);
      } else {
        this.showError(data.message || 'Failed to submit review');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      this.showError('Error submitting review. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Submit Review';
    }
  }

  expandReviews(houseId) {
    const container = document.getElementById(`reviews-container-${houseId}`);
    if (!container) {return;}

    const expanded = container.classList.contains('expanded-reviews');
    container.classList.toggle('expanded-reviews');

    const btn = document.querySelector(`[data-house-id="${houseId}"].view-all-reviews-btn`);
    if (btn) {
      btn.textContent = expanded ? 'View All Reviews' : 'Show Less';
    }
  }

  showLoginPrompt() {
    errorMgr.show('Please log in to submit a review. Redirecting...', 'info', 2000);
    setTimeout(() => {
      window.location.href = '/student-login.html';
    }, 2000);
  }

  showError(message) {
    const errorDiv = document.querySelector('.review-error');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.classList.add('show');
      setTimeout(() => errorDiv.classList.remove('show'), 5000);
    }
  }

  showSuccess(message) {
    const successDiv = document.querySelector('.review-success');
    if (successDiv) {
      successDiv.textContent = message;
      successDiv.classList.add('show');
      setTimeout(() => successDiv.classList.remove('show'), 5000);
    }
  }

  getReviewsForHouse(houseId) {
    return this.reviews[houseId] || [];
  }

  calculateAverageRating(houseId) {
    const houseReviews = this.reviews[houseId] || [];
    if (houseReviews.length === 0) {return 0;}

    const total = houseReviews.reduce((sum, review) => sum + review.rating, 0);
    return (total / houseReviews.length).toFixed(1);
  }

  renderReviewComponent(houseId, containerElement) {
    const houseReviews = this.getReviewsForHouse(houseId);
    const avgRating = this.calculateAverageRating(houseId);
    const reviewCount = houseReviews.length;

    let html = `
      <div class="review-section">
        <div class="review-error"></div>
        <div class="review-success"></div>

        <div class="review-header">
          <h3>⭐ Reviews & Ratings</h3>
          <span class="review-count">${reviewCount} ${reviewCount === 1 ? 'Review' : 'Reviews'}</span>
        </div>
    `;

    if (reviewCount > 0) {
      html += `
        <div class="review-stats">
          <div class="stat-item">
            <div class="stat-rating">${avgRating}</div>
            <div class="stat-label">Average Rating</div>
          </div>
          <div class="stat-item">
            <div class="stat-rating">${reviewCount}</div>
            <div class="stat-label">Total Reviews</div>
          </div>
        </div>
      `;

      // Rating distribution
      const ratingCounts = {};
      for (let i = 1; i <= 5; i++) {
        ratingCounts[i] = houseReviews.filter(r => r.rating === i).length;
      }

      html += '<div style="margin-bottom: 20px;">';
      for (let i = 5; i >= 1; i--) {
        const percentage = (ratingCounts[i] / reviewCount) * 100;
        html += `
          <div class="rating-bar">
            <span class="rating-bar-label">${i}★</span>
            <div class="rating-bar-fill">
              <div class="rating-bar-value" style="width: ${percentage}%"></div>
            </div>
            <span class="rating-bar-label">${ratingCounts[i]}</span>
          </div>
        `;
      }
      html += '</div>';
    }

    // Review form
    html += this.getReviewFormHTML(houseId);

    // Review list
    if (reviewCount === 0) {
      html += `
        <div class="no-reviews">
          <div class="no-reviews-icon">💬</div>
          <p>No reviews yet. Be the first to review this property!</p>
        </div>
      `;
    } else {
      html += `<div class="review-list" id="reviews-container-${houseId}">`;

      const displayLimit = 3;
      houseReviews.slice(0, displayLimit).forEach(review => {
        html += this.getReviewItemHTML(review);
      });

      if (reviewCount > displayLimit) {
        html += `
          <button class="view-all-reviews-btn expand-button" data-house-id="${houseId}">
            View All ${reviewCount} Reviews
          </button>
        `;
      }

      html += '</div>';
    }

    html += '</div>';
    containerElement.innerHTML = html;
  }

  getReviewFormHTML(houseId) {
    const formHTML = `
      <div class="review-form" id="review-form-${houseId}" style="display: none;">
        <h4>Share Your Experience</h4>
        <input type="hidden" id="houseIdInput" value="${houseId}">
        <input type="hidden" id="ratingInput" value="0">

        <div class="form-group">
          <label>Rating</label>
          <div class="star-rating">
            <span class="star inactive" data-rating="1">⭐</span>
            <span class="star inactive" data-rating="2">⭐</span>
            <span class="star inactive" data-rating="3">⭐</span>
            <span class="star inactive" data-rating="4">⭐</span>
            <span class="star inactive" data-rating="5">⭐</span>
            <span class="star-value">0/5</span>
          </div>
        </div>

        <div class="form-group">
          <label for="reviewText">Your Review</label>
          <textarea id="reviewText" placeholder="Share your thoughts about this property..."></textarea>
        </div>

        <div class="form-buttons">
          <button class="submit-review-btn submit-btn">Submit Review</button>
          <button class="cancel-review-btn cancel-btn">Cancel</button>
        </div>
      </div>
    `;

    // Write review button
    return `
      ${formHTML}
      <button class="write-review-btn expand-button" data-house-id="${houseId}">
        ${this.studentToken ? '✍️ Write a Review' : '🔒 Log in to Review'}
      </button>
    `;
  }

  getReviewItemHTML(review) {
    const date = new Date(review.createdAt);
    const dateStr = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    return `
      <div class="review-item">
        <div class="review-header-item">
          <div class="reviewer-info">
            <div class="reviewer-name">${review.studentName || 'Anonymous Student'}</div>
            <div class="review-date">${dateStr}</div>
          </div>
          <div class="review-rating-display">${'⭐'.repeat(review.rating)}</div>
        </div>
        <p class="review-text">${this.escapeHtml(review.text)}</p>
        <div class="review-actions">
          <button class="review-action-btn">👍 Helpful</button>
          <button class="review-action-btn">👎 Not Helpful</button>
        </div>
      </div>
    `;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize reviews system when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ReviewsSystem();
  });
} else {
  new ReviewsSystem();
}
