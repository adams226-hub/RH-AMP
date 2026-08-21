import { Request, Response } from 'express';
import { z } from 'zod';
import { connecter } from './auth.service';

const schemaConnexion = z.object({
  email: z.string().email(),
  motDePasse: z.string().min(1),
});

export async function connexion(req: Request, res: Response) {
  const { email, motDePasse } = schemaConnexion.parse(req.body);
  const { jeton } = await connecter(email, motDePasse, req.ip);
  res.json({ jeton });
}
