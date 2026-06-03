const http = require('http');
const fs = require('fs');
http.get('http://localhost:5123/api/comprehensive-reports/comprehensive-data?fiscalYear=2026&budgetType=Corporate&groupBy=office', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    fs.writeFileSync('debug_api_response.json', data);
    console.log('Response saved');
  });
}).on('error', (err) => console.log('Error:', err.message));
