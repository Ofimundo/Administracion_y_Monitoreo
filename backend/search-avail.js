const fs = require('fs');
const path = require('path');

const metricsPath = path.join(__dirname, '..', 'components', 'dashboard-metrics.tsx');
const content = fs.readFileSync(metricsPath, 'utf8');

const searchStr = 'getServiceAvailability';
let pos = content.indexOf(searchStr);
if (pos !== -1) {
  console.log("Found getServiceAvailability:");
  console.log(content.substring(pos, pos + 1000));
} else {
  console.log("Not found");
}
