import bcrypt from 'bcrypt';

const hashPassword = async (password) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  console.log(hashedPassword);
};

hashPassword('Rui4M90Y').catch((error) => {
  console.error('Failed to hash password:', error);
  process.exitCode = 1;
});
