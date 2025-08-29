import { QueryClient } from '@tanstack/react-query'

// Optimized query client configuration for better performance
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false, // Disable to reduce unnecessary network calls
            staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh longer
            cacheTime: 15 * 60 * 1000, // 15 minutes - keep in cache longer
            retry: (failureCount, error) => {
                // Don't retry on 4xx errors (client errors)
                if (error?.response?.status >= 400 && error?.response?.status < 500) {
                    return false;
                }
                // Retry up to 2 times for other errors
                return failureCount < 2;
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff with max 10s
        },
        mutations: {
            retry: 1, // Retry mutations once on failure
        }
    }
})

export default queryClient
