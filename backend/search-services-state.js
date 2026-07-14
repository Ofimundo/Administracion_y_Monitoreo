const fs = require('fs');
const path = require('path');

const metricsPath = path.join(__dirname, '..', 'components', 'dashboard-metrics.tsx');
const content = fs.readFileSync(metricsPath, 'utf8');

// Search for any declaration of a variable named services
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const [services') || lines[i].includes('let services') || lines[i].includes('useState(')) {
    if (lines[i].includes('services')) {
      console.log(`Line ${i+1}: ${lines[i]}`);
    }
  }
}
