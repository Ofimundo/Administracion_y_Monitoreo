const fs = require('fs');
const path = require('path');

const metricsPath = path.join(__dirname, '..', 'components', 'dashboard-metrics.tsx');
const content = fs.readFileSync(metricsPath, 'utf8');

const searchStr = 'sortedServices =';
let pos = content.indexOf(searchStr);
if (pos !== -1) {
  console.log("Found sortedServices:");
  console.log(content.substring(pos - 100, pos + 500));
} else {
  // Let's search case insensitively
  let pos2 = content.indexOf('sortedServices');
  while (pos2 !== -1) {
    console.log(`\nFound sortedServices usage at index ${pos2}:`);
    console.log(content.substring(pos2 - 200, pos2 + 300));
    pos2 = content.indexOf('sortedServices', pos2 + 1);
  }
}
