import { makeHandler } from '../../lib/vercel-handler.js';
import * as mod from '../../functions/api/auth/delete-account.js';

export default makeHandler(mod);
