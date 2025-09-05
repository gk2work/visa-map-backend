const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * PDF Generation Service
 * Generates personalized visa checklists, journey reports, and analytics reports
 */

class PDFService {
  constructor() {
    this.browser = null;
    this.initialized = false;
  }

  /**
   * Initialize the browser for PDF generation
   */
  async initialize() {
    if (this.initialized && this.browser) {
      return this.browser;
    }

    try {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security'
        ]
      });
      
      this.initialized = true;
      logger.info('PDF service browser initialized');
      return this.browser;
    } catch (error) {
      logger.error('Failed to initialize PDF browser:', error);
      throw new Error('PDF service initialization failed');
    }
  }

  /**
   * Generate personalized visa checklist PDF
   */
  async generateVisaChecklist(visaType, personalizationData, userInfo) {
    try {
      await this.initialize();
      
      // Process checklist data based on personalization
      const processedSteps = this.processVisaSteps(visaType.process?.steps || [], personalizationData);
      const processedDocuments = this.processDocuments(visaType.requirements?.documents || [], personalizationData);
      
      const html = this.generateChecklistHTML({
        userInfo: {
          name: userInfo.fullName || `${userInfo.firstName} ${userInfo.lastName}`,
          email: userInfo.email,
          generatedDate: new Date().toLocaleDateString('en-GB')
        },
        visaInfo: {
          title: visaType.title,
          route: `${visaType.originCountry} → ${visaType.destinationCountry}`,
          category: visaType.category,
          processingTime: visaType.processingTime,
          totalFee: this.calculateTotalFee(visaType.fees, personalizationData)
        },
        personalization: personalizationData,
        steps: processedSteps,
        documents: processedDocuments,
        timeline: this.generateTimeline(visaType, personalizationData),
        importantNotes: visaType.importantNotes || [],
        officialLinks: visaType.officialLinks || []
      });

      const pdf = await this.generatePDFFromHTML(html, {
        filename: `visa-checklist-${visaType.originCountry}-${visaType.destinationCountry}-${Date.now()}.pdf`
      });

      logger.info('Visa checklist PDF generated successfully', {
        userId: userInfo.id,
        visaType: visaType.title,
        route: `${visaType.originCountry} → ${visaType.destinationCountry}`
      });

      return pdf;

    } catch (error) {
      logger.error('Error generating visa checklist PDF:', error);
      throw new Error('Failed to generate visa checklist PDF');
    }
  }

  /**
   * Generate journey progress report PDF
   */
  async generateJourneyReport(journey, user) {
    try {
      await this.initialize();
      
      const html = this.generateJourneyReportHTML({
        userInfo: {
          name: user.fullName,
          email: user.email,
          generatedDate: new Date().toLocaleDateString('en-GB')
        },
        journeyInfo: {
          route: `${journey.originCountry} → ${journey.destinationCountry}`,
          visaType: journey.visaType,
          status: journey.status,
          phase: journey.phase,
          startDate: journey.timestamps.journeyStarted,
          lastActivity: journey.timestamps.lastActivity,
          daysSinceStart: journey.daysSinceStart
        },
        progress: {
          completionPercentage: journey.progressMetrics.completionPercentage,
          completedSteps: journey.progressMetrics.completedSteps,
          totalSteps: journey.progressMetrics.totalSteps,
          completedChecklistItems: journey.progressMetrics.completedChecklistItems,
          checklistItems: journey.progressMetrics.checklistItems
        },
        personalization: journey.personalizationData,
        stepCompletion: Object.fromEntries(journey.stepCompletion),
        checklist: Object.fromEntries(journey.checklist),
        timeline: journey.timeline,
        notes: journey.notes
      });

      const pdf = await this.generatePDFFromHTML(html, {
        filename: `journey-report-${journey._id}-${Date.now()}.pdf`
      });

      logger.info('Journey report PDF generated successfully', {
        journeyId: journey._id,
        userId: user._id
      });

      return pdf;

    } catch (error) {
      logger.error('Error generating journey report PDF:', error);
      throw new Error('Failed to generate journey report PDF');
    }
  }

  /**
   * Generate analytics report PDF
   */
  async generateAnalyticsReport(reportData, options) {
    try {
      await this.initialize();
      
      const html = this.generateAnalyticsReportHTML(reportData, options);

      const pdf = await this.generatePDFFromHTML(html, {
        filename: `analytics-report-${options.reportType}-${Date.now()}.pdf`
      });

      logger.info('Analytics report PDF generated successfully', {
        reportType: options.reportType,
        generatedBy: options.generatedBy
      });

      return pdf;

    } catch (error) {
      logger.error('Error generating analytics report PDF:', error);
      throw new Error('Failed to generate analytics report PDF');
    }
  }

  /**
   * Generate PDF from HTML content
   */
  async generatePDFFromHTML(html, options = {}) {
    const page = await this.browser.newPage();
    
    try {
      await page.setContent(html, { 
        waitUntil: 'networkidle0',
        timeout: 30000
      });
      
      const pdfOptions = {
        format: 'A4',
        printBackground: true,
        margin: { 
          top: '20mm', 
          right: '15mm', 
          bottom: '20mm', 
          left: '15mm' 
        },
        displayHeaderFooter: true,
        headerTemplate: this.getHeaderTemplate(),
        footerTemplate: this.getFooterTemplate(),
        ...options.pdfOptions
      };

      const pdfBuffer = await page.pdf(pdfOptions);
      
      return {
        buffer: pdfBuffer,
        filename: options.filename || `document-${Date.now()}.pdf`,
        size: pdfBuffer.length
      };

    } finally {
      await page.close();
    }
  }

  /**
   * Generate HTML for visa checklist
   */
  generateChecklistHTML(data) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Visa Checklist - ${data.visaInfo.title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; line-height: 1.6; }
        .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
        .title { color: #2563eb; font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .subtitle { color: #6b7280; font-size: 14px; }
        .section { margin-bottom: 30px; page-break-inside: avoid; }
        .section-title { color: #1f2937; font-size: 18px; font-weight: bold; margin-bottom: 15px; border-left: 4px solid #2563eb; padding-left: 10px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .info-item { background: #f8fafc; padding: 15px; border-radius: 5px; }
        .info-label { font-weight: bold; color: #374151; margin-bottom: 5px; }
        .info-value { color: #6b7280; }
        .checklist-item { display: flex; align-items: flex-start; margin-bottom: 10px; padding: 10px; background: #f9fafb; border-radius: 5px; }
        .checkbox { width: 16px; height: 16px; border: 2px solid #d1d5db; margin-right: 10px; margin-top: 2px; border-radius: 3px; flex-shrink: 0; }
        .step-item { margin-bottom: 20px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 5px; }
        .step-title { font-weight: bold; color: #1f2937; margin-bottom: 8px; }
        .step-description { color: #6b7280; font-size: 14px; line-height: 1.5; }
        .timeline-item { display: flex; align-items: center; margin-bottom: 15px; }
        .timeline-date { font-weight: bold; color: #2563eb; width: 120px; flex-shrink: 0; }
        .timeline-desc { flex: 1; color: #374151; }
        .note { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 5px; margin-bottom: 15px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
        .page-break { page-break-before: always; }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">${data.visaInfo.title} Checklist</div>
        <div class="subtitle">Personalized for ${data.userInfo.name} | Route: ${data.visaInfo.route}</div>
        <div class="subtitle">Generated on ${data.userInfo.generatedDate}</div>
    </div>

    <div class="section">
        <div class="section-title">Visa Information</div>
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">Visa Category</div>
                <div class="info-value">${data.visaInfo.category}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Processing Time</div>
                <div class="info-value">${data.visaInfo.processingTime}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Total Fee</div>
                <div class="info-value">£${data.visaInfo.totalFee}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Application Route</div>
                <div class="info-value">${data.visaInfo.route}</div>
            </div>
        </div>
    </div>

    ${Object.keys(data.personalization).length > 0 ? `
    <div class="section">
        <div class="section-title">Personalization Applied</div>
        <div class="info-grid">
            ${Object.entries(data.personalization).map(([key, value]) => `
                <div class="info-item">
                    <div class="info-label">${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</div>
                    <div class="info-value">${typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}</div>
                </div>
            `).join('')}
        </div>
    </div>
    ` : ''}

    <div class="section">
        <div class="section-title">Required Documents</div>
        ${data.documents.map(doc => `
            <div class="checklist-item">
                <div class="checkbox"></div>
                <div>
                    <strong>${doc.name || doc.title}</strong>
                    ${doc.description ? `<br><span style="color: #6b7280; font-size: 14px;">${doc.description}</span>` : ''}
                </div>
            </div>
        `).join('')}
    </div>

    <div class="section page-break">
        <div class="section-title">Application Steps</div>
        ${data.steps.map((step, index) => `
            <div class="step-item">
                <div class="step-title">Step ${index + 1}: ${step.title}</div>
                <div class="step-description">${step.description || step.action || 'Follow the step-by-step guidance in the application.'}</div>
            </div>
        `).join('')}
    </div>

    ${data.timeline && data.timeline.length > 0 ? `
    <div class="section">
        <div class="section-title">Estimated Timeline</div>
        ${data.timeline.map(item => `
            <div class="timeline-item">
                <div class="timeline-date">${item.estimatedDate ? new Date(item.estimatedDate).toLocaleDateString('en-GB') : 'TBD'}</div>
                <div class="timeline-desc">${item.step}</div>
            </div>
        `).join('')}
    </div>
    ` : ''}

    ${data.importantNotes && data.importantNotes.length > 0 ? `
    <div class="section">
        <div class="section-title">Important Notes</div>
        ${data.importantNotes.map(note => `
            <div class="note">${note}</div>
        `).join('')}
    </div>
    ` : ''}

    ${data.officialLinks && data.officialLinks.length > 0 ? `
    <div class="section">
        <div class="section-title">Official Links</div>
        ${data.officialLinks.map(link => `
            <div style="margin-bottom: 10px;">
                <strong>${link.title}</strong><br>
                <span style="color: #2563eb; font-size: 14px;">${link.url}</span>
            </div>
        `).join('')}
    </div>
    ` : ''}

    <div class="footer">
        Generated by VisaMap.ai | This is a personalized checklist based on your inputs. Always verify with official government sources.
    </div>
</body>
</html>`;
  }

  /**
   * Generate HTML for journey report
   */
  generateJourneyReportHTML(data) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Journey Progress Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; line-height: 1.6; }
        .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
        .title { color: #2563eb; font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .subtitle { color: #6b7280; font-size: 14px; }
        .section { margin-bottom: 30px; }
        .section-title { color: #1f2937; font-size: 18px; font-weight: bold; margin-bottom: 15px; border-left: 4px solid #2563eb; padding-left: 10px; }
        .progress-bar { width: 100%; height: 20px; background: #e5e7eb; border-radius: 10px; overflow: hidden; margin-bottom: 10px; }
        .progress-fill { height: 100%; background: #10b981; transition: width 0.3s ease; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .stat-item { background: #f8fafc; padding: 15px; border-radius: 5px; text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; color: #2563eb; }
        .stat-label { color: #6b7280; font-size: 14px; }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">Visa Journey Progress Report</div>
        <div class="subtitle">For ${data.userInfo.name} | Route: ${data.journeyInfo.route}</div>
        <div class="subtitle">Generated on ${data.userInfo.generatedDate}</div>
    </div>

    <div class="section">
        <div class="section-title">Journey Overview</div>
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${data.progress.completionPercentage}%"></div>
        </div>
        <div style="text-align: center; margin-bottom: 20px;">
            <strong>${data.progress.completionPercentage}% Complete</strong>
        </div>
        
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-value">${data.progress.completedSteps}</div>
                <div class="stat-label">Steps Completed</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${data.progress.completedChecklistItems}</div>
                <div class="stat-label">Checklist Items Done</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${data.journeyInfo.daysSinceStart}</div>
                <div class="stat-label">Days Since Start</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${data.journeyInfo.status}</div>
                <div class="stat-label">Current Status</div>
            </div>
        </div>
    </div>

    <div class="footer">
        Generated by VisaMap.ai | Journey ID: ${data.journeyInfo.journeyId || 'N/A'}
    </div>
</body>
</html>`;
  }

  /**
   * Generate HTML for analytics report
   */
  generateAnalyticsReportHTML(reportData, options) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Analytics Report - ${options.reportType}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; line-height: 1.6; }
        .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
        .title { color: #2563eb; font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .subtitle { color: #6b7280; font-size: 14px; }
        .section { margin-bottom: 30px; }
        .section-title { color: #1f2937; font-size: 18px; font-weight: bold; margin-bottom: 15px; border-left: 4px solid #2563eb; padding-left: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">${options.reportType.toUpperCase()} Analytics Report</div>
        <div class="subtitle">Generated by ${options.generatedBy} on ${options.generatedAt ? new Date(options.generatedAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}</div>
        <div class="subtitle">Timeframe: ${options.timeframe}</div>
    </div>

    <div class="section">
        <div class="section-title">Report Summary</div>
        <p>This report contains analytics data for the specified timeframe and filters.</p>
    </div>

    <div class="footer">
        Generated by VisaMap.ai Analytics Engine
    </div>
</body>
</html>`;
  }

  /**
   * Process visa steps based on personalization
   */
  processVisaSteps(steps, personalizationData) {
    return steps.filter(step => {
      if (step.conditions) {
        return this.evaluateConditions(step.conditions, personalizationData);
      }
      return true;
    }).map(step => ({
      ...step,
      isPersonalized: !!step.conditions
    }));
  }

  /**
   * Process documents based on personalization
   */
  processDocuments(documents, personalizationData) {
    return documents.filter(doc => {
      if (doc.conditions) {
        return this.evaluateConditions(doc.conditions, personalizationData);
      }
      return true;
    }).map(doc => ({
      ...doc,
      isPersonalized: !!doc.conditions
    }));
  }

  /**
   * Calculate total fee based on personalization
   */
  calculateTotalFee(fees, personalizationData) {
    if (!fees) return 0;
    
    let total = fees.base || 0;
    
    if (fees.additional && Array.isArray(fees.additional)) {
      fees.additional.forEach(additionalFee => {
        if (this.evaluateConditions(additionalFee.conditions, personalizationData)) {
          total += additionalFee.amount;
        }
      });
    }
    
    return total;
  }

  /**
   * Generate timeline based on personalization
   */
  generateTimeline(visaType, personalizationData) {
    const timeline = [];
    const baseDate = personalizationData.casDate ? 
      new Date(personalizationData.casDate.split('/').reverse().join('-')) : 
      new Date();

    if (visaType.process && visaType.process.steps) {
      visaType.process.steps.forEach((step, index) => {
        if (this.evaluateConditions(step.conditions, personalizationData)) {
          timeline.push({
            step: step.title,
            estimatedDate: new Date(baseDate.getTime() + (index * 7 * 24 * 60 * 60 * 1000)),
            description: step.description || step.action,
            priority: step.priority || 'medium'
          });
        }
      });
    }

    return timeline;
  }

  /**
   * Evaluate conditions against personalization data
   */
  evaluateConditions(conditions, personalizationData) {
    if (!conditions) return true;
    
    for (const [key, expectedValue] of Object.entries(conditions)) {
      const actualValue = personalizationData[key];
      
      if (expectedValue === true && !actualValue) return false;
      if (expectedValue === false && actualValue) return false;
      if (typeof expectedValue === 'string' && actualValue !== expectedValue) return false;
    }
    
    return true;
  }

  /**
   * Get header template for PDFs
   */
  getHeaderTemplate() {
    return `
      <div style="font-size: 10px; padding: 5px; width: 100%; text-align: center; border-bottom: 1px solid #ccc;">
        <strong>VisaMap.ai</strong>
      </div>
    `;
  }

  /**
   * Get footer template for PDFs
   */
  getFooterTemplate() {
    return `
      <div style="font-size: 8px; padding: 5px; width: 100%; text-align: center; border-top: 1px solid #ccc;">
        <span>Generated by VisaMap.ai on ${new Date().toLocaleDateString('en-GB')}</span>
        <span style="float: right;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    `;
  }

  /**
   * Close browser when done
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.initialized = false;
      logger.info('PDF service browser closed');
    }
  }
}

// Export singleton instance
module.exports = new PDFService();