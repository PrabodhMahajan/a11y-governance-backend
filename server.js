const express = require('express');
const cors = require('cors');
let chromium, AxeBuilder;
try {
  chromium = require('playwright').chromium;
  AxeBuilder = require('@axe-core/playwright').AxeBuilder;
} catch (e) {
  console.log('Playwright not available. Live audits disabled.');
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());

const cachedResults = {
  'depwd.gov.in': {
    url: 'https://depwd.gov.in',
    timestamp: '2026-08-22T13:47:02.919Z',
    summary: { totalViolations: 19, totalRules: 4, ruleTypes: 4, levelAViolations: 19, levelAAViolations: 0, hindiScriptUrls: '94%', totalPages: 8 },
    violations: [
      { id: 'aria-progressbar-name', impact: 'serious', description: 'Ensure every ARIA progressbar node has an accessible name', wcagLevel: 'A', count: 1, category: 'first-order' },
      { id: 'aria-prohibited-attr', impact: 'serious', description: 'Ensure ARIA attributes are not prohibited for an elements role', wcagLevel: 'A', count: 6, category: 'first-order' },
      { id: 'aria-required-children', impact: 'critical', description: 'Ensure elements with an ARIA role that require child roles contain them', wcagLevel: 'A', count: 1, category: 'first-order' },
      { id: 'link-name', impact: 'serious', description: 'Ensure links have discernible text', wcagLevel: 'A', count: 11, category: 'first-order' }
    ],
    secondOrderBarriers: [
      { id: 'hindi-script-urls', description: '94% of navigation links use non-Latin-script Hindi URLs without English link text alternatives', reportedBy: 'Researcher audit', wcagGap: 'No WCAG criterion covers language-script accessibility in navigation' },
      { id: 'caption-inaccuracy', description: 'Caption systems produce inaccurate output for non-standard accents', reportedBy: 'P3 (interview)', wcagGap: 'WCAG checks caption presence, not accuracy' },
      { id: 'camera-distress', description: 'Mandatory camera-based verification causes distress for acid attack survivors', reportedBy: 'P5 (interview)', wcagGap: 'No WCAG criterion addresses psychosocial barriers' },
      { id: 'processing-anxiety', description: 'Unexplained 15-minute processing delays cause severe anxiety for persons with autism', reportedBy: 'P5 (interview)', wcagGap: 'No WCAG criterion addresses cognitive load from unexplained delays' }
    ]
  },
  'india.gov.in': {
    url: 'https://india.gov.in',
    timestamp: '2026-08-22T14:00:23.460Z',
    summary: { totalViolations: 88, totalRules: 4, ruleTypes: 4, levelAViolations: 82, levelAAViolations: 6 },
    violations: [
      { id: 'aria-hidden-focus', impact: 'serious', description: 'Ensure aria-hidden elements are not focusable nor contain focusable elements', wcagLevel: 'A', count: 15, category: 'first-order' },
      { id: 'aria-required-parent', impact: 'critical', description: 'Ensure elements with an ARIA role that require parent roles are contained by them', wcagLevel: 'A', count: 7, category: 'first-order' },
      { id: 'color-contrast', impact: 'serious', description: 'Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds', wcagLevel: 'AA', count: 6, category: 'first-order' },
      { id: 'listitem', impact: 'serious', description: 'Ensure li elements are used semantically', wcagLevel: 'A', count: 60, category: 'first-order' }
    ],
    secondOrderBarriers: []
  },
  'www.ucl.ac.uk': {
    url: 'https://www.ucl.ac.uk',
    timestamp: '2026-08-22T13:58:47.236Z',
    summary: { totalViolations: 4, totalRules: 2, ruleTypes: 2, levelAViolations: 4, levelAAViolations: 0 },
    violations: [
      { id: 'aria-allowed-attr', impact: 'critical', description: 'Ensure an elements role supports its ARIA attributes', wcagLevel: 'A', count: 2, category: 'first-order' },
      { id: 'aria-prohibited-attr', impact: 'serious', description: 'Ensure ARIA attributes are not prohibited for an elements role', wcagLevel: 'A', count: 2, category: 'first-order' }
    ],
    secondOrderBarriers: []
  },
  'www.irctc.co.in': {
    url: 'https://www.irctc.co.in',
    timestamp: '2026-08-22T13:55:09.197Z',
    summary: { totalViolations: 12, totalRules: 6, ruleTypes: 6, levelAViolations: 10, levelAAViolations: 2 },
    violations: [
      { id: 'aria-allowed-attr', impact: 'critical', description: 'Ensure an elements role supports its ARIA attributes', wcagLevel: 'A', count: 2, category: 'first-order' },
      { id: 'aria-command-name', impact: 'serious', description: 'Ensure every ARIA button, link and menuitem has an accessible name', wcagLevel: 'A', count: 2, category: 'first-order' },
      { id: 'aria-valid-attr-value', impact: 'critical', description: 'Ensure all ARIA attributes have valid values', wcagLevel: 'A', count: 2, category: 'first-order' },
      { id: 'color-contrast', impact: 'serious', description: 'Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds', wcagLevel: 'AA', count: 2, category: 'first-order' },
      { id: 'image-alt', impact: 'critical', description: 'Ensure img elements have alternative text or a role of none or presentation', wcagLevel: 'A', count: 3, category: 'first-order' },
      { id: 'label', impact: 'critical', description: 'Ensure every form element has a label', wcagLevel: 'A', count: 1, category: 'first-order' }
    ],
    secondOrderBarriers: []
  }
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/cached-sites', (req, res) => {
  const sites = Object.keys(cachedResults).map(key => ({
    key: key, url: cachedResults[key].url,
    totalViolations: cachedResults[key].summary.totalViolations,
    totalRules: cachedResults[key].summary.totalRules
  }));
  res.json({ success: true, sites: sites });
});

app.get('/api/cached-results/:site', (req, res) => {
  const site = req.params.site;
  if (cachedResults[site]) {
    res.json({ success: true, data: cachedResults[site], source: 'cached' });
  } else {
    res.status(404).json({ success: false, error: 'No cached results for this site' });
  }
});

app.post('/api/audit', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ success: false, error: 'URL is required' });
  if (!chromium) return res.status(503).json({ success: false, error: 'Live audits not available on this server. Use cached results.' });
  let browser;
  try {
    browser = await chromium.launch({ headless: process.env.RAILWAY_ENVIRONMENT ? true : false, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'] });
    const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(5000);
    const cookieSelectors = ['button:has-text("Accept")', 'button:has-text("Accept all")', 'button:has-text("Accept All")', 'button:has-text("Allow all")', 'button:has-text("I agree")', 'button:has-text("OK")', '[id*="cookie"] button', '[class*="cookie"] button'];
    for (const selector of cookieSelectors) {
      try { const btn = await page.$(selector); if (btn) { await btn.click(); await page.waitForTimeout(2000); break; } } catch (e) {}
    }
    await page.waitForTimeout(3000);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const violations = results.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, wcagLevel: v.tags.some(t => t === 'wcag2a' || t === 'wcag21a') ? 'A' : 'AA', count: v.nodes.length, category: 'first-order' }));
    const summary = { totalViolations: violations.reduce((s, v) => s + v.count, 0), totalRules: violations.length, levelAViolations: violations.filter(v => v.wcagLevel === 'A').reduce((s, v) => s + v.count, 0), levelAAViolations: violations.filter(v => v.wcagLevel === 'AA').reduce((s, v) => s + v.count, 0) };
    res.json({ success: true, source: 'live', data: { url, timestamp: new Date().toISOString(), summary, violations, secondOrderBarriers: [] } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Audit failed: ' + error.message });
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(PORT, () => { console.log('A11y Governance Backend running on port ' + PORT); });
