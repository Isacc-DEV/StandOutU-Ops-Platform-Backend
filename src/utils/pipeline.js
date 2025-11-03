import { PIPELINE } from '../config/auth.js';

export const pipelineIndex = PIPELINE.reduce((acc, status, idx) => {
  acc[status] = idx;
  return acc;
}, {});

export const comparePipeline = (a, b) => {
  return (pipelineIndex[a] ?? Infinity) - (pipelineIndex[b] ?? Infinity);
};
