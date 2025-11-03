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

const ensureLegacyProfiles = value => {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value.manageProfiles)) return toStringIdArray(value.manageProfiles);
  return toStringIdArray(value.viewProfiles);
};

export const defaultApplicationPermissions = () => ({
  manageAll: false,
  manageProfiles: [],
  checkProfiles: [],
  checkAll: false
});

export const normalizeApplicationPermissions = value => {
  if (!value) return defaultApplicationPermissions();
  if (typeof value === 'string') {
    if (value === APPLICATION_ACCESS.ALL) {
      return {
        manageAll: true,
        manageProfiles: [],
        checkProfiles: [],
        checkAll: false
      };
    }
    if (value === APPLICATION_ACCESS.NONE) {
      return defaultApplicationPermissions();
    }
    // legacy "assigned" behaviour maps to custom list
    return {
      manageAll: false,
      manageProfiles: [],
      checkProfiles: [],
      checkAll: false
    };
  }
  if (typeof value !== 'object') return defaultApplicationPermissions();
  const manageAll = pickBoolean(value, 'manageAll', pickBoolean(value, 'viewAll', false));
  const manageProfiles = ensureLegacyProfiles(value);
  const checkProfiles = toStringIdArray(value.checkProfiles);
  const checkAll = pickBoolean(value, 'checkAll', false);
  return {
    manageAll,
    manageProfiles,
    checkProfiles,
    checkAll
  };
};

export const mergeApplicationPermissions = (current, incoming) => {
  const base = normalizeApplicationPermissions(current);
  if (!incoming || typeof incoming !== 'object') return base;
  const merged = {
    ...base,
    manageAll: pickBoolean(incoming, 'manageAll', base.manageAll),
    checkAll: pickBoolean(incoming, 'checkAll', base.checkAll)
  };
  if (Array.isArray(incoming.manageProfiles) || Array.isArray(incoming.viewProfiles)) {
    merged.manageProfiles = ensureLegacyProfiles(incoming);
  }
  if (Array.isArray(incoming.checkProfiles)) {
    merged.checkProfiles = toStringIdArray(incoming.checkProfiles);
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
