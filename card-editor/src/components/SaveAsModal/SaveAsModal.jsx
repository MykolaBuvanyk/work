import React, { useState, useEffect, useRef } from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import { useUndoRedo } from "../../hooks/useUndoRedo";
import { useExcelImport } from "../../hooks/useExcelImport";
import * as fabric from "fabric";
import styles from "./SaveAsModal.module.css";

const projects = [
  {
    id: 1,
    name: "Water Des Sol 01",
    date: "07 - 07 - 2025",
    images: [
      "../src/assets/images/image.png",
      "../src/assets/images/image2.png",
      "../src/assets/images/image3.png",
      "../src/assets/images/image.png",
    ],
  },
  {
    id: 2,
    name: "Water Des Sol 02",
    date: "07 - 07 - 2025",
    images: ["../src/assets/images/image.png"],
  },
  {
    id: 3,
    name: "Water Des Sol 03",
    date: "07 - 07 - 2025",
    images: ["../src/assets/images/image.png"],
  },
  {
    id: 4,
    name: "Water Des Sol 04",
    date: "07 - 07 - 2025",
    images: ["../src/assets/images/image.png"],
  },
  {
    id: 5,
    name: "Water Des Sol 05",
    date: "07 - 07 - 2025",
    images: ["../src/assets/images/image.png"],
  },
  {
    id: 6,
    name: "Water Des Sol 06",
    date: "07 - 07 - 2025",
    images: ["../src/assets/images/image.png"],
  },
  {
    id: 7,
    name: "Water Des Sol 07",
    date: "07 - 07 - 2025",
    images: ["../src/assets/images/image.png"],
  },
];

const SaveAsModal = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState("saved");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3; // по 3 записи на сторінку
  const [currentSlideIndex, setCurrentSlideIndex] = useState({});

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
  const totalPages = Math.ceil(projects.length / itemsPerPage);

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
  return (
    <div className={styles.yourProjectsModal}>
      <div className={styles.headerWrapper}>
        <div className={styles.headerWrapperText}>
          <p className={styles.para}>Save Project as</p>
          <p className={styles.name}>(Name)</p>
          <span>Water Des Sol 01</span>
        </div>
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
      <div className={styles.buttonsWrapper}>
        <button>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 19V5C3 3.89543 3.89543 3 5 3H16.1716C16.702 3 17.2107 3.21071 17.5858 3.58579L20.4142 6.41421C20.7893 6.78929 21 7.29799 21 7.82843V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19Z"
              stroke="#0BC944"
              stroke-width="1.5"
            />
            <path
              d="M8.6 9H15.4C15.7314 9 16 8.73137 16 8.4V3.6C16 3.26863 15.7314 3 15.4 3H8.6C8.26863 3 8 3.26863 8 3.6V8.4C8 8.73137 8.26863 9 8.6 9Z"
              stroke="#0BC944"
              stroke-width="1.5"
            />
            <path
              d="M6 13.6V21H18V13.6C18 13.2686 17.7314 13 17.4 13H6.6C6.26863 13 6 13.2686 6 13.6Z"
              stroke="#0BC944"
              stroke-width="1.5"
            />
          </svg>
          Save
        </button>
        <button>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12.0003 12L14.8287 14.8284M9.17188 14.8284L12.0003 12L9.17188 14.8284ZM14.8287 9.17157L12.0003 12L14.8287 9.17157ZM12.0003 12L9.17188 9.17157L12.0003 12Z"
              stroke="#FF0000"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
              stroke="#FF0000"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          Cancel
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
                </tr>
              );
            })}
          </tbody>
        </table>

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

export default SaveAsModal;
