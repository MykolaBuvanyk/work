import { $authHost } from "./index";

export async function addProjectToCart(payload) {
  try{
    console.log(4234324);
    const MySqlOrderId=localStorage.getItem('MySqlOrderId');
        console.log(8234324);
    if(MySqlOrderId){
      
      const res=await $authHost.get('cart/isBisy/'+MySqlOrderId);
      console.log(92343249324,res);
      if(res.data.isBisy)return true;
    }
    const { data } = await $authHost.post("cart", payload);

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


