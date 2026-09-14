require('dotenv').config();
const { put, list } = require('@vercel/blob');

async function testBlob() {
  try {
    console.log('Testing Vercel Blob connection...\n');
    
    // Check if token exists
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.log('❌ BLOB_READ_WRITE_TOKEN is missing!');
      console.log('\nVercel Blob requires this token to upload files.');
      console.log('\nHow to fix:');
      console.log('1. Go to https://vercel.com/omar7asns-projects/febackend');
      console.log('2. Click "Storage" tab');
      console.log('3. Create a Blob store or connect existing one');
      console.log('4. The token will be automatically added');
      return;
    }

    console.log('✅ BLOB_READ_WRITE_TOKEN found');
    
    // Try to list blobs
    const { blobs } = await list();
    console.log(`✅ Blob storage connected! Found ${blobs.length} files`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testBlob();
