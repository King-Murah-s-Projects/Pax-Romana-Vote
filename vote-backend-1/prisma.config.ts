import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from prisma/.env (where the project seems to keep it)
dotenv.config({ path: path.join(process.cwd(), 'prisma', '.env') });

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
