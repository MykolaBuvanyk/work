import { $authHost, $host } from "./index";

export async function fetchTemplates() {
  const { data } = await $host.get("templates");
  return data;
}

export async function fetchMyTemplates() {
  const { data } = await $authHost.get("templates/my");
  return data;
}

export async function fetchTemplateCategories() {
  const { data } = await $host.get("templates/categories");
  return data;
}

export async function fetchTemplateById(id) {
  if (!id) throw new Error("Template id is required");
  const { data } = await $host.get(`templates/${id}`);
  return data;
}

export async function fetchMyTemplateById(id) {
  if (!id) throw new Error("Template id is required");
  const { data } = await $authHost.get(`templates/my/${id}`);
  return data;
}

export async function createTemplate(name, canvasSnapshot, categoryId) {
  const payload = {
    name,
    canvas: canvasSnapshot,
  };
  if (categoryId) {
    payload.categoryId = categoryId;
  }

  const { data } = await $authHost.post("templates", payload);
  return data;
}

// Backward compatible:
// - updateTemplate(id, name)
// - updateTemplate(id, { name, categoryId })
export async function updateTemplate(id, payloadOrName) {
  const payload =
    payloadOrName && typeof payloadOrName === "object"
      ? payloadOrName
      : { name: payloadOrName };

  const { data } = await $authHost.patch(`templates/${id}`, payload);
  return data;
}

export async function deleteTemplate(id) {
  const { data } = await $authHost.delete(`templates/${id}`);
  return data;
}

export async function createTemplateCategory(name) {
  const { data } = await $authHost.post("templates/categories", { name });
  return data;
}

export async function updateTemplateCategory(id, name) {
  const { data } = await $authHost.patch(`templates/categories/${id}`, { name });
  return data;
}

export async function deleteTemplateCategory(id) {
  const { data } = await $authHost.delete(`templates/categories/${id}`);
  return data;
}
