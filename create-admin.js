require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: String,
  isActive: Boolean
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const email = 'asherjobs@outlook.com';
    const password = 'admin@123';
    const hashedPassword = await bcrypt.hash(password, 12);

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      existingUser.password = hashedPassword;
      existingUser.role = 'superadmin';
      existingUser.isActive = true;
      await existingUser.save();
      console.log('✅ Existing superadmin user password updated successfully!');
    } else {
      await User.create({
        name: 'Super Admin',
        email,
        password: hashedPassword,
        role: 'superadmin',
        isActive: true
      });
      console.log('✅ Superadmin user created successfully!');
    }

    console.log('\nLogin Credentials:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log('\n⚠️  Please change the password after first login!');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

createAdmin();
