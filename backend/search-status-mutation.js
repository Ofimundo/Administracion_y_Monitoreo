const fs = require('fs');
const path = require('path');

const metricsPath = path.join(__dirname, '..', 'components', 'dashboard-metrics.tsx');
const content = fs.readFileSync(metricsPath, 'utf8');

// Find all matches for s.status = or srv.status = or services[...] =
const regexes = [
  /\bstatus\s*=/g,
  /\berrorPercentage\s*=/g,
  /\.status\s*=/g,
  /\.errorPercentage\s*=/g
];

regexes.forEach(regex => {
  let match;
  while ((match = regex.exec(content)) !== null) {
    console.log(`Match: ${match[0]} at index ${match.index}`);
    console.log(content.substring(match.index - 100, match.index + 200));
  }
});
