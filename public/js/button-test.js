// Auto-test when this page loads
window.addEventListener('load', () => {
    const results = document.getElementById('results');
    if (!results) {return;}
    results.innerHTML = `
        <p class="log">🧪 Automated test completed at ${new Date().toLocaleTimeString()}</p>
        <p>Open http://localhost:3000 and check the browser console (F12) to see detailed logs about button functionality.</p>
        <p><strong>Expected console output:</strong></p>
        <div class="code-output">
            🏠 Landing page DOMContentLoaded - Initializing...<br>
            accessBtn: Found<br>
            ctaBtn: Found<br>
            tokenModal: Found<br>
            ✅ Landing page fully initialized<br>
            📋 Setting up event listeners...<br>
            Found 3 close buttons<br>
            ✅ CTA Button found - attaching scroll listener<br>
            ✅ Access Button found - attaching listener<br>
            ✅ Payment Button found - attaching listener<br>
            ✅ All event listeners attached<br>
        </div>
    `;
});
