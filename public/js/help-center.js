document.addEventListener('DOMContentLoaded', () => {
    // Toggle FAQ items
    function toggleFaqElement(questionEl) {
        const faqItem = questionEl.parentElement;
        const answer = faqItem.querySelector('.faq-answer');

        // Close other open FAQs
        document.querySelectorAll('.faq-answer.active').forEach(item => {
            if (item !== answer) {
                item.classList.remove('active');
                const prevQ = item.previousElementSibling;
                if (prevQ) {prevQ.classList.remove('active');}
            }
        });

        // Toggle current FAQ
        if (answer) {answer.classList.toggle('active');}
        questionEl.classList.toggle('active');
    }

    // Wire up FAQ click handlers
    document.querySelectorAll('.faq-question[data-action="toggle-faq"]').forEach(q => {
        q.addEventListener('click', () => toggleFaqElement(q));
    });

    // Tabs
    function switchTab(tabName, clickedBtn) {
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        const target = document.getElementById(tabName);
        if (target) {target.classList.add('active');}
        if (clickedBtn) {clickedBtn.classList.add('active');}
    }

    document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const name = btn.getAttribute('data-tab');
            switchTab(name, btn);
        });
    });

    // Search functionality (use class toggles instead of inline style)
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const faqItems = document.querySelectorAll('.faq-item');

            faqItems.forEach(item => {
                const q = item.querySelector('.faq-question span');
                const a = item.querySelector('.faq-answer');
                const question = q ? q.textContent.toLowerCase() : '';
                const answer = a ? a.textContent.toLowerCase() : '';

                if (question.includes(searchTerm) || answer.includes(searchTerm)) {
                    item.classList.remove('hidden');
                } else {
                    item.classList.add('hidden');
                }
            });
        });
    }
});
