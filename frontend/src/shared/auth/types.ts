export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  sales_agent: 'Sales Agent',
  ops: 'Operations',
  finance: 'Finance',
  hr: 'HR',
  employee: 'Employee',
};

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'Active' | 'Inactive';
  permissions: string[];
  lastLoginAt: string | null;
  phone?: string;
  designation?: string;
  gender?: 'Male' | 'Female' | null;
  isProfileComplete?: boolean;
  employeeId?: string | null;
}

/** Returned by POST /api/auth/login — step 1 of the two-step sign-in. */
export interface LoginChallenge {
  challengeId: string;
  email: string;
  expiresAt: string;
  delivery: 'console' | 'email';
  resendAvailableInSeconds: number;
  /** Development only. The backend omits this when NODE_ENV=production. */
  devOtp?: string;
}

export interface LoginChallengeResponse {
  message: string;
  devMode: boolean;
  challenge: LoginChallenge;
}

export interface AuthSessionResponse {
  message: string;
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: string;
}
