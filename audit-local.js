const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const fs = require('fs');

(async () => {
  const url = process.argv[2] || 'https://www.ucl.ac.uk';
  const name = process.argv[3] || 'cached-result';
  
  console.log('Auditing:', url);
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(3000);
    
    // Try to dismiss cookie banners
    const cookieSelectors = [
      'button:has-text("Accept")',
      'button:has-text("Accept all")',
      'button:has-text("Accept All")',
      'button:has-text("Accept cookies")',
      'button:has-text("Allow all")',
      'button:has-text("I agree")',
      'button:has-text("OK")',
      'button:has-text("Got it")',
      'button:has-text("Agree")',
      '[id*="cookie"] button',
      '[class*="cookie"] button',
      '[id*="consent"] button',
      '[class*="consent"] button'
    ];
    
    for (const selector of cookieSelectors) {
      try {
        const btn = await page.$(selector);
        if (btn) {
          await btn.click();
          console.log('Dismissed cookie banner with:', selector);
          await page.waitForTimeout(2000);
          break;
        }
      } catch (e) {}
    }
    
    await page.waitForTimeout(3000);
    
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    
    const output = {
      url: url,
      timestamp: new Date().toISOString(),
      violations: results.violations.map(v => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        wcagLevel: v.tags.some(t => t === 'wcag2a' || t === 'wcag21a') ? 'A' : 'AA',
        count: v.nodes.length,
        category: 'first-order'
      }))
    };
    
    output.summary = {
      totalViolations: output.violations.reduce((s, v) => s + v.count, 0),
      totalRules: output.violations.length,
      levelAViolations: output.violations.filter(v => v.wcagLevel === 'A').reduce((s, v) => s + v.count, 0),
      levelAAViolations: output.violations.filter(v => v.wcagLevel === 'AA').reduce((s, v) => s + v.count, 0)
    };
    
    const filename = name + '.json';
    fs.writeFileSync(filename, JSON.stringify(output, null, 2));
    console.log('Violations:', output.violations.length, 'rules,', output.summary.totalViolations, 'instances');
    console.log('Saved to', filename);
  } catch (err) {
    console.log('Error:', err.message);
  }
  
  await browser.close();
})();
