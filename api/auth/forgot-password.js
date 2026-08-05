import { makeHandler } from '../../lib/vercel-handler.js';
import * as mod from '../../functions/api/auth/forgot-password.js';

export default makeHandler(mod);
