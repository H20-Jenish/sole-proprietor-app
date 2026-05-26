const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.count();
  if (users === 0) {
    console.log('No default user seeded. Complete first-time signup from the login screen.');
  } else {
    console.log('Seed skipped. Existing users detected.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });