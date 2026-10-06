const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const jwt = require('jsonwebtoken');
const db = require('./config/database');
const { JWT_SECRET } = require('./middleware/auth');

const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const providerRoutes = require('./routes/providerRoutes');
const adminRoutes = require('./routes/adminRoutes');

function buildMultipartBody(boundary, fieldName, filename, contentType, buffer) {
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;
  return Buffer.concat([
    Buffer.from(header, 'utf8'),
    buffer,
    Buffer.from(footer, 'utf8')
  ]);
}

async function testFullFlow() {
  console.log('=== FULL END-TO-END PROFILE PHOTO API TEST ===\n');

  await db.init();

  const baseUrl = 'http://127.0.0.1:5173';
  const server = { close: () => {} };

  try {
    const customerUser = db.prepare(`SELECT u.id, u.email, u.role, c.id as profile_id FROM users u JOIN customer_profiles c ON c.user_id = u.id WHERE u.role = 'CUSTOMER' LIMIT 1`).get();
    const providerUser = db.prepare(`SELECT u.id, u.email, u.role, p.id as profile_id FROM users u JOIN provider_profiles p ON p.user_id = u.id WHERE u.role = 'PROVIDER' LIMIT 1`).get();
    const adminUser = db.prepare(`SELECT u.id, u.email, u.role FROM users u WHERE u.role = 'ADMIN' LIMIT 1`).get();

    if (!customerUser || !providerUser || !adminUser) {
      throw new Error('Database is missing seed users.');
    }

    console.log(`Testing with:\n - Customer: ${customerUser.email}\n - Provider: ${providerUser.email}\n - Admin: ${adminUser.email}\n`);

    // Create a dummy test image buffer (tiny 1x1 PNG)
    const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

    // TEST 1: Customer Upload
    {
      const token = jwt.sign({ id: customerUser.id, email: customerUser.email, role: 'CUSTOMER' }, JWT_SECRET, { expiresIn: '1h' });
      const payload = buildMultipartBody(boundary, 'photo', 'customer-pic.png', 'image/png', pngBuffer);

      const uploadRes = await new Promise((resolve, reject) => {
        const req = http.request(`${baseUrl}/api/customer/profile/photo`, {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': payload.length,
            'Authorization': `Bearer ${token}`
          }
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
      });

      console.log('Customer Upload Response:', uploadRes.status, uploadRes.body.success, uploadRes.body.photo_url);
      if (uploadRes.status !== 200 || !uploadRes.body.photo_url) {
        throw new Error('Customer upload failed: ' + JSON.stringify(uploadRes.body));
      }
      console.log('✔ Customer Profile Photo uploaded and saved successfully.');

      // Check /api/customer/profile
      const getRes = await new Promise((resolve, reject) => {
        const req = http.request(`${baseUrl}/api/customer/profile`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
        });
        req.on('error', reject);
        req.end();
      });

      if (!getRes.body.profile?.profile_photo || !getRes.body.user?.profile_photo) {
        throw new Error('Customer GET /profile did not return updated profile_photo');
      }
      console.log('✔ Customer GET /profile returns updated profile_photo:', getRes.body.profile.profile_photo);
    }

    // TEST 2: Provider Upload
    {
      const token = jwt.sign({ id: providerUser.id, email: providerUser.email, role: 'PROVIDER' }, JWT_SECRET, { expiresIn: '1h' });
      const payload = buildMultipartBody(boundary, 'photo', 'provider-kitchen.png', 'image/png', pngBuffer);

      const uploadRes = await new Promise((resolve, reject) => {
        const req = http.request(`${baseUrl}/api/provider/profile/photo`, {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': payload.length,
            'Authorization': `Bearer ${token}`
          }
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
      });

      console.log('Provider Upload Response:', uploadRes.status, uploadRes.body.success, uploadRes.body.photo_url);
      if (uploadRes.status !== 200 || !uploadRes.body.photo_url) {
        throw new Error('Provider upload failed: ' + JSON.stringify(uploadRes.body));
      }
      console.log('✔ Provider Profile Photo uploaded and saved successfully.');

      // Check /api/provider/profile
      const getRes = await new Promise((resolve, reject) => {
        const req = http.request(`${baseUrl}/api/provider/profile`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
        });
        req.on('error', reject);
        req.end();
      });

      if (!getRes.body.profile?.profile_photo || !getRes.body.user?.profile_photo) {
        throw new Error('Provider GET /profile did not return updated profile_photo');
      }
      console.log('✔ Provider GET /profile returns updated profile_photo:', getRes.body.profile.profile_photo);
    }

    // TEST 3: Admin Upload
    {
      const token = jwt.sign({ id: adminUser.id, email: adminUser.email, role: 'ADMIN' }, JWT_SECRET, { expiresIn: '1h' });
      const payload = buildMultipartBody(boundary, 'photo', 'admin-avatar.png', 'image/png', pngBuffer);

      const uploadRes = await new Promise((resolve, reject) => {
        const req = http.request(`${baseUrl}/api/admin/profile/photo`, {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': payload.length,
            'Authorization': `Bearer ${token}`
          }
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
      });

      console.log('Admin Upload Response:', uploadRes.status, uploadRes.body.success, uploadRes.body.photo_url);
      if (uploadRes.status !== 200 || !uploadRes.body.photo_url) {
        throw new Error('Admin upload failed: ' + JSON.stringify(uploadRes.body));
      }
      console.log('✔ Admin Profile Photo uploaded and saved successfully.');

      // Check /api/admin/profile
      const getRes = await new Promise((resolve, reject) => {
        const req = http.request(`${baseUrl}/api/admin/profile`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
        });
        req.on('error', reject);
        req.end();
      });

      if (!getRes.body.user?.profile_photo) {
        throw new Error('Admin GET /profile did not return updated profile_photo');
      }
      console.log('✔ Admin GET /profile returns updated profile_photo:', getRes.body.user.profile_photo);
    }

    // TEST 4: Check /api/auth/me returns profile_photo
    {
      const token = jwt.sign({ id: customerUser.id, email: customerUser.email, role: 'CUSTOMER' }, JWT_SECRET, { expiresIn: '1h' });
      const meRes = await new Promise((resolve, reject) => {
        const req = http.request(`${baseUrl}/api/auth/me`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
        });
        req.on('error', reject);
        req.end();
      });

      if (!meRes.body.user?.profile_photo) {
        throw new Error('/api/auth/me did not return profile_photo');
      }
      console.log('✔ GET /api/auth/me returns profile_photo:', meRes.body.user.profile_photo);
    }

    console.log('\n========================================');
    console.log('🎉 ALL PROFILE PHOTO TESTS PASSED 100%!');
    console.log('========================================\n');
  } finally {
    server.close();
  }
}

testFullFlow().catch(err => {
  console.error('Test Error:', err);
  process.exit(1);
});
