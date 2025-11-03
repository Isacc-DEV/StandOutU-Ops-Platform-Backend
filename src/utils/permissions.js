import { APPLICATION_ACCESS } from '../config/auth.js';

const toStringIdArray = value => {
  if (!Array.isArray(value)) return [];
  const ids = [];
  value.forEach(item => {
    if (!item) return;
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed) ids.push(trimmed);
      return;
    }
    if (item._id || item.id) {
      const id = item._id || item.id;
      if (id) ids.push(id.toString());
      return;
    }
    if (typeof item.toString === 'function') {
      const asString = item.toString();
      if (asString && asString !== '[object Object]') {
        ids.push(asString);
      }
    }
  });
  return Array.from(new Set(ids));
};

const pickBoolean = (source, key, fallback = false) =>
  typeof source?.[key] === 'boolean' ? source[key] : fallback;

const ensureManageApplicationList = value => {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value.manageApplications)) return toStringIdArray(value.manageApplications);
  if (Array.isArray(value.manageProfiles)) return toStringIdArray(value.manageProfiles);
  return toStringIdArray(value.viewProfiles);
};

const ensureCheckApplicationList = value => {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value.checkApplications)) return toStringIdArray(value.checkApplications);
  return toStringIdArray(value.checkProfiles);
};

export const defaultApplicationPermissions = () => ({
  manageAllApplications: false,
  manageApplications: [],
  checkApplications: [],
  checkAllApplications: false
});

export const normalizeApplicationPermissions = value => {
  if (!value) return defaultApplicationPermissions();
  if (typeof value === 'string') {
    if (value === APPLICATION_ACCESS.ALL) {
      return {
        manageAllApplications: true,
        manageApplications: [],
        checkApplications: [],
        checkAllApplications: false
      };
    }
    if (value === APPLICATION_ACCESS.NONE) {
      return defaultApplicationPermissions();
    }
    // legacy "assigned" behaviour maps to custom list
    return {
      manageAllApplications: false,
      manageApplications: [],
      checkApplications: [],
      checkAllApplications: false
    };
  }
  if (typeof value !== 'object') return defaultApplicationPermissions();
  const manageAllApplications = pickBoolean(
    value,
    'manageAllApplications',
    pickBoolean(value, 'manageAll', pickBoolean(value, 'viewAll', false))
  );
  const manageApplications = ensureManageApplicationList(value);
  const checkApplications = ensureCheckApplicationList(value);
  const checkAllApplications = pickBoolean(
    value,
    'checkAllApplications',
    pickBoolean(value, 'checkAll', false)
  );
  return {
    manageAllApplications,
    manageApplications,
    checkApplications,
    checkAllApplications
  };
};

export const mergeApplicationPermissions = (current, incoming) => {
  const base = normalizeApplicationPermissions(current);
  if (!incoming || typeof incoming !== 'object') return base;
  const merged = {
    ...base,
    manageAllApplications: pickBoolean(
      incoming,
      'manageAllApplications',
      pickBoolean(incoming, 'manageAll', base.manageAllApplications)
    ),
    checkAllApplications: pickBoolean(
      incoming,
      'checkAllApplications',
      pickBoolean(incoming, 'checkAll', base.checkAllApplications)
    )
  };
  if (
    Array.isArray(incoming.manageApplications) ||
    Array.isArray(incoming.manageProfiles) ||
    Array.isArray(incoming.viewProfiles)
  ) {
    merged.manageApplications = ensureManageApplicationList(incoming);
  }
  if (Array.isArray(incoming.checkApplications) || Array.isArray(incoming.checkProfiles)) {
    merged.checkApplications = ensureCheckApplicationList(incoming);
  }
  return merged;
};

export const normalizePermissions = permissions => {
  const apps = normalizeApplicationPermissions(permissions?.applications);
  return {
    ...permissions,
    applications: apps
  };
};
