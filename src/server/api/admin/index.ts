import { router } from './trpc';
import { authRouter } from './auth';
import { usersRouter } from './users';
import { dashboardRouter } from './dashboard';

export const adminRouter = router({
  auth: authRouter,
  users: usersRouter,
  dashboard: dashboardRouter,
});

export type AdminRouter = typeof adminRouter;