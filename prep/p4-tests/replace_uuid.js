const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else {
      if (filePath.endsWith('.test.ts')) {
        results.push(filePath);
      }
    }
  }
  return results;
}

const files = walk('services/command-api');
let changed = 0;
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  content = content.replace(/"Idempotency-Key": randomUUID\(\)/g, '"Idempotency-Key": "test-" + randomUUID()');
  content = content.replace(/idempotency_key: randomUUID\(\)/g, 'idempotency_key: "test-" + randomUUID()');
  // Also look for `randomUUID()` where it is returned inside an object for headers
  content = content.replace(/headers: \{ get: \(\) => randomUUID\(\) \}/g, 'headers: { get: () => "test-" + randomUUID() }');
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    changed++;
    console.log(`Updated ${file}`);
  }
}
console.log(`Changed ${changed} files`);
