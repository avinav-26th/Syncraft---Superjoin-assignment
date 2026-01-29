import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  callbacks: {
    async signIn({ user }) {
      const allowedEmails = process.env.ADMIN_EMAILS?.split(',') || [];
      if (user.email && allowedEmails.includes(user.email)) {
        return true; 
      }
      // Return false triggers the 'AccessDenied' error flow
      return false; 
    },
    async session({ session }) {
      return session;
    }
  },
  pages: {
    signIn: '/login',
    error: '/login', // Redirect errors (like AccessDenied) back to login
  }
})