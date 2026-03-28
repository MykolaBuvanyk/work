import { $authHost } from './index';

export async function fetchMyProjects() {
  const { data } = await $authHost.get('projects');
  return Array.isArray(data) ? data : [];
}

export async function fetchMyProjectById(id) {
  const { data } = await $authHost.get(`projects/${id}`);
  return data || null;
}

export async function saveProjectAsMongo(payload) {
  const { data } = await $authHost.post('projects/save-as', payload || {});
  return data || null;
}

export async function updateMyProject(id, payload) {
  const { data } = await $authHost.put(`projects/${id}`, payload || {});
  return data || null;
}

export async function deleteMyProject(id) {
  const { data } = await $authHost.delete(`projects/${id}`);
  return data || null;
}