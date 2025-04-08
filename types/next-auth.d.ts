import NextAuth from "next-auth";

declare module "next-auth" {
  /**
   * Расширяем интерфейс Session для добавления пользовательских полей
   */
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
} 