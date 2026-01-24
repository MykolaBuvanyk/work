import { $authHost } from "./index";

export async function addProjectToCart(payload) {
  const { data } = await $authHost.post("cart", payload);
  return data;
}

export async function fetchCartAdminList() {
  const { data } = await $authHost.get("cart/admin");
  return data;
}

export async function fetchCartAdminById(id) {
  const { data } = await $authHost.get(`cart/admin/${id}`);
  return data;
}
