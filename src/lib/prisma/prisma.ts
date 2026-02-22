import "dotenv/config";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { PrismaClient } from "../../generated/prisma/client.ts";

const sqlConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  server: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "1433", 10),
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: true, // for azure
    trustServerCertificate: true, // change to true for local dev / self-signed certs
  },
};

const adapter = new PrismaMssql(sqlConfig);
const prisma = new PrismaClient({ adapter });

prisma.$connect()
  .then(() => {
    console.log("Connected to MSSQL database successfully.");
  })
  .catch((err) => {
    console.error("Error connecting to MSSQL database:", err);
  });

export { prisma };