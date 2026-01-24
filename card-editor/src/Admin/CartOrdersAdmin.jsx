import React, { useEffect, useMemo, useState } from "react";
import "./AdminContainer.scss";
import { useSelector } from "react-redux";
import { fetchCartAdminById, fetchCartAdminList } from "../http/cart";
import CartOrderDetails from "./CartOrderDetails";

const formatDateTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
};

const CartOrdersAdmin = () => {
  const { isAdmin } = useSelector((state) => state.user);

  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [error, setError] = useState("");

  const rows = useMemo(() => {
    return Array.isArray(orders) ? orders : [];
  }, [orders]);

  useEffect(() => {
    if (!isAdmin) return;

    let isCancelled = false;
    (async () => {
      setIsLoadingList(true);
      setError("");
      try {
        const data = await fetchCartAdminList();
        if (isCancelled) return;
        setOrders(Array.isArray(data) ? data : []);
      } catch (e) {
        if (isCancelled) return;
        setError(e?.response?.data?.message || e?.message || "Failed to load cart orders");
      } finally {
        if (!isCancelled) setIsLoadingList(false);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [isAdmin]);

  const loadDetails = async (id) => {
    if (!id) return;
    setSelectedId(id);
    setSelectedOrder(null);
    setIsLoadingDetails(true);
    setError("");
    try {
      const data = await fetchCartAdminById(id);
      setSelectedOrder(data || null);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Failed to load order details");
    } finally {
      setIsLoadingDetails(false);
    }
  };

  if (!isAdmin) return <>У вас не достатньо прав</>;

  return (
    <>
      <div
        style={{
          alignItems: "flex-end",
          display: "flex",
          justifyContent: "right",
          marginBottom: "15px",
          gap: "30px",
        }}
        className="end"
      >
        <div style={{ fontWeight: 600 }}>Cart Orders (Mongo)</div>
      </div>

      {error ? (
        <div style={{ marginBottom: 12, color: "#b00020" }}>{error}</div>
      ) : null}

      <div className="admin-container">
        <div className="left">
          <div className="selects">
            <div className="select-cont">
              <p>Status</p>
              <select disabled>
                <option>All</option>
              </select>
            </div>
            <div className="select-cont">
              <p>Filter</p>
              <input disabled />
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Created</th>
                <th>Order ID</th>
                <th>Cust No</th>
                <th>Project</th>
                <th>Order Sum</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingList ? (
                <tr>
                  <td colSpan={6} style={{ padding: 12 }}>
                    Loading...
                  </td>
                </tr>
              ) : rows.length ? (
                rows.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => loadDetails(order.id)}
                    style={{ cursor: "pointer", opacity: selectedId === order.id ? 0.75 : 1 }}
                  >
                    <td>{formatDateTime(order.createdAt)}</td>
                    <td className="order-no">{order.id}</td>
                    <td>{order.userId}</td>
                    <td>{order.projectName}</td>
                    <td>{typeof order.totalPrice === "number" ? order.totalPrice.toFixed(2) : order.totalPrice}</td>
                    <td>{order.status}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: 12 }}>
                    No cart orders yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="right">
          <CartOrderDetails order={selectedOrder} isLoading={isLoadingDetails} />
        </div>
      </div>
    </>
  );
};

export default CartOrdersAdmin;
