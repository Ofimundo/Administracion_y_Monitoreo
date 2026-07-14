const fs = require('fs');
const path = require('path');

const metricsPath = path.join(__dirname, '..', 'components', 'dashboard-metrics.tsx');
const content = fs.readFileSync(metricsPath, 'utf8');

// Find where "Disponibilidad por Servicio" is rendered
const searchStr = 'Disponibilidad por Servicio';
const index = content.toLowerCase().indexOf(searchStr.toLowerCase());

if (index !== -1) {
  console.log("Found text at index:", index);
  console.log(content.substring(index, index + 1500));
} else {
  console.log("Not found");
}
