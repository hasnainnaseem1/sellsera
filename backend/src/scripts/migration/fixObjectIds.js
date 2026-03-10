#!/usr/bin/env node
/**
 * MongoDB ObjectId Fix Script
 * ===========================
 * 
 * Fixes documents that have String-type _ids (and reference fields)
 * instead of proper BSON ObjectId type. This typically happens when data
 * is imported with mongoexport/mongoimport instead of mongodump/mongorestore.
 * 
 * Symptoms:
 * - List endpoints work (find() does collection scan)
 * - Detail endpoints return 404 (findById() uses _id index which expects ObjectId type)
 * - Newly created documents work fine (Mongoose creates proper ObjectIds)
 * 
 * Usage:
 *   cd /home/ubuntu/apps/sellsera/backend
 *   node src/scripts/migration/fixObjectIds.js
 * 
 * Flags:
 *   --dry-run   Show what would be fixed without making changes
 *   --verbose   Show detailed per-document output
 */

const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
require('dotenv').config();

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

// ─── Collection → top-level ObjectId reference fields ───
const COLLECTION_REFS = {
  users: ['customRole', 'currentPlan', 'assignedBy', 'resetPasswordRequestedBy'],
  customroles: ['createdBy', 'updatedBy'],
  plans: ['createdBy', 'updatedBy'],
  features: ['createdBy', 'updatedBy'],
  usagelogs: ['userId', 'planId'],
  marketingpages: ['lastEditedBy'],
  blogposts: ['author'],
  departments: ['createdBy', 'updatedBy'],
  activitylogs: ['userId', 'targetId'],
  cronjobs: ['createdBy'],
  seoredirects: ['createdBy'],
  payments: ['userId', 'planId'],
  analyses: ['userId'],
  notifications: ['recipientId', 'senderId'],
};

// ─── Nested ObjectId paths that need special handling ───
const NESTED_REFS = {
  users: [
    { path: 'planSnapshot.planId', type: 'simple' },
    { path: 'planSnapshot.assignedBy', type: 'simple' },
    { path: 'planSnapshot.features', type: 'array', field: 'featureId' },
  ],
  plans: [
    { path: 'features', type: 'array', field: 'featureId' },
  ],
};

// ─── Helpers ───

function isValidHex24(str) {
  return typeof str === 'string' && /^[0-9a-fA-F]{24}$/.test(str);
}

function toObjectId(value) {
  if (value == null) return value;
  if (value instanceof ObjectId) return value;
  if (isValidHex24(value)) return new ObjectId(value);
  return value; // non-convertible — leave as-is
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function setNestedValue(obj, path, value) {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    current = current?.[parts[i]];
    if (!current) return;
  }
  current[parts[parts.length - 1]] = value;
}

// ─── Fix one collection ───

async function fixCollection(db, collName) {
  const coll = db.collection(collName);
  const total = await coll.countDocuments();

  if (total === 0) {
    console.log(`  ⏭️  ${collName}: empty — skipping`);
    return { idFixed: 0, refFixed: 0, errors: 0 };
  }

  // Phase 1: Detect String _ids
  const stringIdCount = await coll.countDocuments({ _id: { $type: 'string' } });
  const objectIdCount = await coll.countDocuments({ _id: { $type: 'objectId' } });

  console.log(`  📊 ${collName}: ${total} docs (${objectIdCount} ObjectId _id, ${stringIdCount} String _id)`);

  let idFixed = 0;
  let refFixed = 0;
  let errors = 0;

  // Phase 2: Fix String _ids
  if (stringIdCount > 0) {
    const docs = await coll.find({ _id: { $type: 'string' } }).toArray();

    for (const doc of docs) {
      try {
        const oldId = doc._id;

        if (!isValidHex24(oldId)) {
          console.log(`    ⚠️  ${collName} ${oldId}: not a valid 24-char hex — skipped`);
          errors++;
          continue;
        }

        const newId = new ObjectId(oldId);

        // Check if ObjectId version already exists (avoid duplicates)
        const existing = await coll.findOne({ _id: newId });

        if (DRY_RUN) {
          console.log(`    [DRY] Would fix _id: ${oldId} → ObjectId (duplicate: ${!!existing})`);
          idFixed++;
          continue;
        }

        if (existing) {
          // ObjectId version exists — just delete the String duplicate
          await coll.deleteOne({ _id: oldId });
          if (VERBOSE) console.log(`    🔄 ${oldId}: removed String duplicate`);
          idFixed++;
          continue;
        }

        // Build fixed document
        const fixedDoc = { ...doc, _id: newId };

        // Fix top-level reference fields
        const topRefs = COLLECTION_REFS[collName] || [];
        for (const field of topRefs) {
          if (typeof fixedDoc[field] === 'string' && isValidHex24(fixedDoc[field])) {
            fixedDoc[field] = toObjectId(fixedDoc[field]);
          }
        }

        // Fix nested reference fields
        const nestedRefs = NESTED_REFS[collName] || [];
        for (const ref of nestedRefs) {
          if (ref.type === 'simple') {
            const val = getNestedValue(fixedDoc, ref.path);
            if (typeof val === 'string' && isValidHex24(val)) {
              setNestedValue(fixedDoc, ref.path, toObjectId(val));
            }
          } else if (ref.type === 'array') {
            const arr = getNestedValue(fixedDoc, ref.path);
            if (Array.isArray(arr)) {
              for (const item of arr) {
                if (item && typeof item[ref.field] === 'string' && isValidHex24(item[ref.field])) {
                  item[ref.field] = toObjectId(item[ref.field]);
                }
              }
            }
          }
        }

        // Atomic swap: delete String _id → insert ObjectId _id
        await coll.deleteOne({ _id: oldId });
        await coll.insertOne(fixedDoc);

        if (VERBOSE) console.log(`    ✅ ${oldId}: converted to ObjectId`);
        idFixed++;
      } catch (err) {
        console.log(`    ❌ ${collName} ${doc._id}: ${err.message}`);
        errors++;
      }
    }

    if (idFixed > 0) console.log(`    ✅ Fixed ${idFixed} String _ids`);
  }

  // Phase 3: Fix reference fields in documents that already have ObjectId _ids
  const topRefs = COLLECTION_REFS[collName] || [];
  const nestedRefs = NESTED_REFS[collName] || [];

  if (topRefs.length > 0 || nestedRefs.length > 0) {
    const goodDocs = await coll.find({ _id: { $type: 'objectId' } }).toArray();

    for (const doc of goodDocs) {
      const updates = {};

      // Check top-level ref fields
      for (const field of topRefs) {
        if (typeof doc[field] === 'string' && isValidHex24(doc[field])) {
          updates[field] = toObjectId(doc[field]);
        }
      }

      // Check nested ref fields
      for (const ref of nestedRefs) {
        if (ref.type === 'simple') {
          const val = getNestedValue(doc, ref.path);
          if (typeof val === 'string' && isValidHex24(val)) {
            updates[ref.path] = toObjectId(val);
          }
        } else if (ref.type === 'array') {
          const arr = getNestedValue(doc, ref.path);
          if (Array.isArray(arr)) {
            let needsFix = false;
            const fixedArr = arr.map(item => {
              if (item && typeof item[ref.field] === 'string' && isValidHex24(item[ref.field])) {
                needsFix = true;
                return { ...item, [ref.field]: toObjectId(item[ref.field]) };
              }
              return item;
            });
            if (needsFix) {
              updates[ref.path] = fixedArr;
            }
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        if (DRY_RUN) {
          if (VERBOSE) console.log(`    [DRY] Would fix refs in ${doc._id}: ${Object.keys(updates).join(', ')}`);
          refFixed++;
        } else {
          await coll.updateOne({ _id: doc._id }, { $set: updates });
          if (VERBOSE) console.log(`    🔗 Fixed refs in ${doc._id}: ${Object.keys(updates).join(', ')}`);
          refFixed++;
        }
      }
    }

    if (refFixed > 0) console.log(`    🔗 Fixed ${refFixed} documents with String reference fields`);
  }

  return { idFixed, refFixed, errors };
}

// ─── Validate collections for any remaining issues ───

async function validateCollections(db) {
  console.log('\n🔍 Validating collections...');
  const collections = await db.listCollections().toArray();

  for (const { name } of collections) {
    try {
      const result = await db.command({ validate: name });
      const ok = result.valid ? '✅' : '❌';
      if (!result.valid) {
        console.log(`  ${ok} ${name}: INVALID — ${result.errors?.join(', ') || 'unknown error'}`);
      } else if (VERBOSE) {
        console.log(`  ${ok} ${name}: valid (${result.nrecords} records)`);
      }
    } catch (err) {
      console.log(`  ⚠️  ${name}: validate failed — ${err.message}`);
    }
  }
}

// ─── Main ───

async function main() {
  console.log('🔧 MongoDB ObjectId Fix Script');
  console.log('═══════════════════════════════');
  if (DRY_RUN) console.log('🏃 DRY RUN MODE — no changes will be made');
  console.log('');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`✅ Connected to database: ${mongoose.connection.name}\n`);

  const db = mongoose.connection.db;

  // List all collections
  const collections = await db.listCollections().toArray();
  const collNames = collections.map(c => c.name).sort();
  console.log(`📦 Collections: ${collNames.join(', ')}\n`);

  let totalIdFixed = 0;
  let totalRefFixed = 0;
  let totalErrors = 0;

  for (const collName of collNames) {
    const result = await fixCollection(db, collName);
    totalIdFixed += result.idFixed;
    totalRefFixed += result.refFixed;
    totalErrors += result.errors;
  }

  // Validate
  await validateCollections(db);

  // Summary
  console.log('\n═══════════════════════════════');
  console.log('📋 SUMMARY');
  console.log(`  Documents with _id type fixed : ${totalIdFixed}`);
  console.log(`  Documents with refs fixed      : ${totalRefFixed}`);
  if (totalErrors > 0) {
    console.log(`  ⚠️  Errors                     : ${totalErrors}`);
  }
  if (totalIdFixed === 0 && totalRefFixed === 0 && totalErrors === 0) {
    console.log('  ✨ No String ObjectId issues found — database is clean!');
  }
  console.log('═══════════════════════════════\n');

  await mongoose.connection.close();
  console.log('🔒 Connection closed');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  mongoose.connection.close().catch(() => {});
  process.exit(1);
});
