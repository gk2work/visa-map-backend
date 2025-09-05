require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const pdfService = require('../services/pdfService');

/**
 * PDF Service Test Script
 * Tests all PDF generation functionality with sample data
 */

const testOutputDir = path.join(__dirname, 'pdf-output');

// Sample data for testing
const sampleUser = {
  id: '507f1f77bcf86cd799439011',
  firstName: 'Gautam',
  lastName: 'Kumar',
  fullName: 'Gautam Kumar',
  email: 'gautam@example.com'
};

const sampleVisaType = {
  _id: '507f1f77bcf86cd799439012',
  title: 'UK Student Visa (Tier 4)',
  originCountry: 'IN',
  destinationCountry: 'GB',
  category: 'student',
  processingTime: '6-8 weeks',
  fees: {
    base: 524,
    additional: [
      {
        name: 'Immigration Health Surcharge',
        amount: 776,
        conditions: { hasCAS: true }
      },
      {
        name: 'Priority Service',
        amount: 500,
        conditions: { priorityService: true }
      }
    ]
  },
  requirements: {
    documents: [
      {
        name: 'Valid Passport',
        description: 'Passport must be valid for at least 6 months',
        required: true
      },
      {
        name: 'CAS (Confirmation of Acceptance for Studies)',
        description: 'Issued by your UK education provider',
        required: true,
        conditions: { hasCAS: true }
      },
      {
        name: 'ATAS Certificate',
        description: 'Required for certain technical subjects',
        required: false,
        conditions: { hasATAS: true }
      },
      {
        name: 'TB Test Certificate',
        description: 'Required for stays longer than 6 months',
        required: false,
        conditions: { requiresTBTest: true }
      },
      {
        name: 'Financial Documents',
        description: 'Bank statements or scholarship letters',
        required: true
      },
      {
        name: 'English Language Test',
        description: 'IELTS, TOEFL, or accepted equivalent',
        required: true
      }
    ]
  },
  process: {
    steps: [
      {
        title: 'Receive Unconditional Offer',
        description: 'Get accepted to a UK university or college',
        action: 'Apply to universities and wait for acceptance',
        priority: 'high'
      },
      {
        title: 'Obtain CAS',
        description: 'Receive Confirmation of Acceptance for Studies',
        action: 'Request CAS from your education provider',
        priority: 'high',
        conditions: { hasCAS: true }
      },
      {
        title: 'ATAS Certificate',
        description: 'Apply for ATAS if studying certain subjects',
        action: 'Check if your course requires ATAS and apply',
        priority: 'medium',
        conditions: { hasATAS: true }
      },
      {
        title: 'Prepare Financial Documents',
        description: 'Gather evidence of funds for tuition and living costs',
        action: 'Collect bank statements and financial evidence',
        priority: 'high'
      },
      {
        title: 'Complete Online Application',
        description: 'Fill out visa application form online',
        action: 'Complete application on gov.uk website',
        priority: 'high'
      },
      {
        title: 'Book and Attend Biometrics',
        description: 'Provide fingerprints and photograph',
        action: 'Book appointment at visa application center',
        priority: 'high'
      },
      {
        title: 'TB Test',
        description: 'Complete tuberculosis test if required',
        action: 'Book TB test at approved clinic',
        priority: 'medium',
        conditions: { requiresTBTest: true }
      },
      {
        title: 'Wait for Decision',
        description: 'Processing time is typically 6-8 weeks',
        action: 'Monitor application status online',
        priority: 'low'
      }
    ]
  },
  importantNotes: [
    'Apply no more than 6 months before your course start date',
    'Ensure all documents are in English or officially translated',
    'Keep copies of all submitted documents',
    'Check current fee amounts as they may change'
  ],
  officialLinks: [
    {
      title: 'UK Government Visa Information',
      url: 'https://www.gov.uk/student-visa'
    },
    {
      title: 'Apply for Student Visa',
      url: 'https://www.gov.uk/apply-uk-visa'
    },
    {
      title: 'Immigration Health Surcharge',
      url: 'https://www.gov.uk/healthcare-immigration-application'
    }
  ]
};

const samplePersonalizationData = {
  hasCAS: true,
  casDate: '15/03/2024',
  hasATAS: true,
  requiresTBTest: true,
  studyLocation: 'london',
  courseLevel: 'postgraduate',
  hasDependent: false,
  financialSituation: 'self_funded',
  previousVisaRefusal: false
};

const sampleJourney = {
  _id: '507f1f77bcf86cd799439013',
  userId: sampleUser.id,
  email: sampleUser.email,
  originCountry: 'IN',
  destinationCountry: 'GB',
  userType: 'student',
  visaType: 'student',
  status: 'in_progress',
  phase: 'preparation',
  personalizationData: samplePersonalizationData,
  progressMetrics: {
    totalSteps: 8,
    completedSteps: 5,
    completionPercentage: 62,
    checklistItems: 6,
    completedChecklistItems: 4
  },
  stepCompletion: new Map([
    ['unconditional-offer', true],
    ['cas', true],
    ['atas', true],
    ['financial-docs', true],
    ['online-application', true],
    ['biometrics', false],
    ['tb-test', false],
    ['decision', false]
  ]),
  checklist: new Map([
    ['passport', true],
    ['cas', true],
    ['atas', true],
    ['financial-docs', true],
    ['english-test', false],
    ['tb-test', false]
  ]),
  timestamps: {
    journeyStarted: new Date('2024-01-15'),
    lastActivity: new Date('2024-03-20'),
    casAutoCompleted: new Date('2024-03-15')
  },
  timeline: {
    casReceived: new Date('2024-03-15'),
    applicationSubmitted: null,
    biometricsScheduled: null,
    biometricsCompleted: null,
    decisionReceived: null
  },
  notes: [
    {
      content: 'CAS received from university',
      createdAt: new Date('2024-03-15'),
      author: 'user'
    },
    {
      content: 'ATAS application submitted',
      createdAt: new Date('2024-03-18'),
      author: 'user'
    }
  ],
  daysSinceStart: 65
};

const sampleAnalyticsData = {
  users: {
    totalUsers: 1234,
    activeUsers: 856,
    newUsers: 78,
    verificationRate: 85
  },
  journeys: {
    totalJourneys: 2341,
    activeJourneys: 456,
    completedJourneys: 1123,
    averageCompletion: 73
  },
  contacts: {
    totalContacts: 567,
    resolvedContacts: 234,
    highPriorityContacts: 12,
    averageResponseTime: 4.2
  }
};

async function createOutputDirectory() {
  try {
    await fs.mkdir(testOutputDir, { recursive: true });
    console.log(`✅ Output directory created: ${testOutputDir}`);
  } catch (error) {
    console.error(`❌ Failed to create output directory:`, error.message);
    throw error;
  }
}

async function testVisaChecklistGeneration() {
  console.log('\n🧪 Testing Visa Checklist PDF Generation...');
  
  try {
    const pdf = await pdfService.generateVisaChecklist(
      sampleVisaType,
      samplePersonalizationData,
      sampleUser
    );

    const outputPath = path.join(testOutputDir, pdf.filename);
    await fs.writeFile(outputPath, pdf.buffer);

    console.log(`✅ Visa checklist PDF generated successfully`);
    console.log(`   📁 File: ${pdf.filename}`);
    console.log(`   📊 Size: ${(pdf.size / 1024).toFixed(2)} KB`);
    console.log(`   💾 Saved to: ${outputPath}`);

    return true;
  } catch (error) {
    console.error(`❌ Visa checklist generation failed:`, error.message);
    return false;
  }
}

async function testJourneyReportGeneration() {
  console.log('\n🧪 Testing Journey Report PDF Generation...');
  
  try {
    const pdf = await pdfService.generateJourneyReport(sampleJourney, sampleUser);

    const outputPath = path.join(testOutputDir, pdf.filename);
    await fs.writeFile(outputPath, pdf.buffer);

    console.log(`✅ Journey report PDF generated successfully`);
    console.log(`   📁 File: ${pdf.filename}`);
    console.log(`   📊 Size: ${(pdf.size / 1024).toFixed(2)} KB`);
    console.log(`   💾 Saved to: ${outputPath}`);

    return true;
  } catch (error) {
    console.error(`❌ Journey report generation failed:`, error.message);
    return false;
  }
}

async function testAnalyticsReportGeneration() {
  console.log('\n🧪 Testing Analytics Report PDF Generation...');
  
  try {
    const reportOptions = {
      reportType: 'overview',
      timeframe: '30d',
      generatedBy: 'Test Script',
      generatedAt: new Date()
    };

    const pdf = await pdfService.generateAnalyticsReport(sampleAnalyticsData, reportOptions);

    const outputPath = path.join(testOutputDir, pdf.filename);
    await fs.writeFile(outputPath, pdf.buffer);

    console.log(`✅ Analytics report PDF generated successfully`);
    console.log(`   📁 File: ${pdf.filename}`);
    console.log(`   📊 Size: ${(pdf.size / 1024).toFixed(2)} KB`);
    console.log(`   💾 Saved to: ${outputPath}`);

    return true;
  } catch (error) {
    console.error(`❌ Analytics report generation failed:`, error.message);
    return false;
  }
}

async function testPersonalizationLogic() {
  console.log('\n🧪 Testing Personalization Logic...');
  
  try {
    // Test condition evaluation
    const conditions1 = { hasCAS: true, hasATAS: true };
    const result1 = pdfService.evaluateConditions(conditions1, samplePersonalizationData);
    console.log(`   ✅ Condition evaluation (hasCAS: true, hasATAS: true): ${result1}`);

    const conditions2 = { hasCAS: true, hasATAS: false };
    const result2 = pdfService.evaluateConditions(conditions2, samplePersonalizationData);
    console.log(`   ✅ Condition evaluation (hasCAS: true, hasATAS: false): ${result2}`);

    // Test fee calculation
    const totalFee = pdfService.calculateTotalFee(sampleVisaType.fees, samplePersonalizationData);
    console.log(`   ✅ Total fee calculation: £${totalFee}`);

    // Test document processing
    const processedDocs = pdfService.processDocuments(
      sampleVisaType.requirements.documents,
      samplePersonalizationData
    );
    console.log(`   ✅ Processed documents: ${processedDocs.length} documents (${processedDocs.filter(d => d.isPersonalized).length} personalized)`);

    // Test step processing
    const processedSteps = pdfService.processVisaSteps(
      sampleVisaType.process.steps,
      samplePersonalizationData
    );
    console.log(`   ✅ Processed steps: ${processedSteps.length} steps (${processedSteps.filter(s => s.isPersonalized).length} personalized)`);

    return true;
  } catch (error) {
    console.error(`❌ Personalization logic test failed:`, error.message);
    return false;
  }
}

async function testPDFServiceInitialization() {
  console.log('\n🧪 Testing PDF Service Initialization...');
  
  try {
    await pdfService.initialize();
    console.log('✅ PDF service browser initialized successfully');
    return true;
  } catch (error) {
    console.error(`❌ PDF service initialization failed:`, error.message);
    return false;
  }
}

async function testHTMLGeneration() {
  console.log('\n🧪 Testing HTML Generation...');
  
  try {
    // Test checklist HTML generation
    const checklistData = {
      userInfo: sampleUser,
      visaInfo: {
        title: sampleVisaType.title,
        route: `${sampleVisaType.originCountry} → ${sampleVisaType.destinationCountry}`,
        category: sampleVisaType.category,
        processingTime: sampleVisaType.processingTime,
        totalFee: 1300
      },
      personalization: samplePersonalizationData,
      steps: sampleVisaType.process.steps.slice(0, 3),
      documents: sampleVisaType.requirements.documents.slice(0, 3),
      timeline: [],
      importantNotes: sampleVisaType.importantNotes,
      officialLinks: sampleVisaType.officialLinks
    };

    const checklistHTML = pdfService.generateChecklistHTML(checklistData);
    const htmlPath = path.join(testOutputDir, 'test-checklist.html');
    await fs.writeFile(htmlPath, checklistHTML);
    console.log(`   ✅ Checklist HTML generated (${checklistHTML.length} characters)`);
    console.log(`   💾 Sample saved to: ${htmlPath}`);

    // Test journey report HTML generation
    const journeyHTML = pdfService.generateJourneyReportHTML({
      userInfo: sampleUser,
      journeyInfo: {
        route: 'IN → GB',
        visaType: 'student',
        status: 'in_progress',
        daysSinceStart: 65
      },
      progress: sampleJourney.progressMetrics
    });
    console.log(`   ✅ Journey report HTML generated (${journeyHTML.length} characters)`);

    // Test analytics report HTML generation
    const analyticsHTML = pdfService.generateAnalyticsReportHTML(sampleAnalyticsData, {
      reportType: 'overview',
      timeframe: '30d',
      generatedBy: 'Test Script'
    });
    console.log(`   ✅ Analytics report HTML generated (${analyticsHTML.length} characters)`);

    return true;
  } catch (error) {
    console.error(`❌ HTML generation test failed:`, error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting PDF Service Tests...');
  console.log('==========================================');

  const testResults = [];

  try {
    // Create output directory
    await createOutputDirectory();

    // Run all tests
    testResults.push(['PDF Service Initialization', await testPDFServiceInitialization()]);
    testResults.push(['HTML Generation', await testHTMLGeneration()]);
    testResults.push(['Personalization Logic', await testPersonalizationLogic()]);
    testResults.push(['Visa Checklist PDF', await testVisaChecklistGeneration()]);
    testResults.push(['Journey Report PDF', await testJourneyReportGeneration()]);
    testResults.push(['Analytics Report PDF', await testAnalyticsReportGeneration()]);

  } catch (error) {
    console.error('\n💥 Test suite failed with error:', error.message);
  } finally {
    // Close PDF service
    try {
      await pdfService.close();
      console.log('\n🔧 PDF service browser closed');
    } catch (error) {
      console.error('⚠️  Warning: Failed to close PDF service:', error.message);
    }
  }

  // Print summary
  console.log('\n==========================================');
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('==========================================');

  const passed = testResults.filter(([, result]) => result).length;
  const total = testResults.length;

  testResults.forEach(([testName, result]) => {
    const status = result ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${testName}`);
  });

  console.log('==========================================');
  console.log(`🎯 Overall: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! PDF service is working correctly.');
    console.log(`📁 Generated PDFs saved in: ${testOutputDir}`);
  } else {
    console.log('⚠️  Some tests failed. Check the error messages above.');
  }
  
  console.log('==========================================');

  process.exit(passed === total ? 0 : 1);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('\n💥 Uncaught Exception:', error.message);
  console.error(error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests,
  testVisaChecklistGeneration,
  testJourneyReportGeneration,
  testAnalyticsReportGeneration,
  testPersonalizationLogic,
  sampleUser,
  sampleVisaType,
  samplePersonalizationData,
  sampleJourney
};