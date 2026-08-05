import { makeHandler } from '../../lib/vercel-handler.js';
import * as mod from '../../functions/api/auth/me.js';

export default makeHandler(mod);
