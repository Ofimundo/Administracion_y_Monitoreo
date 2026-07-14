const fs = require('fs');
const path = require('path');

const metricsPath = path.join(__dirname, '..', 'components', 'dashboard-metrics.tsx');
const content = fs.readFileSync(metricsPath, 'utf8');

const regex = /(const|let|var)\s+services\b/i;
const match = content.match(regex);
if (match) {
  console.log("Found declaration:", match[0]);
  console.log(content.substring(match.index - 100, match.index + 500));
} else {
  // Let's search where importedServices is assigned or used
  console.log("No const/let services found. Searching for importedServices usage:");
  let pos = content.indexOf('importedServices');
  while (pos !== -1) {
    console.log(content.substring(pos - 100, pos + 200));
    pos = content.indexOf('importedServices', pos + 1);
  }
}
