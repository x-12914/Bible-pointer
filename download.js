const fs = require('fs');

async function download() {
  const url = 'https://raw.githubusercontent.com/MaatheusGois/bible/main/versions/en/kjv.json';
  console.log('Fetching Bible data from:', url);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch: ${res.statusText}`);
    }
    const data = await res.json();
    console.log('Successfully fetched JSON data.');
    
    // Write as plain JSON
    fs.writeFileSync('bible-data.json', JSON.stringify(data, null, 2));
    console.log('Saved bible-data.json successfully.');

    // Also write as a JS module/variable for absolute offline file:// support!
    const jsContent = `const BIBLE_DATA = ${JSON.stringify(data)};`;
    fs.writeFileSync('bible-data.js', jsContent);
    console.log('Saved bible-data.js successfully.');
  } catch (err) {
    console.error('Error during download:', err);
  }
}

download();
