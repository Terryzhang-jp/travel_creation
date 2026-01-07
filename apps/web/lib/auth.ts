/**
 * Better Auth Configuration
 *
 * 服务端认证配置，包含：
 * - Email/Password 认证
 * - Google OAuth
 * - 支持 SQLite (本地开发) 和 PostgreSQL (生产) 数据库
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import bcrypt from "bcryptjs";

// Better Auth Schema for SQLite (used with drizzleAdapter)
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Define Better Auth schema tables for SQLite
// Using camelCase column names as expected by drizzleAdapter
const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).default(false),
  image: text("image"),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
});

const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: text("expiresAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
});

const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  accessTokenExpiresAt: text("accessTokenExpiresAt"),
  refreshTokenExpiresAt: text("refreshTokenExpiresAt"),
  scope: text("scope"),
  idToken: text("idToken"),
  password: text("password"),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
});

const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: text("expiresAt").notNull(),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
});

// Schema object for drizzleAdapter
const betterAuthSchema = { user, session, account, verification };

// 获取数据库配置（同步版本用于初始化）
function getDatabaseConfigSync() {
  // Default to drizzle-sqlite for local development (matches app database adapter)
  const adapterType = process.env.DATABASE_ADAPTER || "drizzle-sqlite";

  if (adapterType === "drizzle-sqlite") {
    // SQLite 模式：使用 libsql + drizzleAdapter
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require("@libsql/client");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/libsql");

    const client = createClient({
      url: process.env.DATABASE_URL || "file:./data/app.db",
    });
    const db = drizzle(client, { schema: betterAuthSchema });

    return drizzleAdapter(db, {
      provider: "sqlite",
      schema: betterAuthSchema,
    });
  } else {
    // PostgreSQL 模式：使用 pg
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    return pool;
  }
}

export const auth = betterAuth({
  // 数据库配置 - 根据环境变量选择适配器
  database: getDatabaseConfigSync(),

  // 基础 URL
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",

  // 密钥
  secret: process.env.BETTER_AUTH_SECRET,

  // Email/Password 认证
  emailAndPassword: {
    enabled: true,
    // 使用 bcrypt 保持与旧系统兼容
    password: {
      hash: async (password: string) => {
        return await bcrypt.hash(password, 10);
      },
      verify: async ({ password, hash }: { password: string; hash: string }) => {
        return await bcrypt.compare(password, hash);
      },
    },
  },

  // Google OAuth
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },

  // Session 配置
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },

  // 高级配置
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },

  // 信任的来源
  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    "https://novel-rouge-xi.vercel.app",
    "https://novel-terryzhang-jps-projects.vercel.app",
    "http://localhost:3002",
    "http://localhost:3001",
    "http://localhost:3000",
  ],
});

// 导出类型
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
