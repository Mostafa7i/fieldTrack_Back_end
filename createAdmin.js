const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./models/User');
// الصفحة فيها دالة استخدمناها عشان نكريت حساب الادمن لمرة واحده
const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected...');

    const email = 'admin@fieldtrack.com';
    const password = 'password123';
    const name = 'System Admin';

    const existingAdmin = await User.findOne({ email });
    if (existingAdmin) {
      console.log('Admin user already exists!');
      process.exit();
    }

    const admin = await User.create({
      name,
      email,
      password,
      role: 'admin',
    });

    console.log('Admin user created successfully!');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);

    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

createAdmin();
