#!/usr/bin/env node
/*
 Simple CLI to create an admin user in Firebase using a service account.

 Usage:
  node scripts/create_admin.js --service ./serviceAccount.json --email admin@example.com --password Secret123 --name "Admin Name" [--temporary 7]

 Or set env vars: SERVICE_ACCOUNT_FILE or SERVICE_ACCOUNT_JSON
*/

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (!next || next.startsWith('--')) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

async function main() {
  const argv = parseArgs();
  const servicePath = argv.service || process.env.SERVICE_ACCOUNT_FILE;
  const serviceJson = process.env.SERVICE_ACCOUNT_JSON;
  if (!servicePath && !serviceJson) {
    console.error('Provide --service <path> or set SERVICE_ACCOUNT_FILE/SERVICE_ACCOUNT_JSON');
    process.exit(1);
  }

  let serviceAccount;
  if (serviceJson) {
    try {
      serviceAccount = JSON.parse(serviceJson);
    } catch (e) {
      console.error('Invalid SERVICE_ACCOUNT_JSON');
      process.exit(1);
    }
  } else {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const resolved = path.resolve(servicePath);
      const raw = fs.readFileSync(resolved, 'utf8');
      serviceAccount = JSON.parse(raw);
    } catch (e) {
      console.error('Could not load service account file:', e.message);
      process.exit(1);
    }
  }

  const email = argv.email || process.env.ADMIN_EMAIL;
  const password = argv.password || process.env.ADMIN_PASSWORD || 'Admin@123456';
  const name = argv.name || process.env.ADMIN_NAME || 'Administrator';
  const tempDays = argv.temporary ? Number(argv.temporary) : argv.temporary === '0' ? 0 : (process.env.ADMIN_TEMP_DAYS ? Number(process.env.ADMIN_TEMP_DAYS) : null);

  if (!email) {
    console.error('Email is required: --email admin@example.com');
    process.exit(1);
  }

  const adminModule = await import('firebase-admin');
  const admin = adminModule.default || adminModule;
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const auth = admin.auth();
  const db = admin.firestore();

  try {
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      console.log('User already exists:', userRecord.uid);
    } catch (e) {
      userRecord = await auth.createUser({ email, password, displayName: name });
      console.log('Created user:', userRecord.uid);
    }

    await auth.setCustomUserClaims(userRecord.uid, { admin: true });
    console.log('Set custom claim admin=true');

    const now = new Date();
    const profile = {
      id: userRecord.uid,
      name,
      email,
      role: 'admin',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    if (tempDays && !isNaN(tempDays)) {
      profile.temporary = true;
      profile.expires_at = new Date(now.getTime() + tempDays * 24 * 60 * 60 * 1000).toISOString();
    }

    await db.collection('user_profiles').doc(userRecord.uid).set(profile, { merge: true });
    console.log('Wrote profile to Firestore for uid:', userRecord.uid);

    console.log('Done. Admin user ready.');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
