require('dotenv').config();
const mongoose = require('mongoose');
const Country = require('../models/Country');
const logger = require('../utils/logger');

const countries = [
  {
    code: 'IN',
    name: 'India',
    flag: '🇮🇳',
    isOriginCountry: true,
    isDestinationCountry: false,
    supportedUserTypes: ['student', 'visitor', 'worker'],
    dialingCode: '+91',
    currency: {
      code: 'INR',
      symbol: '₹',
      name: 'Indian Rupee'
    },
    timezone: 'Asia/Kolkata',
    language: {
      primary: 'hi',
      supported: ['hi', 'en']
    },
    metadata: {
      region: 'Asia',
      subRegion: 'South Asia',
      capital: 'New Delhi',
      population: 1380004385,
      gdpPerCapita: 2256
    },
    displayOrder: 1
  },
  {
    code: 'NG',
    name: 'Nigeria',
    flag: '🇳🇬',
    isOriginCountry: true,
    isDestinationCountry: false,
    supportedUserTypes: ['student', 'visitor', 'worker'],
    dialingCode: '+234',
    currency: {
      code: 'NGN',
      symbol: '₦',
      name: 'Nigerian Naira'
    },
    timezone: 'Africa/Lagos',
    language: {
      primary: 'en',
      supported: ['en']
    },
    metadata: {
      region: 'Africa',
      subRegion: 'West Africa',
      capital: 'Abuja',
      population: 206139587,
      gdpPerCapita: 2432
    },
    displayOrder: 2
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    flag: '🇬🇧',
    isOriginCountry: false,
    isDestinationCountry: true,
    supportedUserTypes: ['student', 'visitor', 'worker'],
    dialingCode: '+44',
    currency: {
      code: 'GBP',
      symbol: '£',
      name: 'British Pound Sterling'
    },
    timezone: 'Europe/London',
    language: {
      primary: 'en',
      supported: ['en']
    },
    visaRequirements: {
      generalInfo: 'UK offers various visa types including student, visitor, and work visas. Processing times vary by visa type and applicant location.',
      processingTimeRange: {
        min: 15,
        max: 60,
        unit: 'days'
      }
    },
    metadata: {
      region: 'Europe',
      subRegion: 'Northern Europe',
      capital: 'London',
      population: 67886004,
      gdpPerCapita: 46344
    },
    displayOrder: 1
  },
  {
    code: 'US',
    name: 'United States',
    flag: '🇺🇸',
    isOriginCountry: false,
    isDestinationCountry: true,
    supportedUserTypes: ['student', 'visitor', 'worker'],
    dialingCode: '+1',
    currency: {
      code: 'USD',
      symbol: '$',
      name: 'US Dollar'
    },
    timezone: 'America/New_York',
    language: {
      primary: 'en',
      supported: ['en']
    },
    visaRequirements: {
      generalInfo: 'The US offers F-1 student visas, B-1/B-2 visitor visas, and various work visa categories. Interview required for most applicants.',
      processingTimeRange: {
        min: 21,
        max: 90,
        unit: 'days'
      }
    },
    metadata: {
      region: 'North America',
      subRegion: 'Northern America',
      capital: 'Washington, D.C.',
      population: 331002647,
      gdpPerCapita: 65279
    },
    displayOrder: 2
  },
  {
    code: 'CA',
    name: 'Canada',
    flag: '🇨🇦',
    isOriginCountry: false,
    isDestinationCountry: true,
    supportedUserTypes: ['student', 'visitor', 'worker'],
    dialingCode: '+1',
    currency: {
      code: 'CAD',
      symbol: 'C$',
      name: 'Canadian Dollar'
    },
    timezone: 'America/Toronto',
    language: {
      primary: 'en',
      supported: ['en', 'fr']
    },
    visaRequirements: {
      generalInfo: 'Canada offers study permits, visitor visas, and work permits. Processing times vary by country of residence and application type.',
      processingTimeRange: {
        min: 14,
        max: 56,
        unit: 'days'
      }
    },
    metadata: {
      region: 'North America',
      subRegion: 'Northern America',
      capital: 'Ottawa',
      population: 37742157,
      gdpPerCapita: 46260
    },
    displayOrder: 3
  },
  {
    code: 'AU',
    name: 'Australia',
    flag: '🇦🇺',
    isOriginCountry: false,
    isDestinationCountry: true,
    supportedUserTypes: ['student', 'visitor', 'worker'],
    dialingCode: '+61',
    currency: {
      code: 'AUD',
      symbol: 'A$',
      name: 'Australian Dollar'
    },
    timezone: 'Australia/Sydney',
    language: {
      primary: 'en',
      supported: ['en']
    },
    visaRequirements: {
      generalInfo: 'Australia offers student visas (subclass 500), visitor visas, and various work visa categories. Most applications are processed online.',
      processingTimeRange: {
        min: 28,
        max: 84,
        unit: 'days'
      }
    },
    metadata: {
      region: 'Oceania',
      subRegion: 'Australia and New Zealand',
      capital: 'Canberra',
      population: 25499881,
      gdpPerCapita: 51812
    },
    displayOrder: 4
  },
  {
    code: 'DE',
    name: 'Germany',
    flag: '🇩🇪',
    isOriginCountry: false,
    isDestinationCountry: true,
    supportedUserTypes: ['student', 'visitor', 'worker'],
    dialingCode: '+49',
    currency: {
      code: 'EUR',
      symbol: '€',
      name: 'Euro'
    },
    timezone: 'Europe/Berlin',
    language: {
      primary: 'de',
      supported: ['de', 'en']
    },
    visaRequirements: {
      generalInfo: 'Germany offers student visas, Schengen visas for short stays, and various residence permits for work and study.',
      processingTimeRange: {
        min: 15,
        max: 90,
        unit: 'days'
      }
    },
    metadata: {
      region: 'Europe',
      subRegion: 'Western Europe',
      capital: 'Berlin',
      population: 83783945,
      gdpPerCapita: 46259
    },
    displayOrder: 5
  }
];

const seedCountries = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB for seeding');

    // Clear existing countries
    await Country.deleteMany({});
    logger.info('Cleared existing countries');

    // Insert new countries
    const createdCountries = await Country.insertMany(countries);
    logger.info(`Seeded ${createdCountries.length} countries successfully`);

    // Log summary
    const summary = {
      totalCountries: createdCountries.length,
      originCountries: createdCountries.filter(c => c.isOriginCountry).length,
      destinationCountries: createdCountries.filter(c => c.isDestinationCountry).length,
      regions: [...new Set(createdCountries.map(c => c.metadata.region))]
    };

    logger.info('Seeding Summary:', summary);

    console.log('\n✅ Countries seeded successfully!');
    console.log('📊 Summary:', summary);
    
    await mongoose.disconnect();
    logger.info('Database connection closed');

  } catch (error) {
    logger.error('Seeding failed:', error);
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  seedCountries();
}

module.exports = seedCountries;