import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('PostgreSQL connected');
  } catch (err) {
    console.error('Failed to connect to PostgreSQL', err);
    throw err;
  }
};

export const disconnectDB = async () => {
  await prisma.$disconnect();
};
