import axios from 'axios';

const $host = axios.create({
  baseURL: import.meta.env.VITE_LAYOUT_API_SERVER,
});

const authInterceptor = config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

const $authHost = axios.create({
  baseURL: import.meta.env.VITE_LAYOUT_API_SERVER,
});

$authHost.interceptors.request.use(authInterceptor);

export { $host, $authHost };
