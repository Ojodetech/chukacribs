/**
 * Test cookie flow for admin authentication
 */

const http = require('http');

// Step 1: Login request
function testLogin() {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ secretKey: 'Ojode@123#3308' });
        
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/auth/admin/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            
            console.log('\n=== LOGIN REQUEST ===');
            console.log(`Status: ${res.statusCode}`);
            console.log('Response Headers:', res.headers);
            
            // Check for Set-Cookie header
            if (res.headers['set-cookie']) {
                console.log('✅ Set-Cookie found:', res.headers['set-cookie']);
            } else {
                console.log('❌ No Set-Cookie header!');
            }
            
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                console.log('Response Body:', data);
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: JSON.parse(data)
                });
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// Step 2: Verify admin endpoint with cookie
function testVerifyAdmin(cookie) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/auth/me/admin',
            method: 'GET',
            headers: {
                'Cookie': cookie
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            
            console.log('\n=== VERIFY ADMIN REQUEST ===');
            console.log(`Status: ${res.statusCode}`);
            console.log('Request Headers:', options.headers);
            
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                console.log('Response Body:', data);
                resolve({
                    statusCode: res.statusCode,
                    body: JSON.parse(data)
                });
            });
        });

        req.on('error', reject);
        req.end();
    });
}

// Run tests
async function runTests() {
    try {
        console.log('🧪 Testing admin cookie flow...\n');
        
        // Step 1: Login
        const loginRes = await testLogin();
        
        if (loginRes.statusCode !== 200) {
            console.log('❌ Login failed!');
            return;
        }
        
        // Extract cookie from Set-Cookie header
        let cookie = '';
        if (loginRes.headers['set-cookie']) {
            cookie = loginRes.headers['set-cookie'][0].split(';')[0];
            console.log('\n🍪 Extracted cookie:', cookie);
        } else {
            console.log('\n❌ No cookie returned from login!');
            return;
        }
        
        // Step 2: Verify with cookie
        const verifyRes = await testVerifyAdmin(cookie);
        
        if (verifyRes.statusCode === 200) {
            console.log('\n✅ SUCCESS: Cookie authentication working!');
            console.log('Admin verified:', verifyRes.body);
        } else {
            console.log('\n❌ FAILURE: Cookie authentication failed!');
            console.log('Status:', verifyRes.statusCode);
            console.log('Response:', verifyRes.body);
        }
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

runTests();
