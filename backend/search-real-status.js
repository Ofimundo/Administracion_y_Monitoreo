const fs = require('fs');
const path = require('path');

const metricsPath = path.join(__dirname, '..', 'components', 'dashboard-metrics.tsx');
const content = fs.readFileSync(metricsPath, 'utf8');

const searchStr = 'getRealServiceStatus =';
let pos = content.indexOf(searchStr);
if (pos !== -1) {
  console.log("Found getRealServiceStatus:");
  console.log(content.substring(pos, pos + 1500));
} else {
  console.log("Not found");
}
