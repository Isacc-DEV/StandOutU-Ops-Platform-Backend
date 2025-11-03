export const ROLES = {
  ADMIN: 'admin',
  BIDDER: 'bidder',
  PROFILE_MAKER: 'profile_maker',
  MAIL_CHECKER: 'mail_checker',
  CALLER: 'caller',
  SUPPORT: 'supporter'
};

export const PIPELINE = [
  'applied',
  'screen',
  'tech',
  'onsite',
  'offer',
  'hired',
  'rejected',
  'no_response',
  'withdrawn'
];

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
  CHECKED: 'checked',
  REJECTED: 'rejected'
};

export const APPLICATION_CHECK_STATUS_LIST = Object.values(APPLICATION_CHECK_STATUS);
