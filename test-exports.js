const csvController = require('./controllers/csvController');

console.log('📋 Vérification des exports du contrôleur CSV:');
console.log('=============================================');

const expectedExports = [
  'getUserCSVFiles',
  'getCSVFileById',
  'getCSVFileInfo',
  'getCSVFileData',
  'uploadCSVFile',
  'updateCSVFile',
  'deleteCSVFile',
  'downloadCSVFile',
  'addRow',
  'updateRow',
  'deleteRow'
];

expectedExports.forEach(fnName => {
  if (typeof csvController[fnName] === 'function') {
    console.log(`✅ ${fnName} : OK`);
  } else {
    console.log(`❌ ${fnName} : MANQUANT`);
  }
});

console.log('\n📊 Total des fonctions exportées:', Object.keys(csvController).length);