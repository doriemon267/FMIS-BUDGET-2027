import api from '../config/api';

// Create an interceptor to automatically add the active region to API requests
export const setupRegionInterceptor = () => {
  // Add a request interceptor
  api.interceptors.request.use(
    (config) => {      // List of endpoints that should NOT have region parameter added automatically
      const excludedEndpoints = [
        '/settings',
        '/api/regions',
        '/regions',
        '/get-user',
        '/login',
        '/logout',
        '/register',
        '/income/upload',
        '/income/template',
        '/comprehensive-reports/available-regions-comprehensive',
        '/comprehensive-reports/available-fiscal-years',
        '/comprehensive-reports/available-budget-types',
        '/comprehensive-reports/active-settings'
      ];

      // Check if the current request URL matches any excluded endpoint
      const isExcluded = excludedEndpoints.some(endpoint =>
        config.url && config.url.includes(endpoint)
      );

      // Skip adding region parameter for excluded endpoints
      if (isExcluded) {
        return config;
      }

      // Get the active region from localStorage
      const activeRegionStr = localStorage.getItem('activeRegion');

      if (activeRegionStr) {
        try {
          const activeRegion = JSON.parse(activeRegionStr);

          // Only add region parameter if it's not already set
          if (!config.params) {
            config.params = {};
          }

          // Don't override if region is already specified in the request
          if (!config.params.region && activeRegion) {
            config.params.region = activeRegion.name || activeRegion.regionName;
          }
        } catch (error) {
          console.error('Error parsing active region from localStorage:', error);
        }
      }

      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );
};

export default setupRegionInterceptor;