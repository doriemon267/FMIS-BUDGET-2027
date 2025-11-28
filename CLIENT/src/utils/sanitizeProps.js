// Utility for removing non-DOM props (like ownerState) before spreading props onto DOM or third-party components
export function sanitizeProps(props = {}, blacklist = ['ownerState']) {
  if (!props || typeof props !== 'object') return {};
  const output = {};
  Object.keys(props).forEach((k) => {
    if (blacklist.includes(k)) return;
    output[k] = props[k];
  });
  return output;
}

export default sanitizeProps;
