require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function testUserModel() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Test user creation
    const user = new User({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      mobile: '1234567890',
      dialingCode: '+91',
      password: 'testpassword123'
    });
    
    console.log('User model created successfully:', user.fullName);
    
    await mongoose.disconnect();
    console.log('Test completed');
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testUserModel();