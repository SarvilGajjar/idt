const admin = require('firebase-admin');

const serviceAccountPath = process.env.SERVICE_ACCOUNT_FILE;
const serviceAccountJson = process.env.SERVICE_ACCOUNT_JSON;

let serviceAccount;
if (serviceAccountJson) {
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch (e) {
    console.error('Invalid SERVICE_ACCOUNT_JSON:', e.message);
    process.exit(1);
  }
} else if (serviceAccountPath) {
  try {
    serviceAccount = require(serviceAccountPath);
  } catch (e) {
    console.error('Could not load SERVICE_ACCOUNT_FILE:', e.message);
    process.exit(1);
  }
} else {
  console.error('Provide SERVICE_ACCOUNT_FILE or SERVICE_ACCOUNT_JSON in environment');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';

if (!adminEmail) {
  console.error('Set ADMIN_EMAIL env var');
  process.exit(1);
}

(async () => {
  try {
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(adminEmail);
      console.log('Found existing user:', userRecord.uid);
    } catch (e) {
      userRecord = await admin.auth().createUser({
        email: adminEmail,
        password: adminPassword,
        displayName: process.env.ADMIN_NAME || 'Administrator',
      });
      console.log('Created user:', userRecord.uid);
    }

    // Set custom claim
    await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });
    console.log('Set custom claim admin=true');

    const now = new Date().toISOString();
    await db.collection('user_profiles').doc(userRecord.uid).set(
      {
        id: userRecord.uid,
        name: process.env.ADMIN_NAME || 'Administrator',
        email: adminEmail,
        role: 'admin',
        created_at: now,
        updated_at: now,
      },
      { merge: true }
    );

    console.log('Wrote admin profile to Firestore under collection `user_profiles`.');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding admin:', err);
    process.exit(1);
  }
})();
