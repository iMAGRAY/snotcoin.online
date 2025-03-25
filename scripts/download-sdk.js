const https = require('https');
const fs = require('fs');
const path = require('path');

const SDK_URL = 'https://cdn.farcaster.xyz/sdk/v0.0.31/farcaster.js';
const OUTPUT_PATH = path.join(__dirname, '../public/farcaster.js');

console.log('Downloading Farcaster SDK...');

https.get(SDK_URL, (response) => {
  if (response.statusCode !== 200) {
    console.error(`Failed to download SDK: ${response.statusCode}`);
    process.exit(1);
  }

  const fileStream = fs.createWriteStream(OUTPUT_PATH);
  response.pipe(fileStream);

  fileStream.on('finish', () => {
    fileStream.close();
    console.log('SDK downloaded successfully!');
  });
}).on('error', (error) => {
  console.error('Error downloading SDK:', error);
  process.exit(1);
}); 