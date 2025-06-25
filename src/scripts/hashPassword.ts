import bcrypt from 'bcrypt';

async function hashPassword(plainPassword: string) {
  const saltRounds = 10;
  const hash = await bcrypt.hash(plainPassword, saltRounds);
  console.log('Hashed password:', hash);
}

const password = process.argv[2];
if (!password) {
  console.error('Usage: ts-node hashPassword.ts <password>');
  process.exit(1);
}

hashPassword(password);
