import React, { useState, useEffect } from 'react';
import { useCanvasContext } from '../../contexts/CanvasContext';
import * as fabric from 'fabric';
import styles from './IconMenu.module.css';

const IconMenu = () => {
    const { canvas } = useCanvasContext();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('Animals');
    const [isLoading, setIsLoading] = useState(false);
    const [availableIcons, setAvailableIcons] = useState({});

    // Список категорій
    const categories = [
        'Animals',
        'Arrows',
        'Basic_Shapes',
        'building',
        'Celebrations',
        'Chapter_Calendar',
        'Children',
        'Electronics',
        'Emoji',
        'Fire_Safety',
        'First_Aid',
        'Food',
        'frame',
        'frames',
        'Horoscope',
        'Mandatory',
        'Maritime',
        'Nature',
        'People',
        'Prohibition',
        'Tools',
        'Transport',
        'Warning',
        'Work_and_School',
    ];

    // Потенційні іконки за категоріями
    const potentialIcons = {
        Animals: Array.from({ length: 43 }, (_, i) => `Animals_${i}.svg`),
        Arrows: Array.from({ length: 7 }, (_, i) => `Arrows_${i}.svg`),
        Basic_Shapes: Array.from({ length: 20 }, (_, i) => `Basic_Shapes_${i}.svg`),
        building: Array.from({ length: 8 }, (_, i) => `building_${i + 1}.svg`),
        Celebrations: Array.from({ length: 50 }, (_, i) => `Celebrations_${i}.svg`),
        Chapter_Calendar: Array.from({ length: 5 }, (_, i) => `Chapter_Calendar_${i + 2}.svg`),
        Children: Array.from({ length: 11 }, (_, i) => `Children_${i}.svg`),
        Electronics: Array.from({ length: 34 }, (_, i) => `Electronics_${i}.svg`),
        Emoji: Array.from({ length: 50 }, (_, i) => `Emoji_${i}.svg`),
        Fire_Safety: Array.from({ length: 17 }, (_, i) => `Fire_Safety_${i}.svg`),
        First_Aid: Array.from({ length: 33 }, (_, i) => `First_Aid_${i}.svg`),
        Food: Array.from({ length: 50 }, (_, i) => `Food_${i}.svg`),
        frame: ['frame_1.svg'],
        frames: Array.from({ length: 49 }, (_, i) => `frames_${i + 1}.svg`)
            .filter(n => !['frames_10', 'frames_11', 'frames_21', 'frames_25'].some(m => n.includes(m))),
        Horoscope: Array.from({ length: 12 }, (_, i) => `Horoscope_${i + 1}.svg`),
        Mandatory: Array.from({ length: 34 }, (_, i) => `Mandatory_${i}.svg`),
        Maritime: Array.from({ length: 20 }, (_, i) => `Maritime_${i + 1}.svg`),
        Nature: Array.from({ length: 50 }, (_, i) => `Nature_${i}.svg`),
        People: Array.from({ length: 44 }, (_, i) => `People_${i}.svg`),
        Prohibition: Array.from({ length: 5 }, (_, i) => `Prohibition_${i}.svg`),
        Tools: Array.from({ length: 50 }, (_, i) => `Tools_${i}.svg`),
        Transport: Array.from({ length: 22 }, (_, i) => `Transport_${i}.svg`),
        Warning: Array.from({ length: 47 }, (_, i) => `Warning_${i}.svg`),
        Work_and_School: Array.from({ length: 19 }, (_, i) => `Work_and_School_${i}.svg`),
    };

    // Перевірка доступності іконок при завантаженні
    useEffect(() => {
        const checkAvailableIcons = async () => {
            const available = {};

            for (const [category, icons] of Object.entries(potentialIcons)) {
                available[category] = [];

                for (const icon of icons) {
                    try {
                        const iconPath = `/src/assets/images/icon/${icon}`;
                        const response = await fetch(iconPath);
                        if (response.ok) {
                            available[category].push(icon);
                        }
                    } catch (error) {
                        // Іконка недоступна, пропускаємо
                        console.warn(`Іконка ${icon} недоступна:`, error);
                    }
                }
            }

            setAvailableIcons(available);
        };

        checkAvailableIcons();
    }, []);

    // Функція для створення SVG об'єкта з тексту
    const createSVGFromText = (svgText, iconName) => {
        return new Promise((resolve, reject) => {
            // Очищаємо SVG текст
            const cleanedSvg = svgText
                .replace(/xmlns:xlink="[^"]*"/g, '')
                .replace(/xlink:href/g, 'href')
                .trim();
            console.log('SVG TEXT:', cleanedSvg);
            try {
                fabric.loadSVGFromString(cleanedSvg, (objects, options) => {
                    if (!objects || objects.length === 0) {
                        reject(new Error('Не вдалося розпарсити SVG'));
                        return;
                    }

                    let svgGroup;

                    // Перевіряємо чи є більше одного об'єкта
                    if (objects.length === 1) {
                        svgGroup = objects[0];
                    } else {
                        // Створюємо групу тільки якщо є кілька об'єктів
                        try {
                            svgGroup = new fabric.Group(objects, options || {});
                        } catch (groupError) {
                            console.warn('Не вдалося створити групу, використовуємо перший об\'єкт:', groupError);
                            svgGroup = objects[0];
                        }
                    }

                    // Налаштовуємо розмір та позицію
                    const targetSize = 80;
                    const bounds = svgGroup.getBoundingRect();
                    const scale = targetSize / Math.max(bounds.width, bounds.height);

                    svgGroup.set({
                        left: canvas.getWidth() / 2,
                        top: canvas.getHeight() / 2,
                        originX: 'center',
                        originY: 'center',
                        scaleX: scale,
                        scaleY: scale,
                    });

                    resolve(svgGroup);
                });
            } catch (error) {
                reject(error);
            }
        });
    };

    // Створення зображення як fallback
    const createImageFromSVG = (svgText, iconName) => {
        return new Promise((resolve, reject) => {
            const blob = new Blob([svgText], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);

            const img = new Image();
            img.onload = () => {
                const canvas2D = document.createElement('canvas');
                const ctx = canvas2D.getContext('2d');

                const size = 80;
                canvas2D.width = size;
                canvas2D.height = size;

                // Розраховуємо масштаб для збереження пропорцій
                const scale = Math.min(size / img.width, size / img.height);
                const scaledWidth = img.width * scale;
                const scaledHeight = img.height * scale;

                // Центруємо зображення
                const x = (size - scaledWidth) / 2;
                const y = (size - scaledHeight) / 2;

                ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

                URL.revokeObjectURL(url);

                // Створюємо Fabric зображення з canvas
                fabric.Image.fromURL(canvas2D.toDataURL(), (fabricImg) => {
                    fabricImg.set({
                        left: canvas.getWidth() / 2,
                        top: canvas.getHeight() / 2,
                        originX: 'center',
                        originY: 'center',
                    });
                    resolve(fabricImg);
                });
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Не вдалося завантажити зображення'));
            };

            img.src = url;
        });
    };

    // Основна функція додавання іконки
    const addIcon = async (iconName) => {
        if (!canvas) {
            console.error('Canvas недоступний');
            return;
        }

        setIsLoading(true);

        try {
            // Спробуємо завантажити SVG файл
            const iconPath = `/src/assets/images/icon/${iconName}`;
            const response = await fetch(iconPath);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const svgText = await response.text();

            // Спочатку пробуємо створити як SVG об'єкт
            try {
                const svgObject = await createSVGFromText(svgText, iconName);
                canvas.add(svgObject);
                canvas.setActiveObject(svgObject);
                canvas.renderAll();
                console.log(`Іконка ${iconName} додана як SVG об'єкт`);
            } catch (svgError) {
                console.warn(`Не вдалося створити SVG об'єкт для ${iconName}, пробуємо як зображення:`, svgError);

                // Fallback: створюємо як зображення
                try {
                    const imageObject = await createImageFromSVG(svgText, iconName);
                    canvas.add(imageObject);
                    canvas.setActiveObject(imageObject);
                    canvas.renderAll();
                    console.log(`Іконка ${iconName} додана як зображення`);
                } catch (imageError) {
                    console.error(`Не вдалося створити зображення для ${iconName}:`, imageError);
                    createPlaceholder(iconName);
                }
            }

        } catch (error) {
            console.error(`Помилка завантаження ${iconName}:`, error);
            createPlaceholder(iconName);
        } finally {
            setIsLoading(false);
            setIsOpen(false);
        }
    };

    // Створення placeholder
    const createPlaceholder = (iconName) => {
        const rect = new fabric.Rect({
            left: canvas.getWidth() / 2,
            top: canvas.getHeight() / 2,
            width: 80,
            height: 80,
            fill: '#f8f9fa',
            stroke: '#dee2e6',
            strokeWidth: 2,
            originX: 'center',
            originY: 'center',
            rx: 8,
            ry: 8,
        });

        const text = new fabric.Text(iconName.replace('.svg', ''), {
            left: canvas.getWidth() / 2,
            top: canvas.getHeight() / 2,
            fontSize: 12,
            fill: '#6c757d',
            textAlign: 'center',
            originX: 'center',
            originY: 'center',
            fontFamily: 'Arial, sans-serif',
        });

        const group = new fabric.Group([rect, text], {
            left: canvas.getWidth() / 2,
            top: canvas.getHeight() / 2,
            originX: 'center',
            originY: 'center',
        });

        canvas.add(group);
        canvas.setActiveObject(group);
        canvas.renderAll();
    };

    // Функція для отримання preview URL
    const getPreviewUrl = (iconName) => {
        return `/src/assets/images/icon/${iconName}`;
    };

    return (
        <div className={styles.iconMenu}>
            <button
                className={styles.toggleButton}
                onClick={() => setIsOpen(!isOpen)}
                disabled={isLoading}
            >
                {isLoading ? 'Завантаження...' : 'Додати іконку'}
            </button>

            {isOpen && (
                <div className={styles.dropdown}>
                    <div className={styles.header}>
                        <h3>Виберіть іконку</h3>
                        <button
                            className={styles.closeButton}
                            onClick={() => setIsOpen(false)}
                        >
                            ×
                        </button>
                    </div>

                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className={styles.categorySelect}
                    >
                        {categories.map((category) => (
                            <option key={category} value={category}>
                                {category} ({availableIcons[category]?.length || 0})
                            </option>
                        ))}
                    </select>

                    <div className={styles.iconGrid}>
                        {(availableIcons[selectedCategory] || []).map((icon) => (
                            <div
                                key={icon}
                                className={styles.iconItem}
                                onClick={() => addIcon(icon)}
                                title={icon}
                            >
                                <div className={styles.iconPreview}>
                                    <img
                                        src={getPreviewUrl(icon)}
                                        alt={icon}
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                        }}
                                    />
                                    <div className={styles.iconPlaceholder}>
                                        <span>{icon.split('.')[0]}</span>
                                    </div>
                                </div>
                                <span className={styles.iconName}>{icon.replace('.svg', '')}</span>
                            </div>
                        ))}
                    </div>

                    {(!availableIcons[selectedCategory] || availableIcons[selectedCategory].length === 0) && (
                        <div className={styles.noIcons}>
                            Іконки в цій категорії недоступні
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default IconMenu;