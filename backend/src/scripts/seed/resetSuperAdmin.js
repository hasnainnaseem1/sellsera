/**
 * Reset Super Admin Credentials
 *
 * Updates the existing super admin's email and password.
 * If no super admin exists, creates one.
 *
 * Usage (on server):
 *   node src/scripts/seed/resetSuperAdmin.js
 *
 * Or with custom credentials via env vars:
 *   NEW_ADMIN_EMAIL=you@example.com NEW_ADMIN_PASSWORD=MyNewPass@123 node src/scripts/seed/resetSuperAdmin.js
 */

const mongoose = require('mongoose');
const readline = require('readline');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// ── Prompt helper ────────────────────────────────────────────────────────────
function prompt(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    if (hidden) {
      // Hide typed characters for password input
      process.stdout.write(question);
      let value = '';
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', function handler(ch) {
        if (ch === '\n' || ch === '\r' || ch === '\u0003') {
          if (ch === '\u0003') process.exit(); // Ctrl+C
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', handler);
          process.stdout.write('\n');
          resolve(value);
        } else if (ch === '\u007f') {
          // Backspace
          if (value.length > 0) value = value.slice(0, -1);
        } else {
          value += ch;
        }
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Reset Super Admin Credentials');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Resolve credentials: env vars → interactive prompts
  let newEmail    = process.env.NEW_ADMIN_EMAIL    || '';
  let newPassword = process.env.NEW_ADMIN_PASSWORD || '';
  let newName     = process.env.NEW_ADMIN_NAME     || '';

  if (!newEmail) {
    newEmail = await prompt('  New email address : ');
  }
  if (!newEmail || !/^\S+@\S+\.\S+$/.test(newEmail)) {
    console.error('\n❌ Invalid email address. Aborting.');
    process.exit(1);
  }

  if (!newPassword) {
    newPassword = await prompt('  New password      : ', true);
  }
  if (!newPassword || newPassword.length < 8) {
    console.error('\n❌ Password must be at least 8 characters. Aborting.');
    process.exit(1);
  }

  if (!newName) {
    const nameInput = await prompt('  Display name (press Enter to keep existing): ');
    if (nameInput) newName = nameInput;
  }

  console.log('');
  console.log('  Connecting to MongoDB...');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    console.log('');

    // Load model AFTER connecting — resolve path regardless of script depth in src/scripts/
    const srcDir = (function findSrc(dir) {
      if (path.basename(dir) === 'src') return dir;
      const parent = path.dirname(dir);
      return parent === dir ? dir : findSrc(parent);
    })(__dirname);
    const { User } = require(path.join(srcDir, 'models/user'));

    const superAdmin = await User.findOne({ role: 'super_admin' });

    if (superAdmin) {
      // ── Update existing super admin ──
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const finalName = newName || superAdmin.name;

      console.log(`  Found super admin: ${superAdmin.email} (${superAdmin._id})`);
      console.log('  Updating credentials...');

      // Use Mongoose updateOne (not native driver) for reliability
      const result = await User.updateOne(
        { _id: superAdmin._id },
        {
          $set: {
            email:           newEmail,
            password:        hashedPassword,
            name:            finalName,
            status:          'active',
            isEmailVerified: true,
            accountType:     'admin',
            loginAttempts:   0,
            updatedAt:       new Date(),
          },
          $unset: { lockUntil: 1 }
        }
      );

      console.log(`  Update result: matched=${result.matchedCount}, modified=${result.modifiedCount}`);

      if (result.matchedCount === 0) {
        console.error('❌ No document matched! Trying alternative approach...');
        
        // Fallback: use native driver with string _id comparison
        const nativeResult = await User.collection.updateOne(
          { role: 'super_admin' },
          {
            $set: {
              email:           newEmail,
              password:        hashedPassword,
              name:            finalName,
              status:          'active',
              isEmailVerified: true,
              accountType:     'admin',
              loginAttempts:   0,
              updatedAt:       new Date(),
            }
          }
        );

        console.log(`  Native result: matched=${nativeResult.matchedCount}, modified=${nativeResult.modifiedCount}`);

        if (nativeResult.matchedCount === 0) {
          console.error('❌ Still no match. Listing all users with role info:');
          const allUsers = await User.collection.find({}, { projection: { email: 1, role: 1, accountType: 1, status: 1 } }).toArray();
          allUsers.forEach(u => console.log(`   - ${u.email} | role: ${u.role} | type: ${u.accountType} | status: ${u.status}`));
          process.exit(1);
        }
      }

      // Verify by reading back
      const verified = await User.findOne({ email: newEmail, accountType: 'admin' });
      
      if (!verified) {
        console.error('❌ Could not read back the updated user!');
        // Debug: list all users
        const allUsers = await User.collection.find({}, { projection: { email: 1, role: 1, accountType: 1 } }).toArray();
        console.log('  All users in database:');
        allUsers.forEach(u => console.log(`   - ${u.email} | role: ${u.role} | type: ${u.accountType}`));
        process.exit(1);
      }

      const passwordValid = await bcrypt.compare(newPassword, verified.password);

      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ Super Admin credentials updated!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`   ID       : ${verified._id}`);
      console.log(`   Name     : ${verified.name}`);
      console.log(`   Email    : ${verified.email}`);
      console.log(`   Password : ${newPassword}`);
      console.log(`   Status   : ${verified.status}`);
      console.log(`   AccType  : ${verified.accountType}`);
      console.log(`   Role     : ${verified.role}`);
      console.log(`   Pwd check: ${passwordValid ? '✅ PASS' : '❌ FAIL'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      if (!passwordValid) {
        console.error('');
        console.error('⚠️  Password verification FAILED!');
        console.error("   Try: NEW_ADMIN_PASSWORD='YourPass@123' node src/scripts/seed/resetSuperAdmin.js");
      }
    } else {
      // ── No super admin found — create one ───────────────────────────────
      console.log('⚠️  No super admin found. Creating one...');

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const result = await User.collection.insertOne({
        name:            newName || 'Super Admin',
        email:           newEmail,
        password:        hashedPassword,
        accountType:     'admin',
        role:            'super_admin',
        status:          'active',
        isEmailVerified: true,
        loginAttempts:   0,
        analysisCount:   0,
        analysisLimit:   999999,
        plan:            'unlimited',
        createdAt:       new Date(),
        updatedAt:       new Date(),
      });

      // Verify the password works
      const verified = await User.collection.findOne({ _id: result.insertedId });
      const passwordValid = await bcrypt.compare(newPassword, verified.password);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ Super Admin created!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`   Name     : ${newName || 'Super Admin'}`);
      console.log(`   Email    : ${newEmail}`);
      console.log(`   Password : ${newPassword}`);
      console.log(`   Pwd check: ${passwordValid ? '✅ PASS' : '❌ FAIL'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    console.log('');
    console.log('  Login at: https://me.sellsera.com');
    console.log('');

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
