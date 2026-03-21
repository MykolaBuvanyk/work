import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import styles from './Industries.module.css';

const ARTICLE_PAGE_MAP = {
  'infrastructure-mobility': {
    'rail-industry': {
      title: 'Rail Industry: Ensuring Safety and Efficiency',
      src: '/industry-pages/infrastructure-mobility/rail-industry/index.html',
      assetsBase: '/industry-pages/infrastructure-mobility/rail-industry',
    },
    'railway-infrastructure': {
      title: 'Railway Infrastructure: Durable Signage and Safe Operations',
      src: '/industry-pages/infrastructure-mobility/railway-infrastructure/index.html',
      assetsBase: '/industry-pages/infrastructure-mobility/railway-infrastructure',
    },
    airports: {
      title: 'Airports: Safety, Navigation, and Durable Signage',
      src: '/industry-pages/infrastructure-mobility/airports/index.html',
      assetsBase: '/industry-pages/infrastructure-mobility/airports',
    },
    ports: {
      title: 'Ports: Safe, Organized, and Durable Signage for Maritime Operations',
      src: '/industry-pages/infrastructure-mobility/ports/index.html',
      assetsBase: '/industry-pages/infrastructure-mobility/ports',
    },
    'tunnels-and-bridges': {
      title: 'Tunnels & Bridges: Durable Signage and Labeling',
      src: '/industry-pages/infrastructure-mobility/tunnels-and-bridges/index.html',
      assetsBase: '/industry-pages/infrastructure-mobility/tunnels-and-bridges',
    },
    'ships-and-offshore-industry': {
      title: 'Ships & Offshore Industry: Durable Safety and Clear Labeling',
      src: '/industry-pages/infrastructure-mobility/ships-and-offshore-industry/index.html',
      assetsBase: '/industry-pages/infrastructure-mobility/ships-and-offshore-industry',
    },
    'charging-infrastructure-for-electric-vehicles': {
      title: 'Charging Infrastructure for Electric Vehicles',
      src: '/industry-pages/infrastructure-mobility/charging-infrastructure-for-electric-vehicles/index.html',
      assetsBase: '/industry-pages/infrastructure-mobility/charging-infrastructure-for-electric-vehicles',
    },
    'construction-projects': {
      title: 'Construction Projects',
      src: '/industry-pages/infrastructure-mobility/construction-projects/index.html',
      assetsBase: '/industry-pages/infrastructure-mobility/construction-projects',
    },
    'architecture-and-construction': {
      title: 'Architecture and Construction',
      src: '/industry-pages/infrastructure-mobility/architecture-and-construction/index.html',
      assetsBase: '/industry-pages/infrastructure-mobility/architecture-and-construction',
    },
  },
  'energy-environment': {
    'solar-energy-and-photovoltaics': {
      title: 'Solar Energy and Photovoltaics: Durable UV-Resistant Labeling for Sustainable Power',
      src: '/industry-pages/energy-environment/solar-energy-and-photovoltaics/index.html',
      assetsBase: '/industry-pages/energy-environment/solar-energy-and-photovoltaics',
    },
    'nuclear-power': {
      title: 'Nuclear Power: Safe, Reliable, and Carbon-Free Energy',
      src: '/industry-pages/energy-environment/nuclear-power/index.html',
      assetsBase: '/industry-pages/energy-environment/nuclear-power',
    },
    hydropower: {
      title: 'Hydropower: Reliable and Renewable Energy',
      src: '/industry-pages/energy-environment/hydropower/index.html',
      assetsBase: '/industry-pages/energy-environment/hydropower',
    },
    'combined-heat-and-power-plants': {
      title: 'Combined Heat and Power Plants',
      src: '/industry-pages/energy-environment/combined-heat-and-power-plants/index.html',
      assetsBase: '/industry-pages/energy-environment/combined-heat-and-power-plants',
    },
    biogas: {
      title: 'Biogas: Sustainable Energy Production',
      src: '/industry-pages/energy-environment/biogas/index.html',
      assetsBase: '/industry-pages/energy-environment/biogas',
    },
    'waste-stations': {
      title: 'Waste Stations: Safe and Efficient Waste Management',
      src: '/industry-pages/energy-environment/waste-stations/index.html',
      assetsBase: '/industry-pages/energy-environment/waste-stations',
    },
    'wastewater-treatment-plants': {
      title: 'Wastewater Treatment Plants: Safe, Organized, and Durable Signage',
      src: '/industry-pages/energy-environment/wastewater-treatment-plants/index.html',
      assetsBase: '/industry-pages/energy-environment/wastewater-treatment-plants',
    },
    'power-grids': {
      title: 'Power Grids: Safe, Efficient, and Durable Signage',
      src: '/industry-pages/energy-environment/power-grids/index.html',
      assetsBase: '/industry-pages/energy-environment/power-grids',
    },
  },
  'mep-building-services': {
    'electrical-installation': {
      title: 'Electrical Installation',
      src: '/industry-pages/mep-building-services/electrical-installation/index.html',
      assetsBase: '/industry-pages/mep-building-services/electrical-installation',
    },
    'sprinkler-installations': {
      title: 'Sprinkler Installations',
      src: '/industry-pages/mep-building-services/sprinkler-installations/index.html',
      assetsBase: '/industry-pages/mep-building-services/sprinkler-installations',
    },
    'fire-installation': {
      title: 'Fire Installation',
      src: '/industry-pages/mep-building-services/fire-installation/index.html',
      assetsBase: '/industry-pages/mep-building-services/fire-installation',
    },
    'refrigeration-installations': {
      title: 'Refrigeration Installations',
      src: '/industry-pages/mep-building-services/refrigeration-installations/index.html',
      assetsBase: '/industry-pages/mep-building-services/refrigeration-installations',
    },
    'ventilation-installations': {
      title: 'Ventilation Installations',
      src: '/industry-pages/mep-building-services/ventilation-installations/index.html',
      assetsBase: '/industry-pages/mep-building-services/ventilation-installations',
    },
    'elevators-and-lift-systems': {
      title: 'Elevators and Lift Systems: Durable Identification and Passenger Safety',
      src: '/industry-pages/mep-building-services/elevators-and-lift-systems/index.html',
      assetsBase: '/industry-pages/mep-building-services/elevators-and-lift-systems',
    },
    'electrical-and-control-cabinets': {
      title: 'Electrical and Control Cabinets: Clear and Durable Labeling',
      src: '/industry-pages/mep-building-services/electrical-and-control-cabinets/index.html',
      assetsBase: '/industry-pages/mep-building-services/electrical-and-control-cabinets',
    },
    'electrical-in-control-and-building-automation': {
      title: 'Electrical in Control and Building Automation',
      src: '/industry-pages/mep-building-services/electrical-in-control-and-building-automation/index.html',
      assetsBase: '/industry-pages/mep-building-services/electrical-in-control-and-building-automation',
    },
    'plumbing-installations-across': {
      title: 'Plumbing Installations',
      src: '/industry-pages/mep-building-services/plumbing-installations-across/index.html',
      assetsBase: '/industry-pages/mep-building-services/plumbing-installations-across',
    },
  },
  'security-automation': {
    'alarm-and-security-installations': {
      title: 'Alarm and Security Installations',
      src: '/industry-pages/security-automation/alarm-and-security-installations/index.html',
      assetsBase: '/industry-pages/security-automation/alarm-and-security-installations',
    },
    'robotics-industry': {
      title: 'Robotics Industry: Clear Labeling for Safe and Efficient Automation',
      src: '/industry-pages/security-automation/robotics-industry/index.html',
      assetsBase: '/industry-pages/security-automation/robotics-industry',
    },
    'production-lines': {
      title: 'Production Lines: Optimized Safety and Efficiency',
      src: '/industry-pages/security-automation/production-lines/index.html',
      assetsBase: '/industry-pages/security-automation/production-lines',
    },
    'industrial-maintenance': {
      title: 'Industrial Maintenance: Safety, Efficiency, and Structured Operations',
      src: '/industry-pages/security-automation/industrial-maintenance/index.html',
      assetsBase: '/industry-pages/security-automation/industrial-maintenance',
    },
    'hydraulic-systems-and-fluid-technology': {
      title: 'Hydraulic Systems and Fluid Technology',
      src: '/industry-pages/security-automation/hydraulic-systems-and-fluid-technology/index.html',
      assetsBase: '/industry-pages/security-automation/hydraulic-systems-and-fluid-technology',
    },
  },
  'it-telecom': {
    'tele-and-data-installations': {
      title: 'Tele- and Data Installations',
      src: '/industry-pages/it-telecom/tele-and-data-installations/index.html',
      assetsBase: '/industry-pages/it-telecom/tele-and-data-installations',
    },
    telecom: {
      title: 'Telecom: Reliable Signage and Labeling',
      src: '/industry-pages/it-telecom/telecom/index.html',
      assetsBase: '/industry-pages/it-telecom/telecom',
    },
    'it-infrastructure-and-data-centers': {
      title: 'IT Infrastructure and Data Centers: Precision Labeling and High-Tech Identification',
      src: '/industry-pages/it-telecom/it-infrastructure-and-data-centers/index.html',
      assetsBase: '/industry-pages/it-telecom/it-infrastructure-and-data-centers',
    },
  },
};

const getLangPrefix = (pathname = '') => {
  const match = String(pathname).match(/^\/([a-z]{2})(\/|$)/i);
  return match ? `/${match[1]}` : '';
};

const resolvePublicPath = (path = '') => {
  if (!path) return path;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const baseUrl = import.meta.env.BASE_URL || '/';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.replace(/^\/+/, '');

  return `${normalizedBase}${normalizedPath}`;
};

const IndustryArticlePage = () => {
  const { sectionSlug, articleSlug } = useParams();
  const { pathname } = useLocation();
  const prefix = getLangPrefix(pathname);
  const [contentHtml, setContentHtml] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const article = useMemo(() => ARTICLE_PAGE_MAP[sectionSlug]?.[articleSlug], [articleSlug, sectionSlug]);

  if (!article) {
    return <Navigate to={`${prefix}/industries`} replace />;
  }

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        const response = await fetch(resolvePublicPath(article.src));
        if (!response.ok) {
          throw new Error('Failed to load article page');
        }

        const htmlText = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        const contentRoot = doc.querySelector('main.container .content') || doc.querySelector('.content');

        if (!contentRoot) {
          throw new Error('Article content not found');
        }

        contentRoot.querySelectorAll('img').forEach((img) => {
          const src = img.getAttribute('src') || '';
          if (src && !src.startsWith('/') && !src.startsWith('http://') && !src.startsWith('https://')) {
            img.setAttribute(
              'src',
              resolvePublicPath(`${article.assetsBase}/${src.replace(/^\.\//, '')}`)
            );
          }
        });

        if (!cancelled) {
          setContentHtml(contentRoot.innerHTML);
        }
      } catch (_error) {
        if (!cancelled) {
          setHasError(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [article]);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.pageTitle}>{article.title}</h1>

        {isLoading ? <p className={styles.articleState}>Loading...</p> : null}
        {hasError ? <p className={styles.articleState}>Failed to load article.</p> : null}

        {!isLoading && !hasError ? (
          <section className={styles.articleContent} dangerouslySetInnerHTML={{ __html: contentHtml }} />
        ) : null}
      </div>
    </main>
  );
};

export default IndustryArticlePage;
