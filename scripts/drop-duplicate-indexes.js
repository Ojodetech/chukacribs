const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DATABASE_URL);
    console.log('✅ Connected to MongoDB');
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    return false;
  }
}

// Drop duplicate indexes
async function dropDuplicateIndexes() {
  try {
    const db = mongoose.connection.db;

    console.log('🔍 Checking for duplicate indexes...');

    // List of collections and their problematic indexes to drop
    const indexesToDrop = [
      // House collection - drop field-level index on location
      { collection: 'houses', indexName: 'location_1' },

      // Notification collection - drop field-level indexes
      { collection: 'notifications', indexName: 'userId_1' },
      { collection: 'notifications', indexName: 'isRead_1' },
      { collection: 'notifications', indexName: 'createdAt_1' },

      // Message collection - drop field-level indexes
      { collection: 'messages', indexName: 'conversationId_1' },
      { collection: 'messages', indexName: 'senderId_1' },
      { collection: 'messages', indexName: 'receiverId_1' },
      { collection: 'messages', indexName: 'read_1' },
      { collection: 'messages', indexName: 'createdAt_1' },

      // Conversation collection - drop field-level indexes
      { collection: 'conversations', indexName: 'studentId_1' },
      { collection: 'conversations', indexName: 'landlordId_1' },
      { collection: 'conversations', indexName: 'houseId_1' },
      { collection: 'conversations', indexName: 'status_1' },
      { collection: 'conversations', indexName: 'lastMessageAt_1' },
      { collection: 'conversations', indexName: 'createdAt_1' },

      // Migration collection - drop field-level indexes
      { collection: 'migrations', indexName: 'name_1' },
      { collection: 'migrations', indexName: 'status_1' },

      // Previously cleaned models - ensure no remaining duplicates
      { collection: 'bookings', indexName: 'studentId_1' },
      { collection: 'bookings', indexName: 'houseId_1' },
      { collection: 'bookings', indexName: 'status_1' },
      { collection: 'bookings', indexName: 'createdAt_1' },
      { collection: 'bookings', indexName: 'updatedAt_1' },

      { collection: 'students', indexName: 'email_1' },
      { collection: 'students', indexName: 'phone_1' },
      { collection: 'students', indexName: 'createdAt_1' },

      { collection: 'tokens', indexName: 'studentId_1' },
      { collection: 'tokens', indexName: 'token_1' },
      { collection: 'tokens', indexName: 'expiresAt_1' },
      { collection: 'tokens', indexName: 'createdAt_1' },

      { collection: 'paymenthistories', indexName: 'studentId_1' },
      { collection: 'paymenthistories', indexName: 'bookingId_1' },
      { collection: 'paymenthistories', indexName: 'status_1' },
      { collection: 'paymenthistories', indexName: 'createdAt_1' },

      { collection: 'reviews', indexName: 'studentId_1' },
      { collection: 'reviews', indexName: 'houseId_1' },
      { collection: 'reviews', indexName: 'rating_1' },
      { collection: 'reviews', indexName: 'createdAt_1' },

      { collection: 'sitereviews', indexName: 'studentId_1' },
      { collection: 'sitereviews', indexName: 'rating_1' },
      { collection: 'sitereviews', indexName: 'createdAt_1' },
    ];

    for (const { collection, indexName } of indexesToDrop) {
      try {
        // Check if collection exists
        const collections = await db.listCollections({ name: collection }).toArray();
        if (collections.length === 0) {
          console.log(`⚠️  Collection '${collection}' does not exist, skipping...`);
          continue;
        }

        // Check if index exists
        const collectionObj = db.collection(collection);
        const indexes = await collectionObj.indexes();
        const indexExists = indexes.some(idx => idx.name === indexName);

        if (indexExists) {
          console.log(`🗑️  Dropping index '${indexName}' from collection '${collection}'...`);
          await collectionObj.dropIndex(indexName);
          console.log(`✅ Dropped index '${indexName}' from '${collection}'`);
        } else {
          console.log(`ℹ️  Index '${indexName}' not found in '${collection}', skipping...`);
        }
      } catch (error) {
        console.log(`⚠️  Could not drop index '${indexName}' from '${collection}': ${error.message}`);
      }
    }

    console.log('✅ Finished checking and dropping duplicate indexes');

    // List remaining indexes for verification
    console.log('\n📋 Remaining indexes after cleanup:');
    const allCollections = await db.listCollections().toArray();

    for (const coll of allCollections) {
      const collectionName = coll.name;
      if (collectionName.startsWith('system.')) continue; // Skip system collections

      try {
        const collectionObj = db.collection(collectionName);
        const indexes = await collectionObj.indexes();
        if (indexes.length > 1) { // More than just the default _id_ index
          console.log(`\n${collectionName}:`);
          indexes.forEach(idx => {
            if (idx.name !== '_id_') {
              console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
            }
          });
        }
      } catch (error) {
        // Skip collections we can't access
      }
    }

  } catch (error) {
    console.error('❌ Error dropping indexes:', error);
  }
}

// Main execution
async function main() {
  console.log('🛠️  Starting MongoDB index cleanup...');

  const connected = await connectDB();
  if (!connected) {
    process.exit(1);
  }

  await dropDuplicateIndexes();

  console.log('\n🎉 Index cleanup completed!');
  console.log('💡 You can now deploy to Render without duplicate index errors.');

  await mongoose.connection.close();
  console.log('👋 Database connection closed.');
}

main().catch(console.error);