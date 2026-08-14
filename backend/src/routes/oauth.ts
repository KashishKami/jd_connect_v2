import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateJwt } from '../middleware/auth';
import { oauthService, InvalidGrantError } from '../services/oauth.service';

const router: Router = Router();

const authorizeSchema = z.object({
  client_id: z.string().min(1),
  response_type: z.literal('code'),
  redirect_uri: z.string().url(),
  state: z.string().optional(),
});

const tokenSchema = z.object({
  grant_type: z.literal('authorization_code'),
  code: z.string().min(1),
  client_id: z.string().optional(),
  redirect_uri: z.string().optional(),
});

router.get('/authorize', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const input = authorizeSchema.parse(req.query);
    const code = await oauthService.generateAuthCode(
      req.employee!.id,
      input.client_id,
      input.redirect_uri
    );

    const redirectUrl = new URL(input.redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (input.state) {
      redirectUrl.searchParams.set('state', input.state);
    }

    return res.redirect(302, redirectUrl.toString());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    return res.status(500).json({ error: 'OAuth authorization failed', details: (err as Error).message });
  }
});

router.post('/token', async (req: Request, res: Response) => {
  try {
    const input = tokenSchema.parse(req.body);
    const tokenResult = await oauthService.exchangeCodeForToken(input.code);
    return res.status(200).json(tokenResult);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    if (err instanceof InvalidGrantError) {
      return res.status(400).json({ error: 'invalid_grant', error_description: err.message });
    }
    return res.status(500).json({ error: 'Token exchange failed', details: (err as Error).message });
  }
});

router.get('/userinfo', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const userInfo = await oauthService.getUserInfo(req.employee!.id);
    return res.status(200).json(userInfo);
  } catch {
    return res.status(401).json({ error: 'Invalid user session or missing employee record' });
  }
});

export default router;
