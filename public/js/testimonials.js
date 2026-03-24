document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('testimonialsContainer');
  if (!container) return;

  try {
    const res = await fetch('/api/feedback/approved');
    if (!res.ok) return;
    const data = await res.json();
    const reviews = data.reviews || [];

    container.innerHTML = reviews.map(r => `
      <div class="testimonial-card">
        <div class="testimonial-header">
          <strong>${escapeHtml(r.name)}</strong>
          ${r.rating ? `<span class="rating">${r.rating}/5</span>` : ''}
        </div>
        <p class="testimonial-message">${escapeHtml(r.message)}</p>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading testimonials', err);
  }

  function escapeHtml(text) {
    const div = document.createElement('div'); div.textContent = text; return div.innerHTML;
  }
});
