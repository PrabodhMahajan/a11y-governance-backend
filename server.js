const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());

// Pre-cached results for depwd.gov.in (from researcher's actual audit)
const cachedResults = {
  'depwd.gov.in': {
    url: 'https://depwd.gov.in',
    timestamp: new Date().toISOString(),
    summary: {
      totalViolations: 116,
      totalPages: 8,
      ruleTypes: 8,
      hindiScriptUrls: '94%',
      levelAViolations: 89,
      levelAAViolations: 27
    },
    violations: [
      {
        id: 'image-alt',
        impact: 'critical',
        description: 'Images must have alternate text',
        wcagLevel: 'A',
        count: 24,
        category: 'first-order'
      },
      {
        id: 'link-name',
        impact: 'serious',
        description: 'Links must have discernible text',
        wcagLevel: 'A',
        count: 31,
        category: 'first-order'
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must have sufficient colour contrast',
        wcagLevel: 'AA',
        count: 18,
        category: 'first-order'
      },
      {
        id: 'html-has-lang',
        impact: 'serious',
        description: 'HTML element must have a lang attribute',
        wcagLevel: 'A',
        count: 8,
        category: 'first-order'
      },
      {
        id: 'label',
        impact: 'critical',
        description: 'Form elements must have labels',
        wcagLevel: 'A',
        count: 12,
        category: 'first-order'
      },
      {
        id: 'heading-order',
        impact: 'moderate',
        description: 'Heading levels should increase by one',
        wcagLevel: 'AA',
        count: 9,
        category: 'first-order'
      },
      {
        id: 'landmark-one-main',
        impact: 'moderate',
        description: 'Page must contain one main landmark',
        wcagLevel: 'A',
        count: 8,
        category: 'first-order'
      },
      {
        id: 'bypass',
        impact: 'serious',
        description: 'Page must have means to bypass repeated blocks',
        wcagLevel: 'A',
        count: 6,
        category: 'first-order'
      }
    ],
    secondOrderBarriers: [
      {
        id: 'hindi-script-urls',
        description: '94% of navigation links use non-Latin-script Hindi URLs without English link text alternatives',
        category: 'second-order',
        reportedBy: 'Researcher audit',
        wcagGap: 'No WCAG criterion covers language-script accessibility in navigation'
      },
      {
        id: 'caption-inaccuracy',
        description: 'Caption systems produce inaccurate output for non-standard accents',
        category: 'second-order',
        reportedBy: 'P3 (interview)',
        wcagGap: 'WCAG checks caption presence, not accuracy'
      },
      {
        id: 'camera-distress',
        description: 'Mandatory camera-based verification causes distress for acid attack survivors',
        category: 'second-order',
        reportedBy: 'P5 (interview)',
        wcagGap: 'No WCAG criterion addresses psychosocial barriers'
      },
      {
        id: 'processing-anxiety',
        description: 'Unexplained 15-minute processing delays cause severe anxiety for persons with autism',
        category: 'second-order',
        reportedBy: 'P5 (interview)',
        wcagGap: 'No WCAG criterion addresses cognitive load from unexplained delays'
      }
    ]
  }
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get pre-cached results
app.get('/api/cached-results/:site', (req, res) => {
  const site = req.params.site;
  if (cachedResults[site]) {
    res.json({ success: true, data: cachedResults[site], source: 'cached' });
  } else {
    res.status(404).json({ success: false, error: 'No cached results for this site' });
  }
});

// Run live audit
app.post('/api/audit', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }

  let browser;
  try {
        browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();
    
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000);
    
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const violations = results.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      wcagLevel: v.tags.includes('wcag2a') || v.tags.includes('wcag21a') ? 'A' : 'AA',
      count: v.nodes.length,
      category: 'first-order'
    }));

    const summary = {
      totalViolations: violations.reduce((sum, v) => sum + v.count, 0),
      totalRules: violations.length,
      levelAViolations: violations.filter(v => v.wcagLevel === 'A').reduce((sum, v) => sum + v.count, 0),
      levelAAViolations: violations.filter(v => v.wcagLevel === 'AA').reduce((sum, v) => sum + v.count, 0),
      criticalCount: violations.filter(v => v.impact === 'critical').reduce((sum, v) => sum + v.count, 0),
      seriousCount: violations.filter(v => v.impact === 'serious').reduce((sum, v) => sum + v.count, 0)
    };

    res.json({
      success: true,
      source: 'live',
      data: {
        url,
        timestamp: new Date().toISOString(),
        summary,
        violations,
        secondOrderBarriers: []
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: `Audit failed: ${error.message}`,
      suggestion: 'Try using cached results instead'
    });
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(PORT, () => {
  console.log(`A11y Governance Backend running on port ${PORT}`);
});
