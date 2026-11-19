import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

const basePrisma =
  global.prismaGlobal ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

// Configure robust transaction timeouts for MongoDB Atlas interactive transactions
const originalTransaction = basePrisma.$transaction.bind(basePrisma);
(basePrisma as any).$transaction = function (arg: any, options?: any) {
  if (typeof arg === 'function') {
    const opts = { maxWait: 20000, timeout: 30000, ...options };
    return originalTransaction(arg, opts);
  }
  return originalTransaction(arg, options);
};

export const prisma = basePrisma;

if (process.env.NODE_ENV !== 'production') {
  global.prismaGlobal = prisma;
}

