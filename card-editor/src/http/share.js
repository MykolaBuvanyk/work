import { $authHost, $host } from './index';

export async function createShareLink(payload) {
  const { data } = await $authHost.post('share', payload);
  return data;
}

export async function fetchSharedProjectByToken(token) {
  const { data } = await $host.get(`share/${token}`);
  return data;
}

export async function markSharedProjectCopied(token) {
  const { data } = await $authHost.post(`share/${token}/copied`);
  return data;
}
