import fs from 'fs';
import path from 'path';

const filePath = path.resolve('build/index.js');
if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/\r\n/g, '\n');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Converted build/index.js to LF line endings.');
} else {
  console.error('build/index.js not found for LF conversion.');
  process.exit(1);
}
