export const ROLES = {
  ADMIN: 'admin',
  BIDDER: 'bidder',
  PROFILE_MAKER: 'profile_maker',
  MAIL_CHECKER: 'mail_checker',
  CALLER: 'caller',
  SUPPORT: 'supporter'
};

export const APPLICATION_ACCESS = {
  ALL: 'all',
  ASSIGNED: 'assigned',
  NONE: 'none'
};

export const PROFILE_ACCESS = {
  EDIT: 'edit',
  VIEW: 'view',
  NONE: 'none'
};

export const APPLICATION_CHECK_STATUS = {
  PENDING: 'pending',
  IN_REVIEW: 'in_review',
  REVIEWED: 'reviewed'
};

export const APPLICATION_CHECK_STATUS_LIST = Object.values(APPLICATION_CHECK_STATUS);

export const APPLICATION_CHECK_RESULT = {
  PENDING: 'pending',
  OK: 'ok',
  BAD: 'bad',
  NOT_PERFECT: 'not_perfect'
};

export const APPLICATION_CHECK_RESULT_LIST = Object.values(APPLICATION_CHECK_RESULT);
