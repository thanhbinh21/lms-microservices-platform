import { validateAuthServiceEnv } from '@lms/env-validator';

// Bien moi truong da validate - su dung thay vi process.env truc tiep
let validatedEnv: ReturnType<typeof validateAuthServiceEnv> | null = null;

/** Khoi tao va cache bien moi truong da validate */
export function initEnv() {
  validatedEnv = validateAuthServiceEnv();
  return validatedEnv;
}

/** Lay bien moi truong da validate - goi initEnv() truoc khi dung */
export function getEnv() {
  if (!validatedEnv) {
    validatedEnv = validateAuthServiceEnv();
  }
  return validatedEnv;
}
