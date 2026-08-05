import { makeHandler } from '../../lib/vercel-handler.js';
import * as mod from '../../functions/api/auth/resend-otp.js';

export default makeHandler(mod);
