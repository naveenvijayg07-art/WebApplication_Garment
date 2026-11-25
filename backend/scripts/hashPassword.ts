import bcrypt from 'bcrypt';

// Tiny utility to generate bcrypt hash for seeding admin passwords
const password = process.argv[2];

if (!password) {
  console.error('Usage: npm run hash <password>');
  process.exit(1);
}

bcrypt.hash(password, 10).then((hash) => {
  console.log(`Password: ${password}`);
  console.log(`Bcrypt Hash: ${hash}`);
});
