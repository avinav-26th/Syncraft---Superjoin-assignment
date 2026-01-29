import { auth } from "@/auth"

export default auth((req) => {
  // If the user is NOT logged in, and they are NOT on the login page...
  if (!req.auth && req.nextUrl.pathname !== "/login") {
    // Redirect them to Login
    const newUrl = new URL("/login", req.nextUrl.origin)
    return Response.redirect(newUrl)
  }
})

// Configuration: Run on all routes EXCEPT static files (images, css, etc.)
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}