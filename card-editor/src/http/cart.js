import { $authHost } from "./index";

export async function addProjectToCart(payload) {
  try{
  const { data } = await $authHost.post("cart", payload);
  console.log(823843248324,data);
  localStorage.setItem('MySqlOrderId',data.order.id);
  return data;
  }catch(err){
    console.log(823843248324,err);
  }
}

export async function fetchCartAdminList() {
  const { data } = await $authHost.get("cart/admin");
  return data;
}

export async function fetchCartAdminById(id) {
  const { data } = await $authHost.get(`cart/admin/${id}`);
  return data;
}


