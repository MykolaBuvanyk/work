import React, { useMemo, useState } from "react";
import styles from "./InfoAboutProject.module.css";
import { useCurrentSignPrice } from "../../hooks/useCurrentSignPrice";
import { useSelector } from "react-redux";
import CartAuthModal from "../CartAuthModal/CartAuthModal";
import { useCanvasContext } from "../../contexts/CanvasContext";
import CartSaveProjectModal from "../CartSaveProjectModal/CartSaveProjectModal";
import SaveAsModal from "../SaveAsModal/SaveAsModal";
import { saveNewProject } from "../../utils/projectStorage";
import { saveCurrentProject } from "../../utils/projectStorage";
import { addProjectToCart } from "../../http/cart";

const InfoAboutProject = () => {
  const { isAuth } = useSelector((state) => state.user);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSaveProjectModalOpen, setIsSaveProjectModalOpen] = useState(false);
  const [isSaveAsModalOpen, setIsSaveAsModalOpen] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const { designs, canvas } = useCanvasContext();

  const { price, discountPercent, discountAmount, totalPrice, isLoading } =
    useCurrentSignPrice();

  const formatted = `€ ${Number(price || 0).toFixed(2)}`;
  const formattedDiscount = `€ ${Number(discountAmount || 0).toFixed(2)}`;
  const formattedTotal = `€ ${Number(totalPrice || 0).toFixed(2)}`;

  const projectsCount = useMemo(() => {
    if (!Array.isArray(designs) || designs.length === 0) return 0;

    return designs.reduce((sum, design) => {
      const raw = design?.copiesCount ?? design?.toolbarState?.copiesCount ?? 1;
      const count = Number(raw);
      return sum + (Number.isFinite(count) && count > 0 ? count : 1);
    }, 0);
  }, [designs]);

  const onCartClick = async () => {
    if (!isAuth) {
      setIsAuthModalOpen(true);
      return;
    }

    // Require saved project before cart
    let currentProjectId = null;
    try {
      currentProjectId = localStorage.getItem("currentProjectId");
    } catch {}

    if (!currentProjectId) {
      setIsSaveProjectModalOpen(true);
      return;
    }

    if (!canvas || isAddingToCart) return;

    setIsAddingToCart(true);
    try {
      // Ensure latest canvas state is persisted into the current project before sending
      const project = await saveCurrentProject(canvas);

      const accessoriesAll =
        typeof window !== "undefined" && typeof window.getSelectedAccessories === "function"
          ? window.getSelectedAccessories() || []
          : [];

      const accessoriesSelected = Array.isArray(accessoriesAll)
        ? accessoriesAll
            .filter((x) => x && (x.checked || Number(x.qty) > 0))
            .map((x) => ({
              id: x.id,
              name: x.name,
              qty: x.qty,
              price: x.price,
              desc: x.desc,
            }))
        : [];

      const payload = {
        projectId: project?.id || currentProjectId,
        projectName: project?.name || "Untitled",
        price: Number(price || 0),
        discountPercent: Number(discountPercent || 0),
        discountAmount: Number(discountAmount || 0),
        totalPrice: Number(totalPrice || 0),
        project,
        accessories: accessoriesSelected,
      };

      await addProjectToCart(payload);
      alert("Project added to cart");
    } catch (e) {
      console.error("Failed to add to cart", e);
      alert("Failed to add project to cart. Please try again.");
    } finally {
      setIsAddingToCart(false);
    }
  };

  return (
    <div className={styles.infoAboutProject}>
      <div className={styles.infoAboutProjectEl}>
        <h3 className={styles.title}>Projects: {projectsCount}</h3>
        <button
          className={styles.cartButton}
          onClick={onCartClick}
          type="button"
          disabled={isAddingToCart}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 22 22"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g clip-path="url(#clip0_122_647)">
              <path
                d="M1.86288 1.59688C1.73226 1.07448 1.2029 0.756878 0.680498 0.887491C0.158101 1.0181 -0.159503 1.54747 -0.0288913 2.06987L1.86288 1.59688ZM5.2855 15.3866L5.87156 14.6074L5.2855 15.3866ZM2.76984 9.39747L3.71799 9.17023L2.76984 9.39747ZM5.12058 15.2566L5.74173 14.505L5.12058 15.2566ZM20.1846 9.84737L21.1327 10.0746L20.1846 9.84737ZM18.2326 14.9944L17.5495 14.2986L18.2326 14.9944ZM17.454 15.6084L17.9714 16.4348L17.454 15.6084ZM20.1139 6.19302L20.7831 5.48392L20.1139 6.19302ZM20.4455 6.61347L21.291 6.12798L20.4455 6.61347ZM12.8338 9.10837C12.2953 9.10837 11.8588 9.5449 11.8588 10.0834C11.8588 10.6219 12.2953 11.0584 12.8338 11.0584V9.10837ZM15.5838 11.8584C15.0453 11.8584 14.6088 12.2949 14.6088 12.8334C14.6088 13.3719 15.0453 13.8084 15.5838 13.8084V11.8584ZM1.882 5.69302V6.66802H16.9082V5.69302V4.71802H1.882V5.69302ZM11.9938 16.3071V15.3321H11.5311V16.3071V17.2821H11.9938V16.3071ZM2.76984 9.39747L3.71799 9.17023L2.83015 5.46578L1.882 5.69302L0.93385 5.92026L1.82169 9.62472L2.76984 9.39747ZM1.882 5.69302L2.82788 5.45653L1.86288 1.59688L0.916992 1.83337L-0.0288913 2.06987L0.936115 5.92952L1.882 5.69302ZM11.5311 16.3071V15.3321C9.83414 15.3321 8.64499 15.3305 7.72431 15.2235C6.82829 15.1194 6.29369 14.9249 5.87156 14.6074L5.2855 15.3866L4.69943 16.1658C5.50105 16.7688 6.41531 17.0345 7.49919 17.1605C8.5584 17.2836 9.88019 17.2821 11.5311 17.2821V16.3071ZM2.76984 9.39747L1.82169 9.62472C2.20647 11.2302 2.51305 12.5159 2.87964 13.5173C3.25476 14.5419 3.72628 15.3691 4.49944 16.0081L5.12058 15.2566L5.74173 14.505C5.33459 14.1685 5.02089 13.694 4.71079 12.8469C4.39215 11.9765 4.11351 10.8205 3.71799 9.17023L2.76984 9.39747ZM5.2855 15.3866L5.87156 14.6074C5.82751 14.5743 5.78422 14.5402 5.74173 14.505L5.12058 15.2566L4.49944 16.0081C4.56489 16.0622 4.63157 16.1148 4.69943 16.1658L5.2855 15.3866ZM11.9938 16.3071V17.2821C13.4221 17.2821 14.5658 17.2832 15.4897 17.1898C16.4332 17.0944 17.2387 16.8936 17.9714 16.4348L17.454 15.6084L16.9366 14.7821C16.5535 15.0219 16.077 15.1704 15.2935 15.2497C14.4903 15.3309 13.4617 15.3321 11.9938 15.3321V16.3071ZM18.2326 14.9944L17.5495 14.2986C17.3633 14.4815 17.1578 14.6436 16.9366 14.7821L17.454 15.6084L17.9714 16.4348C18.3122 16.2215 18.6287 15.9718 18.9156 15.6902L18.2326 14.9944ZM16.9082 5.69302V6.66802C17.8255 6.66802 18.424 6.66974 18.8633 6.72334C19.2865 6.77498 19.3992 6.85912 19.4447 6.90211L20.1139 6.19302L20.7831 5.48392C20.2988 5.02692 19.7007 4.86106 19.0994 4.7877C18.5143 4.7163 17.7749 4.71802 16.9082 4.71802V5.69302ZM20.1846 9.84737L21.1327 10.0746C21.3347 9.23184 21.5087 8.51315 21.5757 7.92752C21.6444 7.32577 21.6226 6.70541 21.291 6.12798L20.4455 6.61347L19.6 7.09896C19.6311 7.15328 19.6867 7.28249 19.6383 7.70606C19.588 8.14575 19.4502 8.72813 19.2364 9.62013L20.1846 9.84737ZM20.1139 6.19302L19.4447 6.90211C19.5058 6.95978 19.5581 7.0261 19.6 7.09896L20.4455 6.61347L21.291 6.12798C21.1541 5.88959 20.983 5.67259 20.7831 5.48392L20.1139 6.19302ZM19.2504 12.8334V11.8584H15.5838V12.8334V13.8084H19.2504V12.8334ZM20.128 10.0834V9.10837L12.8338 9.10837V10.0834V11.0584L20.128 11.0584V10.0834ZM20.1846 9.84737L19.2364 9.62013C19.2173 9.69993 19.1985 9.7785 19.1799 9.85594L20.128 10.0834L21.0761 10.3108C21.0947 10.2331 21.1136 10.1544 21.1327 10.0746L20.1846 9.84737ZM20.128 10.0834L19.1799 9.85594C18.9064 10.996 18.6967 11.8535 18.4784 12.5366L19.4071 12.8334L20.3359 13.1301C20.5804 12.3649 20.807 11.4325 21.0761 10.3108L20.128 10.0834ZM19.4071 12.8334L18.4784 12.5366C18.1858 13.4522 17.91 13.9448 17.5495 14.2986L18.2326 14.9944L18.9156 15.6902C19.6046 15.0138 20.0027 14.1728 20.3359 13.1301L19.4071 12.8334ZM19.2504 12.8334V13.8084H19.4071V12.8334V11.8584H19.2504V12.8334Z"
                fill="#1EA600"
              />
            </g>
            <defs>
              <clipPath id="clip0_122_647">
                <rect width="22" height="22" fill="white" />
              </clipPath>
            </defs>
          </svg>
          Cart
        </button>
      </div>
      <div className={styles.infoAboutProjectEl}>
        <p className={styles.para}>Current sign</p>
        <span className={styles.price}>{isLoading ? "…" : formatted}</span>
      </div>
      <div className={styles.infoAboutProjectEl}>
        <p className={styles.para}>
          Discount <span>({Number(discountPercent || 0).toFixed(0)}%)</span>
        </p>
        <span className={styles.price}>{isLoading ? "…" : formattedDiscount}</span>
      </div>
      <div className={styles.infoAboutProjectEl}>
        <p className={styles.para}>Total Price incl. VAT</p>
        <span className={styles.price}>{isLoading ? "…" : formattedTotal}</span>
      </div>

      <CartAuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      <CartSaveProjectModal
        isOpen={isSaveProjectModalOpen}
        onCancel={() => setIsSaveProjectModalOpen(false)}
        onSave={() => {
          setIsSaveProjectModalOpen(false);
          setIsSaveAsModalOpen(true);
        }}
      />

      {isSaveAsModalOpen && (
        <SaveAsModal
          onClose={() => setIsSaveAsModalOpen(false)}
          onSaveAs={async (name) => {
            if (!canvas) return;
            if (!name || !name.trim()) {
              alert("Please enter a project name");
              return;
            }

            try {
              const savedProject = await saveNewProject(name, canvas);
              if (savedProject && savedProject.id) {
                try {
                  localStorage.setItem("currentProjectId", savedProject.id);
                } catch {}
                window.dispatchEvent(
                  new CustomEvent("project:opened", {
                    detail: { projectId: savedProject.id },
                  })
                );
              }
              setIsSaveAsModalOpen(false);
            } catch (e) {
              console.error("Save as failed:", e);
              alert("Failed to save project. Please try again.");
            }
          }}
        />
      )}
    </div>
  );
};

export default InfoAboutProject;
