const fs = require('fs');
const path = require('path');

const metricsPath = path.join(__dirname, '..', 'components', 'dashboard-metrics.tsx');
const content = fs.readFileSync(metricsPath, 'utf8');

const searchStr = 'setServices';
let pos = content.indexOf(searchStr);
while (pos !== -1) {
  console.log(`\nFound setServices at index ${pos}:`);
  console.log(content.substring(pos - 300, pos + 500));
  pos = content.indexOf(searchStr, pos + 1);
}
