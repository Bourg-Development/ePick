// Base JavaScript that runs on all pages
document.addEventListener('DOMContentLoaded', function() {
    console.log('Main JS loaded');
});


const api = axios.create({
    baseURL: '/api',  // Your API URL here
    withCredentials: true,  // Ensure cookies are sent with requests
});

let isRefreshing = false;
let failedQueue = [];

// Helper function to retry the failed requests after token refresh
const processQueue = (error, token = null) => {
    failedQueue.forEach(p => {
        if (error) p.reject(error);
        else p.resolve(token);
    });
    failedQueue = [];
};

// Request interceptor to attach token (though not necessary if using cookies)
api.interceptors.request.use((config) => {
    // You could add a token to the headers here if you were storing it in memory or localStorage
    return config;
});

// Response interceptor to handle 401 errors and refresh the token
api.interceptors.response.use(
    response => response,  // Allow successful responses to pass through
    async (error) => {
        const originalRequest = error.config;

        // If we get a 401 and the request has not been retried yet, try refreshing the token
        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    // Retry the original request with the new token
                    originalRequest.headers['Authorization'] = 'Bearer ' + token;
                    return api(originalRequest);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // Send a request to refresh the token
                const res = await axios.get('/api/auth/refresh-token', { withCredentials: true });

                // The backend should now send a new access token (and optionally a new refresh token) in the cookies
                const newAccessToken = res.data.accessToken;  // You could ignore this since it's in the cookie
                processQueue(null, newAccessToken);  // Resolve all the failed requests with the new token

                // Retry the original request after refresh
                return api(originalRequest);
            } catch (err) {
                processQueue(err, null);  // Reject all failed requests
                window.location.href = '/login';  // Redirect user to login if refresh fails
                return Promise.reject(err);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);
