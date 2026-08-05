import { makeHandler } from '../../lib/vercel-handler.js';
import * as mod from '../../functions/api/auth/verify-otp.js';

export default makeHandler(mod);
