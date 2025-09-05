require('dotenv').config();
const mongoose = require('mongoose');
const VisaType = require('../models/VisaType');
const logger = require('../utils/logger');

const visaTypes = [
  {
    name: 'Student Visa',
    code: 'STUDENT_IN_GB',
    category: 'student',
    originCountry: 'IN',
    destinationCountry: 'GB',
    description: 'For full-time study at a licensed UK student sponsor',
    overview: 'The Student visa is for international students who want to study in the UK. You must have a confirmed place on a course with a licensed student sponsor, meet the English language requirements, and prove you have enough money to support yourself.',
    eligibility: [
      'Have a confirmed place on a course with a licensed student sponsor',
      'Have enough money to support yourself and pay for your course',
      'Be able to speak, read, write and understand English',
      'Be 16 or over',
      'Have consent from your parents or guardian if you are under 18'
    ],
    processingTime: {
      min: 15,
      max: 60,
      unit: 'days',
      note: 'Processing time varies by location and time of year'
    },
    fees: {
      visaFee: {
        amount: 524,
        currency: 'GBP'
      },
      additionalFees: [
        {
          name: 'Immigration Health Surcharge (IHS)',
          amount: 776,
          currency: 'GBP',
          description: 'Per year for students',
          isOptional: false
        },
        {
          name: 'Priority Processing',
          amount: 500,
          currency: 'GBP',
          description: 'Faster processing (optional)',
          isOptional: true
        },
        {
          name: 'Biometric Residence Permit',
          amount: 19,
          currency: 'GBP',
          description: 'Collection fee',
          isOptional: false
        }
      ],
      totalEstimate: {
        amount: 1319,
        currency: 'GBP',
        note: 'Minimum cost for 1 year (visa fee + IHS + BRP fee)'
      }
    },
    requirements: {
      documents: [
        {
          name: 'Valid Passport',
          description: 'Current passport with at least 6 months validity',
          isRequired: true,
          category: 'identity',
          validityPeriod: '6 months minimum',
          format: 'Original document'
        },
        {
          name: 'CAS (Confirmation of Acceptance for Studies)',
          description: 'CAS from your course provider',
          isRequired: true,
          category: 'academic',
          validityPeriod: '6 months',
          format: 'Digital or printed CAS'
        },
        {
          name: 'Academic Qualifications',
          description: 'Certificates and transcripts for qualifications listed in your CAS',
          isRequired: true,
          category: 'academic',
          format: 'Certified translations if not in English'
        },
        {
          name: 'English Language Certificate',
          description: 'IELTS, TOEFL or other approved test results',
          isRequired: true,
          category: 'academic',
          validityPeriod: '2 years',
          format: 'Original test report'
        },
        {
          name: 'Financial Evidence',
          description: 'Bank statements showing maintenance funds',
          isRequired: true,
          category: 'financial',
          validityPeriod: '31 days old maximum',
          format: 'Bank statements on letterhead'
        },
        {
          name: 'ATAS Certificate',
          description: 'Academic Technology Approval Scheme certificate',
          isRequired: false,
          category: 'academic',
          validityPeriod: '6 months',
          format: 'Digital certificate',
          conditionalLogic: {
            showIf: {
              field: 'hasATAS',
              value: true
            }
          }
        },
        {
          name: 'TB Test Certificate',
          description: 'Tuberculosis test results from approved clinic',
          isRequired: false,
          category: 'medical',
          validityPeriod: '6 months',
          format: 'Original certificate',
          conditionalLogic: {
            showIf: {
              field: 'requiresTBTest',
              value: true
            }
          }
        }
      ],
      financialEvidence: {
        maintenanceFunds: {
          london: {
            amount: 1334,
            currency: 'GBP',
            period: 'per month'
          },
          outsideLondon: {
            amount: 1023,
            currency: 'GBP',
            period: 'per month'
          }
        },
        tuitionShortfall: {
          description: 'Amount you need to pay for your first year of study',
          requirement: 'Must show funds for tuition fees not already paid to your sponsor'
        },
        acceptedFormats: [
          'Personal bank account statements',
          'Building society statements',
          'Letter from bank confirming funds',
          'Government sponsored student loan confirmation'
        ]
      }
    },
    applicationProcess: {
      steps: [
        {
          stepNumber: 1,
          title: 'Get Unconditional Offer and CAS',
          description: 'Receive unconditional offer from UK institution and CAS',
          action: 'Complete admission requirements and receive CAS from university',
          evidence: 'CAS document with reference number',
          estimatedTime: '1-4 weeks'
        },
        {
          stepNumber: 2,
          title: 'ATAS Certificate',
          description: 'Apply for ATAS if studying certain subjects',
          action: 'Apply online at ATAS website if required',
          evidence: 'ATAS clearance certificate',
          estimatedTime: '20 working days',
          isConditional: true,
          conditionalLogic: {
            showIf: {
              field: 'hasATAS',
              value: true
            }
          }
        },
        {
          stepNumber: 3,
          title: 'TB Test',
          description: 'Take tuberculosis test at approved clinic',
          action: 'Book and attend TB test at UKVI approved clinic',
          evidence: 'TB test certificate',
          estimatedTime: '1-3 days',
          isConditional: true,
          conditionalLogic: {
            showIf: {
              field: 'requiresTBTest',
              value: true
            }
          }
        },
        {
          stepNumber: 4,
          title: 'Prepare Financial Evidence',
          description: 'Gather bank statements and financial documents',
          action: 'Obtain bank statements showing maintenance funds',
          evidence: 'Bank statements for required period',
          estimatedTime: '1 week'
        },
        {
          stepNumber: 5,
          title: 'Submit Online Application',
          description: 'Complete visa application online',
          action: 'Fill out Student visa application form on gov.uk',
          evidence: 'Application confirmation and payment receipt',
          estimatedTime: '1-2 hours'
        },
        {
          stepNumber: 6,
          title: 'Pay Visa Fees',
          description: 'Pay visa fee and Immigration Health Surcharge',
          action: 'Pay fees online during application process',
          evidence: 'Payment confirmation',
          estimatedTime: '30 minutes'
        },
        {
          stepNumber: 7,
          title: 'Identity Verification',
          description: 'Verify identity using UK Immigration: ID Check app or VFS',
          action: 'Use ID Check app or visit VFS center for biometrics',
          evidence: 'Identity verification confirmation',
          estimatedTime: '1 day'
        },
        {
          stepNumber: 8,
          title: 'Upload Documents',
          description: 'Upload supporting documents',
          action: 'Scan and upload all required documents online',
          evidence: 'Document upload confirmation',
          estimatedTime: '2-3 hours'
        },
        {
          stepNumber: 9,
          title: 'Wait for Decision',
          description: 'Wait for visa processing and decision',
          action: 'Monitor application status online',
          evidence: 'Decision notification email',
          estimatedTime: '15-60 days'
        },
        {
          stepNumber: 10,
          title: 'Receive eVisa',
          description: 'Access digital visa and plan travel',
          action: 'Set up UKVI account and access eVisa',
          evidence: 'Digital visa confirmation',
          estimatedTime: '1 day'
        }
      ],
      applicationMethod: 'online',
      interviewRequired: false
    },
    officialLinks: [
      {
        title: 'Student visa - GOV.UK',
        url: 'https://www.gov.uk/student-visa',
        description: 'Official UK government guidance on Student visa',
        category: 'guidelines'
      },
      {
        title: 'Apply for a Student visa',
        url: 'https://www.gov.uk/student-visa/apply',
        description: 'Start your Student visa application',
        category: 'application'
      },
      {
        title: 'Student visa fees',
        url: 'https://www.gov.uk/visa-fees',
        description: 'Current visa fees and Immigration Health Surcharge',
        category: 'fees'
      },
      {
        title: 'Financial requirements',
        url: 'https://www.gov.uk/student-visa/money',
        description: 'How much money you need for your Student visa',
        category: 'guidelines'
      },
      {
        title: 'Check your visa application status',
        url: 'https://www.gov.uk/track-visa-application',
        description: 'Track your visa application progress',
        category: 'tracking'
      }
    ],
    commonMistakes: [
      'Not having enough maintenance funds for the required period',
      'Submitting bank statements older than 31 days',
      'Forgetting to include tuition fee shortfall in financial calculations',
      'Not getting academic documents translated and certified',
      'Applying too early before course start date',
      'Not checking if ATAS certificate is required for your course'
    ],
    specialScenarios: [
      {
        title: 'Previous Visa Refusal',
        description: 'If you have been refused a UK visa before',
        additionalDocuments: [
          'Previous refusal letter',
          'Letter explaining circumstances',
          'Additional evidence addressing refusal reasons'
        ],
        additionalSteps: [
          'Address all points mentioned in previous refusal',
          'Provide stronger evidence for weak areas'
        ],
        impact: 'processing_time'
      },
      {
        title: 'Sponsorship by Multiple Institutions',
        description: 'If your course involves multiple sponsors',
        additionalDocuments: [
          'CAS from each sponsor',
          'Letter explaining the arrangement',
          'Academic partnership agreement'
        ],
        additionalSteps: [
          'Ensure all sponsors are licensed',
          'Calculate total course fees correctly'
        ],
        impact: 'additional_documents'
      }
    ],
    personalization: {
      casRequired: true,
      atasRequired: false,
      tbTestRequired: true,
      customQuestions: [
        {
          id: 'hasCAS',
          question: 'Do you have your CAS (Confirmation of Acceptance for Studies)?',
          type: 'boolean',
          impact: 'Required for application'
        },
        {
          id: 'casDate',
          question: 'When did you receive your CAS?',
          type: 'date',
          impact: 'Determines application timeline'
        },
        {
          id: 'hasATAS',
          question: 'Does your course require an ATAS certificate?',
          type: 'boolean',
          impact: 'Additional step and processing time'
        },
        {
          id: 'studyLocation',
          question: 'Will you be studying in London?',
          type: 'select',
          options: ['London', 'Outside London'],
          impact: 'Different maintenance fund requirements'
        }
      ]
    },
    metadata: {
      popularity: 95,
      successRate: 87,
      averageProcessingDays: 25,
      lastUpdated: new Date(),
      source: 'official_government',
      tags: ['student', 'uk', 'study', 'university', 'cas', 'maintenance_funds']
    },
    status: 'active',
    displayOrder: 1
  }
];

const seedVisaTypes = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB for visa type seeding');

    // Clear existing visa types
    await VisaType.deleteMany({});
    logger.info('Cleared existing visa types');

    // Insert new visa types
    const createdVisaTypes = await VisaType.insertMany(visaTypes);
    logger.info(`Seeded ${createdVisaTypes.length} visa types successfully`);

    // Log summary
    const summary = {
      totalVisaTypes: createdVisaTypes.length,
      routes: createdVisaTypes.map(vt => `${vt.originCountry}-${vt.destinationCountry}`),
      categories: [...new Set(createdVisaTypes.map(vt => vt.category))]
    };

    logger.info('Visa Type Seeding Summary:', summary);

    console.log('\nVisa types seeded successfully!');
    console.log('Summary:', summary);
    
    await mongoose.disconnect();
    logger.info('Database connection closed');

  } catch (error) {
    logger.error('Visa type seeding failed:', error);
    console.error('Seeding failed:', error.message);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  seedVisaTypes();
}

module.exports = seedVisaTypes;