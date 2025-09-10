import React, { useState, useEffect, useRef } from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import { useUndoRedo } from "../../hooks/useUndoRedo";
import { useExcelImport } from "../../hooks/useExcelImport";
import * as fabric from "fabric";
import styles from "./YourProjectsModal.module.css";
import { getAllProjects, deleteProject, formatDate, getProject } from "../../utils/projectStorage";



const YourProjectsModal = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState("saved");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3; // по 3 записи на сторінку
  const [currentSlideIndex, setCurrentSlideIndex] = useState({});
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    getAllProjects()
      .then((list) => {
        const mapped = (list || []).map((p) => ({
          id: p.id,
          name: p.name,
          date: formatDate(p.updatedAt || p.createdAt),
          images: (p.canvases || []).map((c) => c.preview).filter(Boolean),
        }));
        setProjects(mapped);
      })
      .catch(() => {});
  }, []);

  // 3. Ініціалізація слайдерів для кожного проекту
  useEffect(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentProjects = projects.slice(
      startIndex,
      startIndex + itemsPerPage
    );

    const initialSlides = {};
    currentProjects.forEach((project) => {
      initialSlides[project.id] = 0;
    });
    setCurrentSlideIndex(initialSlides);
  }, [currentPage, projects]);

  // 4. Логіка переключення слайдера
  const handleSlideChange = (projectId, direction) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project || project.images.length <= 3) return;

    setCurrentSlideIndex((prev) => {
      const currentIndex = prev[projectId] || 0;
      const maxSlides = Math.ceil(project.images.length / 3) - 1;

      let newIndex;
      if (direction === "next") {
        newIndex = currentIndex < maxSlides ? currentIndex + 1 : currentIndex;
      } else {
        newIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
      }

      return { ...prev, [projectId]: newIndex };
    });
  };

  // 5. Функція для отримання видимих зображень
  const getVisibleImages = (project) => {
    const startIndex = (currentSlideIndex[project.id] || 0) * 3;
    return project.images.slice(startIndex, startIndex + 3);
  };

  // 6. Перевірка чи потрібні кнопки слайдера
  const needsSliderButtons = (project) => {
    return project.images.length > 3;
  };
  // Вираховуємо кількість сторінок
  const totalPages = Math.max(1, Math.ceil((projects?.length || 0) / itemsPerPage));

  // Формуємо масив діапазонів для пагінації
  const ranges = [];
  for (let i = 0; i < totalPages; i++) {
    const start = i * itemsPerPage + 1;
    const end = Math.min((i + 1) * itemsPerPage, projects.length);
    ranges.push({ start, end, page: i + 1 });
  }

  // Поточні дані для відображення
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentProjects = projects.slice(startIndex, startIndex + itemsPerPage);

  const { canvas } = useCanvasContext();

  const handleDelete = async (id) => {
    try { await deleteProject(id); } catch {}
    try {
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch {}
  };

  const handleEdit = async (id) => {
    try {
      const project = await getProject(id);
      if (!project) return;
      try {
        localStorage.setItem("currentProjectId", project.id);
        localStorage.setItem("currentProjectName", project.name || "");
      } catch {}
      const first = project.canvases && project.canvases[0];
      if (first) {
        try { localStorage.setItem("currentCanvasId", first.id); } catch {}
        if (canvas && first.json && typeof canvas.loadFromJSON === "function") {
          canvas.__suspendUndoRedo = true;
          canvas.loadFromJSON(first.json, () => {
            try { canvas.renderAll(); } catch {}
            canvas.__suspendUndoRedo = false;
          });
        }
      } else if (canvas) {
        // Empty project - clear current canvas
        canvas.clear();
        canvas.renderAll();
        try { localStorage.removeItem("currentCanvasId"); } catch {}
      }
      try {
        window.dispatchEvent(new CustomEvent("project:switched", { detail: { projectId: project.id } }));
      } catch {}
      onClose && onClose();
    } catch (e) {
      console.error("Failed to open project", e);
    }
  };
  return (
    <div className={styles.yourProjectsModal}>
      <div className={styles.headerWrapper}>
        My Projects
        <svg
          onClick={onClose}
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12.0003 12L14.8287 14.8284M9.17188 14.8284L12.0003 12L9.17188 14.8284ZM14.8287 9.17157L12.0003 12L14.8287 9.17157ZM12.0003 12L9.17188 9.17157L12.0003 12Z"
            stroke="#006CA4"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
            stroke="#006CA4"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <div className={styles.addInfoWrapper}>
        You can choose from your saved projects and add them to your current
        projects or place an ORDER.
        <button>
          <svg
            width="23"
            height="22"
            viewBox="0 0 23 22"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g clip-path="url(#clip0_129_5336)">
              <path
                d="M2.36288 1.59688C2.23226 1.07448 1.7029 0.756878 1.1805 0.887491C0.658101 1.0181 0.340497 1.54747 0.471109 2.06987L1.41699 1.83337L2.36288 1.59688ZM5.7855 15.3866L6.37156 14.6074L5.7855 15.3866ZM3.26984 9.39747L4.21799 9.17023L3.26984 9.39747ZM5.62058 15.2566L6.24173 14.505L5.62058 15.2566ZM20.6846 9.84737L21.6327 10.0746L20.6846 9.84737ZM18.7326 14.9944L18.0495 14.2986L18.7326 14.9944ZM17.954 15.6084L18.4714 16.4348L17.954 15.6084ZM20.6139 6.19302L21.2831 5.48392L20.6139 6.19302ZM20.9455 6.61347L21.791 6.12798L20.9455 6.61347ZM13.3338 9.10837C12.7953 9.10837 12.3588 9.5449 12.3588 10.0834C12.3588 10.6219 12.7953 11.0584 13.3338 11.0584V10.0834V9.10837ZM16.0838 11.8584C15.5453 11.8584 15.1088 12.2949 15.1088 12.8334C15.1088 13.3719 15.5453 13.8084 16.0838 13.8084V12.8334V11.8584ZM2.382 5.69302V6.66802H17.4082V5.69302V4.71802H2.382V5.69302ZM12.4938 16.3071V15.3321H12.0311V16.3071V17.2821H12.4938V16.3071ZM3.26984 9.39747L4.21799 9.17023L3.33015 5.46578L2.382 5.69302L1.43385 5.92026L2.32169 9.62472L3.26984 9.39747ZM2.382 5.69302L3.32788 5.45653L2.36288 1.59688L1.41699 1.83337L0.471109 2.06987L1.43612 5.92952L2.382 5.69302ZM12.0311 16.3071V15.3321C10.3341 15.3321 9.14499 15.3305 8.22431 15.2235C7.32829 15.1194 6.79369 14.9249 6.37156 14.6074L5.7855 15.3866L5.19943 16.1658C6.00105 16.7688 6.91531 17.0345 7.99919 17.1605C9.0584 17.2836 10.3802 17.2821 12.0311 17.2821V16.3071ZM3.26984 9.39747L2.32169 9.62472C2.70647 11.2302 3.01305 12.5159 3.37964 13.5173C3.75476 14.5419 4.22628 15.3691 4.99944 16.0081L5.62058 15.2566L6.24173 14.505C5.83459 14.1685 5.52089 13.694 5.21079 12.8469C4.89215 11.9765 4.61351 10.8205 4.21799 9.17023L3.26984 9.39747ZM5.7855 15.3866L6.37156 14.6074C6.32751 14.5743 6.28422 14.5402 6.24173 14.505L5.62058 15.2566L4.99944 16.0081C5.06489 16.0622 5.13157 16.1148 5.19943 16.1658L5.7855 15.3866ZM12.4938 16.3071V17.2821C13.9221 17.2821 15.0658 17.2832 15.9897 17.1898C16.9332 17.0944 17.7387 16.8936 18.4714 16.4348L17.954 15.6084L17.4366 14.7821C17.0535 15.0219 16.577 15.1704 15.7935 15.2497C14.9903 15.3309 13.9617 15.3321 12.4938 15.3321V16.3071ZM18.7326 14.9944L18.0495 14.2986C17.8633 14.4815 17.6578 14.6436 17.4366 14.7821L17.954 15.6084L18.4714 16.4348C18.8122 16.2215 19.1287 15.9718 19.4156 15.6902L18.7326 14.9944ZM17.4082 5.69302V6.66802C18.3255 6.66802 18.924 6.66974 19.3633 6.72334C19.7865 6.77498 19.8992 6.85912 19.9447 6.90211L20.6139 6.19302L21.2831 5.48392C20.7988 5.02692 20.2007 4.86106 19.5994 4.7877C19.0143 4.7163 18.2749 4.71802 17.4082 4.71802V5.69302ZM20.6846 9.84737L21.6327 10.0746C21.8347 9.23184 22.0087 8.51315 22.0757 7.92752C22.1444 7.32577 22.1226 6.70541 21.791 6.12798L20.9455 6.61347L20.1 7.09896C20.1311 7.15328 20.1867 7.28249 20.1383 7.70606C20.088 8.14575 19.9502 8.72813 19.7364 9.62013L20.6846 9.84737ZM20.6139 6.19302L19.9447 6.90211C20.0058 6.95978 20.0581 7.0261 20.1 7.09896L20.9455 6.61347L21.791 6.12798C21.6541 5.88959 21.483 5.67259 21.2831 5.48392L20.6139 6.19302ZM19.7504 12.8334V11.8584H16.0838V12.8334V13.8084H19.7504V12.8334ZM20.628 10.0834V9.10837L13.3338 9.10837V10.0834V11.0584L20.628 11.0584V10.0834ZM20.6846 9.84737L19.7364 9.62013C19.7173 9.69993 19.6985 9.7785 19.6799 9.85594L20.628 10.0834L21.5761 10.3108C21.5947 10.2331 21.6136 10.1544 21.6327 10.0746L20.6846 9.84737ZM20.628 10.0834L19.6799 9.85594C19.4064 10.996 19.1967 11.8535 18.9784 12.5366L19.9071 12.8334L20.8359 13.1301C21.0804 12.3649 21.307 11.4325 21.5761 10.3108L20.628 10.0834ZM19.9071 12.8334L18.9784 12.5366C18.6858 13.4522 18.41 13.9448 18.0495 14.2986L18.7326 14.9944L19.4156 15.6902C20.1046 15.0138 20.5027 14.1728 20.8359 13.1301L19.9071 12.8334ZM19.7504 12.8334V13.8084H19.9071V12.8334V11.8584H19.7504V12.8334Z"
                fill="#1EA600"
              />
            </g>
            <defs>
              <clipPath id="clip0_129_5336">
                <rect
                  width="22"
                  height="22"
                  fill="white"
                  transform="translate(0.5)"
                />
              </clipPath>
            </defs>
          </svg>
          Cart
        </button>
      </div>
      <div className={styles.savedOrderedWrapper}>
        <button
          className={activeTab === "saved" ? styles.active : ""}
          onClick={() => setActiveTab("saved")}
        >
          Saved
        </button>
        <button
          className={activeTab === "ordered" ? styles.active : ""}
          onClick={() => setActiveTab("ordered")}
        >
          Ordered
        </button>
      </div>
      <div className={styles.projectsTableWrapper}>
        <table className={styles.table}>
          <tbody>
            <tr className={styles.tr}>
              <td></td>
              <td>Nr.</td>
              <td>Name</td>
              <td>Date</td>
              <td>Image</td>
              <td></td>
            </tr>

            {currentProjects.map((project, index) => {
              const imageWidth = 115; // Припускаємо, що ширина зображення 115px (54px висота + маржин)
              const marginRight = 10; // Відповідно до CSS margin-right: 10px
              const totalImageWidth = imageWidth + marginRight;

              return (
                <tr key={project.id} className={styles.tr}>
                  <td>
                    <input type="checkbox" />
                  </td>
                  <td>{startIndex + index + 1}</td>
                  <td>{project.name}</td>
                  <td>{project.date}</td>
                  <td>
                    <div className={styles.imageSlider}>
                      {needsSliderButtons(project) && (
                        <button
                          className={styles.prevBtn}
                          onClick={() => handleSlideChange(project.id, "prev")}
                          disabled={(currentSlideIndex[project.id] || 0) === 0}
                        >
                          &lt;&lt;
                        </button>
                      )}

                      <div className={styles.imagesContainer}>
                        {getVisibleImages(project).map((image, imgIndex) => (
                          <div key={imgIndex} className={styles.imageItem}>
                            <img
                              src={image}
                              alt={`Project ${project.name} image ${
                                imgIndex + 1
                              }`}
                            />
                          </div>
                        ))}
                      </div>

                      {needsSliderButtons(project) && (
                        <button
                          className={styles.nextBtn}
                          onClick={() => handleSlideChange(project.id, "next")}
                          disabled={
                            (currentSlideIndex[project.id] || 0) >=
                            Math.ceil(project.images.length / 3) - 1
                          }
                        >
                          &gt;&gt;
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    <ul className={styles.actionList}>
                      <li onClick={() => handleEdit(project.id)} style={{cursor:"pointer"}}>
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <g clip-path="url(#clip0_129_5317)">
                            <path
                              d="M5.83301 5.83331H4.99967C4.55765 5.83331 4.13372 6.00891 3.82116 6.32147C3.5086 6.63403 3.33301 7.05795 3.33301 7.49998V15C3.33301 15.442 3.5086 15.8659 3.82116 16.1785C4.13372 16.4911 4.55765 16.6666 4.99967 16.6666H12.4997C12.9417 16.6666 13.3656 16.4911 13.6782 16.1785C13.9907 15.8659 14.1663 15.442 14.1663 15V14.1666"
                              stroke="#006CA4"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            />
                            <path
                              d="M16.9875 5.48753C17.3157 5.15932 17.5001 4.71418 17.5001 4.25003C17.5001 3.78588 17.3157 3.34073 16.9875 3.01253C16.6593 2.68432 16.2142 2.49994 15.75 2.49994C15.2858 2.49994 14.8407 2.68432 14.5125 3.01253L7.5 10V12.5H10L16.9875 5.48753V5.48753Z"
                              stroke="#006CA4"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            />
                            <path
                              d="M13.333 4.16669L15.833 6.66669"
                              stroke="#006CA4"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            />
                          </g>
                          <defs>
                            <clipPath id="clip0_129_5317">
                              <rect width="20" height="20" fill="white" />
                            </clipPath>
                          </defs>
                        </svg>
                        Edit
                      </li>
                      <li onClick={() => handleDelete(project.id)} style={{cursor:"pointer"}}>
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M15.4307 10.6496L16.1735 10.753L15.4307 10.6496ZM15.2121 12.2205L15.9549 12.3238L15.2121 12.2205ZM4.78729 12.2205L5.53013 12.1171L4.78729 12.2205ZM4.56868 10.6496L3.82583 10.753L4.56868 10.6496ZM7.65271 18.114L7.36112 18.805L7.65271 18.114ZM5.39558 15.467L6.09956 15.2083L5.39558 15.467ZM14.6038 15.467L15.3078 15.7256H15.3078L14.6038 15.467ZM12.3466 18.114L12.055 17.4231L12.3466 18.114ZM4.91298 7.42908C4.8738 7.01672 4.50776 6.7142 4.0954 6.75338C3.68304 6.79256 3.38052 7.1586 3.4197 7.57096L4.16634 7.50002L4.91298 7.42908ZM16.5796 7.57096C16.6188 7.15861 16.3163 6.79256 15.9039 6.75338C15.4916 6.7142 15.1256 7.01672 15.0864 7.42908L15.833 7.50002L16.5796 7.57096ZM16.6663 6.58335C17.0806 6.58335 17.4163 6.24757 17.4163 5.83335C17.4163 5.41914 17.0806 5.08335 16.6663 5.08335V5.83335V6.58335ZM3.33301 5.08335C2.91879 5.08335 2.58301 5.41914 2.58301 5.83335C2.58301 6.24757 2.91879 6.58335 3.33301 6.58335V5.83335V5.08335ZM7.58301 15C7.58301 15.4142 7.91879 15.75 8.33301 15.75C8.74722 15.75 9.08301 15.4142 9.08301 15H8.33301H7.58301ZM9.08301 8.33335C9.08301 7.91914 8.74722 7.58335 8.33301 7.58335C7.91879 7.58335 7.58301 7.91914 7.58301 8.33335H8.33301H9.08301ZM10.9163 15C10.9163 15.4142 11.2521 15.75 11.6663 15.75C12.0806 15.75 12.4163 15.4142 12.4163 15H11.6663H10.9163ZM12.4163 8.33335C12.4163 7.91914 12.0806 7.58335 11.6663 7.58335C11.2521 7.58335 10.9163 7.91914 10.9163 8.33335H11.6663H12.4163ZM13.333 5.83335V6.58335H14.083V5.83335H13.333ZM6.66634 5.83335H5.91634V6.58335H6.66634V5.83335ZM15.4307 10.6496L14.6878 10.5462L14.4692 12.1171L15.2121 12.2205L15.9549 12.3238L16.1735 10.753L15.4307 10.6496ZM4.78729 12.2205L5.53013 12.1171L5.31152 10.5462L4.56868 10.6496L3.82583 10.753L4.04445 12.3238L4.78729 12.2205ZM9.99967 18.3334V17.5834C8.71414 17.5834 8.29056 17.5692 7.9443 17.4231L7.65271 18.114L7.36112 18.805C8.05427 19.0975 8.84888 19.0834 9.99967 19.0834V18.3334ZM4.78729 12.2205L4.04445 12.3238C4.27663 13.9922 4.40494 14.9454 4.69159 15.7256L5.39558 15.467L6.09956 15.2083C5.88243 14.6173 5.77314 13.8632 5.53013 12.1171L4.78729 12.2205ZM7.65271 18.114L7.9443 17.4231C7.21623 17.1158 6.52125 16.356 6.09956 15.2083L5.39558 15.467L4.69159 15.7256C5.21199 17.142 6.14549 18.2921 7.36112 18.805L7.65271 18.114ZM15.2121 12.2205L14.4692 12.1171C14.2262 13.8632 14.1169 14.6173 13.8998 15.2083L14.6038 15.467L15.3078 15.7256C15.5944 14.9454 15.7227 13.9922 15.9549 12.3238L15.2121 12.2205ZM9.99967 18.3334V19.0834C11.1505 19.0834 11.9451 19.0975 12.6382 18.805L12.3466 18.114L12.055 17.4231C11.7088 17.5692 11.2852 17.5834 9.99967 17.5834V18.3334ZM14.6038 15.467L13.8998 15.2083C13.4781 16.356 12.7831 17.1158 12.055 17.4231L12.3466 18.114L12.6382 18.805C13.8539 18.2921 14.7874 17.142 15.3078 15.7256L14.6038 15.467ZM4.56868 10.6496L5.31152 10.5462C5.12627 9.21509 4.98851 8.22405 4.91298 7.42908L4.16634 7.50002L3.4197 7.57096C3.49904 8.40599 3.64236 9.43461 3.82583 10.753L4.56868 10.6496ZM15.4307 10.6496L16.1735 10.753C16.357 9.4346 16.5003 8.40599 16.5796 7.57096L15.833 7.50002L15.0864 7.42908C15.0108 8.22404 14.8731 9.21508 14.6878 10.5462L15.4307 10.6496ZM16.6663 5.83335V5.08335H3.33301V5.83335V6.58335H16.6663V5.83335ZM8.33301 15H9.08301V8.33335H8.33301H7.58301V15H8.33301ZM11.6663 15H12.4163V8.33335H11.6663H10.9163V15H11.6663ZM13.333 5.00002H12.583V5.83335H13.333H14.083V5.00002H13.333ZM13.333 5.83335V5.08335H6.66634V5.83335V6.58335H13.333V5.83335ZM6.66634 5.83335H7.41634V5.00002H6.66634H5.91634V5.83335H6.66634ZM9.99967 1.66669V2.41669C11.4264 2.41669 12.583 3.57328 12.583 5.00002H13.333H14.083C14.083 2.74486 12.2548 0.916687 9.99967 0.916687V1.66669ZM9.99967 1.66669V0.916687C7.74451 0.916687 5.91634 2.74486 5.91634 5.00002H6.66634H7.41634C7.41634 3.57328 8.57294 2.41669 9.99967 2.41669V1.66669Z"
                            fill="#FF0000"
                          />
                        </svg>
                        Delete
                      </li>
                    </ul>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className={styles.addToCurrProject}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g clip-path="url(#clip0_129_5315)">
              <path
                d="M5 -0.5H13.043L13.543 0H5C4.46957 0 3.96101 0.210865 3.58594 0.585938C3.21086 0.96101 3 1.46957 3 2V20C3 20.5304 3.21087 21.039 3.58594 21.4141C3.96101 21.7891 4.46957 22 5 22H17C17.5304 22 18.039 21.7891 18.4141 21.4141C18.7891 21.039 19 20.5304 19 20V5.45703L19.5 5.95703V20C19.5 20.663 19.2364 21.2987 18.7676 21.7676C18.2987 22.2364 17.663 22.5 17 22.5H5C4.33696 22.5 3.70126 22.2364 3.23242 21.7676C2.76358 21.2987 2.5 20.663 2.5 20V2C2.5 1.33696 2.76358 0.701263 3.23242 0.232422C3.70126 -0.236419 4.33696 -0.5 5 -0.5ZM11 9.25C11.0663 9.25 11.1299 9.27636 11.1768 9.32324C11.2236 9.37013 11.25 9.43369 11.25 9.5V12.25H14C14.0663 12.25 14.1299 12.2764 14.1768 12.3232C14.2236 12.3701 14.25 12.4337 14.25 12.5C14.25 12.5663 14.2236 12.6299 14.1768 12.6768C14.1299 12.7236 14.0663 12.75 14 12.75H11.25V15.5C11.25 15.5663 11.2236 15.6299 11.1768 15.6768C11.1299 15.7236 11.0663 15.75 11 15.75C10.9337 15.75 10.8701 15.7236 10.8232 15.6768C10.7764 15.6299 10.75 15.5663 10.75 15.5V12.75H8C7.93369 12.75 7.87013 12.7236 7.82324 12.6768C7.77636 12.6299 7.75 12.5663 7.75 12.5C7.75 12.4337 7.77636 12.3701 7.82324 12.3232C7.87013 12.2764 7.93369 12.25 8 12.25H10.75V9.5C10.75 9.4337 10.7764 9.37013 10.8232 9.32324C10.8701 9.27636 10.9337 9.25 11 9.25ZM18.793 5.25H15.5C15.0359 5.25 14.5909 5.06549 14.2627 4.7373C13.9345 4.40912 13.75 3.96413 13.75 3.5V0.207031L18.793 5.25Z"
                fill="#34C759"
                stroke="#017F01"
              />
            </g>
            <defs>
              <clipPath id="clip0_129_5315">
                <rect width="24" height="24" fill="white" />
              </clipPath>
            </defs>
          </svg>
          Add to current project
        </div>
        {/* Пагінація */}
        {projects.length > itemsPerPage && (
          <div className={styles.pagination}>
            <button
              className={styles.pageBtn}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
            >
              &lt;&lt;
            </button>

            {ranges.map((range) => (
              <button
                key={range.page}
                className={`${styles.pageBtn} ${
                  currentPage === range.page ? styles.activePage : ""
                }`}
                onClick={() => setCurrentPage(range.page)}
              >
                {range.start}–{range.end}
              </button>
            ))}

            <button
              className={styles.pageBtn}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              &gt;&gt;
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default YourProjectsModal;
