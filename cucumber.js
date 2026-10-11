// Cucumber runner for the mobile suite — CommonJS + ts-node, so the feature files, the step
// definitions and the support code all run from source with no build step.
//
//   npx cucumber-js --tags '@smoke'       run a tagged subset
//   npx cucumber-js --dry-run             verify every step is bound (no device needed)
//   npx cucumber-js --name "SMK-002"      run a single scenario by name
//
// Progress goes to stdout; an HTML and a JSON report are written under test-results/ so a CI job
// can archive them as one artifact. Scenarios tagged @flaky are retried once (RETRIES=0 disables).
const fs = require('fs');
const path = require('path');

const resultsDir = 'test-results';
fs.mkdirSync(resultsDir, { recursive: true });

module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    require: ['src/steps/**/*.ts', 'src/support/**/*.ts'],
    requireModule: ['ts-node/register'],
    format: [
      'progress',
      'summary',
      `html:${path.join(resultsDir, 'cucumber-report.html')}`,
      `json:${path.join(resultsDir, 'cucumber-report.json')}`,
    ],
    formatOptions: { snippetInterface: 'async-await' },
    retry: Number(process.env.RETRIES ?? 1),
    retryTagFilter: '@flaky',
    parallel: 1,
    order: 'defined',
    publishQuiet: true,
  },
};
