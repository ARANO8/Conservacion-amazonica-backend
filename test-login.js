async function testLogin() {
    const loginUrl = 'http://localhost:3000/auth/login';

    console.log('🧪 Testing Login Flow...\n');

    // 1. Invalid Credentials
    console.log('1. Trying Invalid Credentials...');
    try {
        const res = await fetch(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'bad@email.com', password: 'wrong' })
        });

        if (res.status === 401) {
            console.log('✅ Correctly rejected (401 Unauthorized)');
        } else {
            console.log('❌ Failed: Expected 401, got', res.status);
        }
    } catch (e) { console.error('Error connecting:', e.message); }

    console.log('-----------------------------------');

    // 2. Validation Check
    console.log('2. Trying Validation (Empty password)...');
    try {
        const res = await fetch(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test@valid.com', password: '' })
        });

        if (res.status === 400) {
            const data = await res.json();
            console.log('✅ Correctly rejected (400 Bad Request)');
            console.log('   Errors:', JSON.stringify(data.message));
        } else {
            console.log('❌ Failed: Expected 400, got', res.status);
        }
    } catch (e) { console.error('Error connecting:', e.message); }

    console.log('-----------------------------------');

    // 3. Valid Credentials
    console.log('3. Trying Valid Credentials (m.fernando@aceaa.org / 123456)...');
    try {
        const res = await fetch(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'm.fernando@aceaa.org', password: '123456' })
        });

        if (res.ok) {
            const data = await res.json();
            console.log('✅ LOGIN SUCCESSFUL!');
            console.log('   Access Token:', data.accessToken ? 'Present' : 'Missing');
            console.log('   User Role:', data.user?.role);
            console.log('   User Email:', data.user?.email);
        } else {
            console.log('❌ Login Failed:', res.status, res.statusText);
            // const text = await res.text();
            // console.log('   Response:', text);
        }
    } catch (e) { console.error('Error connecting:', e.message); }
}

testLogin();
