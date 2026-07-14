const fs = require('fs');
const path = require('path');

const metricsPath = path.join(__dirname, '..', 'components', 'dashboard-metrics.tsx');
const content = fs.readFileSync(metricsPath, 'utf8');

const searchStr = 'updateServiceStatus';
let pos = content.indexOf(searchStr);
while (pos !== -1) {
  console.log(`Found updateServiceStatus at index ${pos}:`);
  console.log(content.substring(pos - 100, pos + 300));
  pos = content.indexOf(searchStr, pos + 1);
}
