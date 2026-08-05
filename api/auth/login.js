import { makeHandler } from '../../lib/vercel-handler.js';
import * as mod from '../../functions/api/auth/login.js';

export default makeHandler(mod);
