import { makeHandler } from '../../lib/vercel-handler.js';
import * as mod from '../../functions/api/auth/change-password.js';

export default makeHandler(mod);
