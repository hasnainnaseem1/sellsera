/**
 * Safe database operation helpers.
 *
 * When documents are restored from a DB dump the internal Mongoose state
 * (version key, ObjectId serialisation, etc.) can become inconsistent,
 * causing .save() to throw DocumentNotFoundError or VersionError.
 *
 * These helpers provide resilient wrappers that fall back to atomic
 * updateOne operations so that a corrupt document never causes an
 * unrecoverable 500.
 */

/**
 * Safely save a Mongoose document.
 * Tries .save() first; on DocumentNotFoundError / VersionError falls
 * back to an atomic updateOne with the full plain object.
 */
async function safeSave(doc) {
  try {
    return await doc.save();
  } catch (err) {
    if (
      err.name === 'DocumentNotFoundError' ||
      err.name === 'VersionError' ||
      (err.message && err.message.includes('No matching document'))
    ) {
      console.warn(
        `safeSave: ${err.name || 'SaveError'} on ${doc.constructor.modelName}, falling back to updateOne`
      );
      const plain = doc.toObject();
      const id = plain._id;
      delete plain._id;
      delete plain.__v;
      plain.updatedAt = new Date();

      const result = await doc.constructor.updateOne({ _id: id }, { $set: plain });
      if (result.matchedCount === 0) {
        // Document genuinely missing – upsert
        await doc.constructor.updateOne({ _id: id }, { $set: plain }, { upsert: true });
      }
      return doc;
    }
    throw err; // Validation / other errors should still propagate
  }
}

/**
 * Safely log an activity.  Never throws – failures are logged to console.
 */
async function safeActivityLog(ActivityLog, data) {
  try {
    await ActivityLog.logActivity(data);
  } catch (err) {
    console.error('ActivityLog failed (non-fatal):', err.message);
  }
}

/**
 * Safely create a notification.  Never throws – failures are logged to console.
 */
async function safeNotification(Notification, data) {
  try {
    await Notification.createNotification(data);
  } catch (err) {
    console.error('Notification failed (non-fatal):', err.message);
  }
}

module.exports = { safeSave, safeActivityLog, safeNotification };
