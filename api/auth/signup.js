import { makeHandler } from '../../lib/vercel-handler.js';
import * as mod from '../../functions/api/auth/signup.js';

export default makeHandler(mod);
