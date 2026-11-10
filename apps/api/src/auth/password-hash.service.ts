import { Injectable } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

@Injectable()
export class PasswordHashService {
  hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = scryptSync(password, salt, 64);
    return Promise.resolve(`${salt}:${derivedKey.toString('hex')}`);
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    const [salt, key] = passwordHash.split(':');
    if (!salt || !key) {
      return Promise.resolve(false);
    }
    const derivedKey = scryptSync(password, salt, 64);
    return Promise.resolve(
      timingSafeEqual(Buffer.from(key, 'hex'), derivedKey),
    );
  }
}
