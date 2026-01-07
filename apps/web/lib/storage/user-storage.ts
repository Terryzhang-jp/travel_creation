import { hash, compare } from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import type { User } from "@/types/storage";
import { NotFoundError, ConflictError, ValidationError } from "./errors";
import { getDatabaseAdapter } from "@/lib/adapters/database";

export class UserStorage {
  private get db() {
    return getDatabaseAdapter();
  }

  /**
   * 创建新用户（用于用户注册）
   */
  async create(
    email: string,
    password: string,
    name?: string,
    securityQuestion?: string,
    securityAnswer?: string
  ): Promise<Omit<User, "passwordHash" | "securityAnswerHash">> {
    // 验证输入
    if (!email || !password) {
      throw new ValidationError("Email and password are required");
    }

    if (password.length < 6) {
      throw new ValidationError("Password must be at least 6 characters");
    }

    // 验证安全问题（如果提供）
    if (securityQuestion && !securityAnswer) {
      throw new ValidationError("Security answer is required when security question is provided");
    }

    // 检查邮箱是否已存在
    const existing = await this.db.users.findByEmail(email);
    if (existing) {
      throw new ConflictError("Email already exists");
    }

    // 加密密码
    const passwordHash = await hash(password, 10);

    // 加密安全问题答案（如果提供）
    const securityAnswerHash = securityAnswer
      ? await hash(securityAnswer.toLowerCase().trim(), 10)
      : undefined;

    // 创建用户
    const user = await this.db.users.create({
      id: uuidv4(),
      email,
      passwordHash,
      name,
      requirePasswordChange: false, // 注册用户不需要强制修改密码
      securityQuestion,
      securityAnswerHash,
    });

    // 返回时移除密码哈希
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      securityQuestion: user.securityQuestion,
      requirePasswordChange: user.requirePasswordChange,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * 管理员创建用户（需要用户首次登录修改密码）
   */
  async createByAdmin(
    email: string,
    password: string,
    name?: string
  ): Promise<Omit<User, "passwordHash">> {
    // 验证输入
    if (!email || !password) {
      throw new ValidationError("Email and password are required");
    }

    if (password.length < 6) {
      throw new ValidationError("Password must be at least 6 characters");
    }

    // 检查邮箱是否已存在
    const existing = await this.db.users.findByEmail(email);
    if (existing) {
      throw new ConflictError("Email already exists");
    }

    // 加密密码
    const passwordHash = await hash(password, 10);

    // 创建用户
    const user = await this.db.users.create({
      id: uuidv4(),
      email,
      passwordHash,
      name,
      requirePasswordChange: true, // 管理员创建的用户需要修改密码
    });

    // 返回时移除密码哈希
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      requirePasswordChange: user.requirePasswordChange,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * 根据邮箱查找用户
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.db.users.findByEmail(email);
  }

  /**
   * 根据 ID 查找用户
   */
  async findById(id: string): Promise<Omit<User, "passwordHash"> | null> {
    const user = await this.db.users.findById(id);
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      requirePasswordChange: user.requirePasswordChange,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * 验证用户密码
   */
  async verifyPassword(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (!user) {
      return null;
    }

    const isValid = await compare(password, user.passwordHash);
    if (!isValid) {
      return null;
    }

    return user;
  }

  /**
   * 更新用户信息
   */
  async update(
    id: string,
    data: Partial<Omit<User, "id" | "passwordHash" | "createdAt">>
  ): Promise<Omit<User, "passwordHash">> {
    const user = await this.db.users.update(id, {
      name: data.name,
      email: data.email,
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      requirePasswordChange: user.requirePasswordChange,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * 获取所有用户（用于公共 API JOIN 操作）
   * 返回不包含密码哈希的用户列表
   */
  async findAll(): Promise<Omit<User, "passwordHash">[]> {
    const users = await this.db.users.findAll();

    return users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      requirePasswordChange: user.requirePasswordChange,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
  }

  /**
   * 修改用户密码
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    // 验证新密码
    if (!newPassword || newPassword.length < 6) {
      throw new ValidationError("New password must be at least 6 characters");
    }

    // 获取用户
    const user = await this.db.users.findById(userId);
    if (!user) {
      throw new NotFoundError("User");
    }

    // 验证当前密码
    const isValid = await compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new ValidationError("Current password is incorrect");
    }

    // 加密新密码
    const newPasswordHash = await hash(newPassword, 10);

    // 更新密码并设置 require_password_change 为 false
    await this.db.users.update(userId, {
      passwordHash: newPasswordHash,
      requirePasswordChange: false,
    });
  }

  /**
   * 强制修改密码（首次登录时使用，不需要验证旧密码）
   */
  async forceChangePassword(
    userId: string,
    newPassword: string
  ): Promise<void> {
    // 验证新密码
    if (!newPassword || newPassword.length < 6) {
      throw new ValidationError("New password must be at least 6 characters");
    }

    // 加密新密码
    const newPasswordHash = await hash(newPassword, 10);

    // 更新密码并设置 require_password_change 为 false
    await this.db.users.update(userId, {
      passwordHash: newPasswordHash,
      requirePasswordChange: false,
    });
  }

  /**
   * 获取用户的安全问题（用于密码找回）
   */
  async getSecurityQuestion(email: string): Promise<{ question: string } | null> {
    const user = await this.db.users.findByEmail(email);
    if (!user || !user.securityQuestion) {
      return null;
    }

    return { question: user.securityQuestion };
  }

  /**
   * 验证安全问题答案并重置密码
   */
  async resetPasswordWithSecurityAnswer(
    email: string,
    securityAnswer: string,
    newPassword: string
  ): Promise<void> {
    // 验证新密码
    if (!newPassword || newPassword.length < 6) {
      throw new ValidationError("New password must be at least 6 characters");
    }

    // 获取用户
    const user = await this.db.users.findByEmail(email);
    if (!user) {
      throw new NotFoundError("User");
    }

    if (!user.securityAnswerHash) {
      throw new ValidationError("No security question set for this account");
    }

    // 验证安全问题答案（转小写并去除空格）
    const isValid = await compare(
      securityAnswer.toLowerCase().trim(),
      user.securityAnswerHash
    );

    if (!isValid) {
      throw new ValidationError("Security answer is incorrect");
    }

    // 加密新密码
    const newPasswordHash = await hash(newPassword, 10);

    // 更新密码
    await this.db.users.update(user.id, {
      passwordHash: newPasswordHash,
      requirePasswordChange: false,
    });
  }

  /**
   * 更新用户的安全问题和答案
   */
  async updateSecurityQuestion(
    userId: string,
    securityQuestion: string,
    securityAnswer: string
  ): Promise<void> {
    if (!securityQuestion || !securityAnswer) {
      throw new ValidationError("Security question and answer are required");
    }

    const securityAnswerHash = await hash(securityAnswer.toLowerCase().trim(), 10);

    await this.db.users.update(userId, {
      securityQuestion,
      securityAnswerHash,
    });
  }
}

// 导出单例
export const userStorage = new UserStorage();
