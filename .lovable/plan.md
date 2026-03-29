
Goal: fix the login flow so a real super admin can sign in and reach the super admin dashboard.

What I found
- Your Supabase login is working. The password request returns 200.
- The user `super@gmail.com` exists.
- That user already has the `super_admin` role in `public.user_roles`.
- So this is not a Supabase credentials problem anymore.
- The likely app bug is in route protection after login.

Root cause
- `ProtectedRoute` currently does this:
  - if no session -> go to `/login`
  - if role doesn’t match -> go to `/`
- But `/` itself is also protected by `requiredRole="super_admin"`.
- So if the role is still loading briefly, or comes back `null` for a moment, the app redirects to `/`, which is the same protected route. That creates a broken post-login flow and can leave you stuck instead of entering the dashboard.

Plan to fix
1. Stabilize auth loading in `src/hooks/useAuth.tsx`
- Remove unused `useNavigate` import.
- Make role fetching explicit and resilient:
  - keep `loading=true` until both session check and role lookup finish
  - handle errors from `user_roles` lookup instead of silently treating everything like no role
  - avoid duplicate racey state updates between `onAuthStateChange` and `getSession()`

2. Fix route guarding in `src/components/ProtectedRoute.tsx`
- Do not redirect role-mismatch users back to `/`, because `/` is protected too.
- Replace that with a safe fallback:
  - show an “access denied / no role assigned” screen, or
  - redirect to `/login`
- Keep the loading spinner visible while role/session are still resolving.

3. Fix login page flow in `src/pages/LoginPage.tsx`
- After `signInWithPassword`, don’t rely on immediate manual redirect alone.
- If already authenticated, auto-redirect away from `/login`.
- Show a clearer error if the user signs in but has no assigned role.

4. Clean up auth-related warnings
- The console warning is about refs on function components somewhere in the routed tree.
- I’ll inspect and adjust the affected component usage while fixing the auth flow so the login screen is cleaner and easier to debug.
- The React Router future-flag warnings are non-blocking and not the reason login fails.

5. Verify super admin pathing
- Keep only these super admin pages:
  - Dashboard
  - Companies
  - Users
  - Settings
- Ensure successful login lands on `/` and stays there for a valid super admin.

Files to update
- `src/hooks/useAuth.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/pages/LoginPage.tsx`
- possibly one routed/layout component if needed for the ref warning cleanup

Expected result
- You log in with `super@gmail.com`
- Session is created
- Role resolves to `super_admin`
- You land on the dashboard instead of getting stuck on login or bounced in a loop

Technical notes
- No database change is needed for this fix.
- Your current DB state already supports login:
  - profile exists
  - `user_roles` row exists
  - auth token request succeeds
- This is an app-side state/redirect bug, not a backend auth failure.
