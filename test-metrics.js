const { generateMetrics } = require('./dist/commands/metrics/index.js');
console.log(generateMetrics('.tmp-metrics', [{prefix: '@/', target: ''}]));
