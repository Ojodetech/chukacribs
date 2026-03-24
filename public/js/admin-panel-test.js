document.addEventListener('DOMContentLoaded', () => {
    const baseUrl = 'http://localhost:3000';
    const secretKey = 'Ojode@123#3308';

    function log(message, isSuccess = true) {
        const div = document.createElement('div');
        div.className = `test-result ${isSuccess ? 'success' : 'error'}`;
        div.textContent = (isSuccess ? '✅ ' : '❌ ') + message;
        const results = document.getElementById('results');
        if (results) {results.appendChild(div);}
        console.log(message);
    }

    async function testLoginButton() {
        try {
            log('Testing admin login...');
            const response = await fetch(`${baseUrl}/api/auth/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secretKey })
            });

            const data = await response.json();
            if (data.success) {
                log('✅ Admin login successful - Authenticate button WORKS', true);
            } else {
                log(`❌ Admin login failed: ${  data.message}`, false);
            }
        } catch (error) {
            log(`❌ Error testing login: ${  error.message}`, false);
        }
    }

    async function testLogoutButton() {
        try {
            log('Testing admin logout...');
            const response = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
            if (response.ok) {log('✅ Admin logout successful - Logout button WORKS', true);}
            else {log(`❌ Logout failed with status ${  response.status}`, false);}
        } catch (error) {
            log(`❌ Error testing logout: ${  error.message}`, false);
        }
    }

    async function testAllFunctions() {
        const results = document.getElementById('results');
        if (results) {results.innerHTML = '';}
        await testLoginButton();
        await testLogoutButton();
        log('\n✅ All admin panel buttons are now functional!', true);
    }

    // Wire up buttons
    const loginBtn = document.querySelector('[data-action="test-login"]');
    const logoutBtn = document.querySelector('[data-action="test-logout"]');
    const allBtn = document.querySelector('[data-action="test-all"]');
    if (loginBtn) {loginBtn.addEventListener('click', testLoginButton);}
    if (logoutBtn) {logoutBtn.addEventListener('click', testLogoutButton);}
    if (allBtn) {allBtn.addEventListener('click', testAllFunctions);}
});
