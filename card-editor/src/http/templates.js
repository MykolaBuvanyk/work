import { $authHost, $host } from "./index";

export async function fetchTemplates() {
  const { data } = await $host.get("templates");
  return data;
}

export async function fetchTemplateById(id) {
  if (!id) throw new Error("Template id is required");
  const { data } = await $host.get(`templates/${id}`);
  return data;
}

export async function createTemplate(name, canvasSnapshot) {
  const { data } = await $authHost.post("templates", {
    name,
    canvas: canvasSnapshot,
  });
  return data;
}

export async function updateTemplate(id, name) {
  const { data } = await $authHost.patch(`templates/${id}`, { name });
  return data;
}

export async function deleteTemplate(id) {
  const { data } = await $authHost.delete(`templates/${id}`);
  return data;
}
