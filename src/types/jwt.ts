export interface JWTHeader {
  alg: string;
  typ: string;
  kid?: string;
  [key: string]: any;
}

export interface JWTPayload {
  iss?: string; // issuer
  sub?: string; // subject
  aud?: string | string[]; // audience
  exp?: number; // expiration time
  iat?: number; // issued at
  nbf?: number; // not before
  jti?: string; // JWT ID
  [key: string]: any;
}

export interface RequestInfo {
  id: string;
  url: string;
  method: string;
  abbreviatedPath: string;
  timestamp: Date;
}

export interface JWTTokenGroup {
  tokenId: string; // hash of the token for grouping
  raw: string; // the actual JWT token
  header: JWTHeader;
  payload: JWTPayload;
  signature: string;
  expiryDate: Date | null;
  isExpired: boolean;
  requests: RequestInfo[];
  firstSeen: Date;
  lastSeen: Date;
  isValid: boolean;
  parseError?: string;
}

export interface ExtensionStorage {
  tokenGroups: JWTTokenGroup[];
  maxTokenGroups?: number;
  retentionHours?: number;
}
