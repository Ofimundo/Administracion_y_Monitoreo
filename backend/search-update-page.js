const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, '..', 'app', 'servicio', '[id]', 'page.tsx');
const content = fs.readFileSync(pagePath, 'utf8');

const searchStr = 'updateServiceStatus';
let pos = content.indexOf(searchStr);
while (pos !== -1) {
  console.log(`Found updateServiceStatus at index ${pos}:`);
  console.log(content.substring(pos - 100, pos + 300));
  pos = content.indexOf(searchStr, pos + 1);
}
