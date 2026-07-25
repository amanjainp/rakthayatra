import { BloodGroup } from '@prisma/client';

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// Compatible Donor mapping (recipient -> donor list compatibility array)
export const BLOOD_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
  O_NEG: [BloodGroup.O_NEG],
  O_POS: [BloodGroup.O_NEG, BloodGroup.O_POS],
  A_NEG: [BloodGroup.O_NEG, BloodGroup.A_NEG],
  A_POS: [BloodGroup.O_NEG, BloodGroup.O_POS, BloodGroup.A_NEG, BloodGroup.A_POS],
  B_NEG: [BloodGroup.O_NEG, BloodGroup.B_NEG],
  B_POS: [BloodGroup.O_NEG, BloodGroup.O_POS, BloodGroup.B_NEG, BloodGroup.B_POS],
  AB_NEG: [BloodGroup.O_NEG, BloodGroup.A_NEG, BloodGroup.B_NEG, BloodGroup.AB_NEG],
  AB_POS: [
    BloodGroup.O_NEG,
    BloodGroup.O_POS,
    BloodGroup.A_NEG,
    BloodGroup.A_POS,
    BloodGroup.B_NEG,
    BloodGroup.B_POS,
    BloodGroup.AB_NEG,
    BloodGroup.AB_POS,
  ],
};

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const;
