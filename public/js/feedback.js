document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('feedbackForm');
  const loader = new LoadingManager();
  const errorMgr = new ErrorManager();
  const msgEl = document.getElementById('feedbackMessage');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const message = document.getElementById('message').value.trim();
    const rating = document.getElementById('rating').value || undefined;

    if (!name || !email || !message) {
      errorMgr.show('Please fill all required fields', 'error');
      return;
    }

    loader.showButtonLoading(form.querySelector('button'));
    loader.show('Sending feedback...');

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message, rating })
      });
      const data = await res.json();
      loader.hide();
      loader.hideButtonLoading(form.querySelector('button'));

      if (!res.ok) {
        const err = data?.errors?.map(e => e.msg).join(', ') || data.message || 'Failed to send feedback';
        errorMgr.show(err, 'error');
        return;
      }

      errorMgr.show(data.message || 'Feedback sent', 'success');
      form.reset();
      msgEl.textContent = 'Thanks — your feedback will appear after admin approval.';
    } catch (err) {
      loader.hide();
      loader.hideButtonLoading(form.querySelector('button'));
      console.error(err);
      errorMgr.show('Network error sending feedback', 'error');
    }
  });
});
