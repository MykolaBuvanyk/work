import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './Industries.module.css';
import Link from '../Localized/LocalizedLink';

const INDUSTRY_SECTIONS = [
  {
    titleKey: 'industries.sections.mep-building-services.title',
    slug: 'mep-building-services',
    image: '/images/industries/mep-building-services.jpg',
    reverse: false,
    items: [
      {
        labelKey: 'industries.sections.mep-building-services.items.electrical-installation',
        slug: 'electrical-installation',
      },
      {
        labelKey: 'industries.sections.mep-building-services.items.sprinkler-installations',
        slug: 'sprinkler-installations',
      },
      {
        labelKey: 'industries.sections.mep-building-services.items.fire-installation',
        slug: 'fire-installation',
      },
      {
        labelKey: 'industries.sections.mep-building-services.items.refrigeration-installations',
        slug: 'refrigeration-installations',
      },
      {
        labelKey: 'industries.sections.mep-building-services.items.ventilation-installations',
        slug: 'ventilation-installations',
      },
      {
        labelKey: 'industries.sections.mep-building-services.items.elevators-and-lift-systems',
        slug: 'elevators-and-lift-systems',
      },
      {
        labelKey: 'industries.sections.mep-building-services.items.electrical-and-control-cabinets',
        slug: 'electrical-and-control-cabinets',
      },
      {
        labelKey: 'industries.sections.mep-building-services.items.electrical-in-control-and-building-automation',
        slug: 'electrical-in-control-and-building-automation',
      },
      {
        labelKey: 'industries.sections.mep-building-services.items.plumbing-installations-across',
        slug: 'plumbing-installations-across',
      },
    ],
  },
  {
    titleKey: 'industries.sections.security-automation.title',
    slug: 'security-automation',
    image: '/images/industries/security-automation.jpg',
    reverse: true,
    items: [
      {
        labelKey: 'industries.sections.security-automation.items.alarm-and-security-installations',
        slug: 'alarm-and-security-installations',
      },
      {
        labelKey: 'industries.sections.security-automation.items.robotics-industry',
        slug: 'robotics-industry',
      },
      {
        labelKey: 'industries.sections.security-automation.items.production-lines',
        slug: 'production-lines',
      },
      {
        labelKey: 'industries.sections.security-automation.items.industrial-maintenance',
        slug: 'industrial-maintenance',
      },
      {
        labelKey: 'industries.sections.security-automation.items.hydraulic-systems-and-fluid-technology',
        slug: 'hydraulic-systems-and-fluid-technology',
      },
    ],
  },
  {
    titleKey: 'industries.sections.energy-environment.title',
    slug: 'energy-environment',
    image: '/images/industries/energy-environment.jpg',
    reverse: false,
    items: [
      {
        labelKey: 'industries.sections.energy-environment.items.solar-energy-and-photovoltaics',
        slug: 'solar-energy-and-photovoltaics',
      },
      {
        labelKey: 'industries.sections.energy-environment.items.nuclear-power',
        slug: 'nuclear-power',
      },
      {
        labelKey: 'industries.sections.energy-environment.items.hydropower',
        slug: 'hydropower',
      },
      {
        labelKey: 'industries.sections.energy-environment.items.combined-heat-and-power-plants',
        slug: 'combined-heat-and-power-plants',
      },
      {
        labelKey: 'industries.sections.energy-environment.items.biogas',
        slug: 'biogas',
      },
      {
        labelKey: 'industries.sections.energy-environment.items.waste-stations',
        slug: 'waste-stations',
      },
      {
        labelKey: 'industries.sections.energy-environment.items.wastewater-treatment-plants',
        slug: 'wastewater-treatment-plants',
      },
      {
        labelKey: 'industries.sections.energy-environment.items.power-grids',
        slug: 'power-grids',
      },
    ],
  },
  {
    titleKey: 'industries.sections.infrastructure-mobility.title',
    slug: 'infrastructure-mobility',
    image: '/images/industries/infrastructure-mobility.jpg',
    reverse: true,
    items: [
      {
        labelKey: 'industries.sections.infrastructure-mobility.items.rail-industry',
        slug: 'rail-industry',
      },
      {
        labelKey: 'industries.sections.infrastructure-mobility.items.railway-infrastructure',
        slug: 'railway-infrastructure',
      },
      {
        labelKey: 'industries.sections.infrastructure-mobility.items.airports',
        slug: 'airports',
      },
      {
        labelKey: 'industries.sections.infrastructure-mobility.items.ports',
        slug: 'ports',
      },
      {
        labelKey: 'industries.sections.infrastructure-mobility.items.tunnels-and-bridges',
        slug: 'tunnels-and-bridges',
      },
      {
        labelKey: 'industries.sections.infrastructure-mobility.items.ships-and-offshore-industry',
        slug: 'ships-and-offshore-industry',
      },
      {
        labelKey: 'industries.sections.infrastructure-mobility.items.charging-infrastructure-for-electric-vehicles',
        slug: 'charging-infrastructure-for-electric-vehicles',
      },
      {
        labelKey: 'industries.sections.infrastructure-mobility.items.construction-projects',
        slug: 'construction-projects',
      },
      {
        labelKey: 'industries.sections.infrastructure-mobility.items.architecture-and-construction',
        slug: 'architecture-and-construction',
      },
    ],
  },
  {
    titleKey: 'industries.sections.manufacturing-heavy-industry.title',
    slug: 'manufacturing-heavy-industry',
    image: '/images/industries/manufacturing-heavy-industry.jpg',
    reverse: false,
    items: [
      {
        labelKey: 'industries.sections.manufacturing-heavy-industry.items.automotive-industry-signage-and-labeling',
        slug: 'automotive-industry-signage-and-labeling',
      },
      {
        labelKey: 'industries.sections.manufacturing-heavy-industry.items.aviation-industry',
        slug: 'aviation-industry',
      },
      {
        labelKey: 'industries.sections.manufacturing-heavy-industry.items.electronics-industry-signage-and-labeling',
        slug: 'electronics-industry-signage-and-labeling',
      },
      {
        labelKey: 'industries.sections.manufacturing-heavy-industry.items.steel-and-metal-industry',
        slug: 'steel-and-metal-industry',
      },
      {
        labelKey: 'industries.sections.manufacturing-heavy-industry.items.mining-industry',
        slug: 'mining-industry',
      },
      {
        labelKey: 'industries.sections.manufacturing-heavy-industry.items.pulp-and-paper-industry',
        slug: 'pulp-and-paper-industry',
      },
      {
        labelKey: 'industries.sections.manufacturing-heavy-industry.items.machinery-industry',
        slug: 'machinery-industry',
      },
      {
        labelKey: 'industries.sections.manufacturing-heavy-industry.items.tool-manufacturing-and-fitness-equipment',
        slug: 'tool-manufacturing-and-fitness-equipment',
      },
      {
        labelKey: 'industries.sections.manufacturing-heavy-industry.items.battery-factories',
        slug: 'battery-factories',
      },
    ],
  },
  {
    titleKey: 'industries.sections.it-telecom.title',
    slug: 'it-telecom',
    image: '/images/industries/it-telecom.jpg',
    reverse: true,
    items: [
      {
        labelKey: 'industries.sections.it-telecom.items.tele-and-data-installations',
        slug: 'tele-and-data-installations',
      },
      {
        labelKey: 'industries.sections.it-telecom.items.telecom',
        slug: 'telecom',
      },
      {
        labelKey: 'industries.sections.it-telecom.items.it-infrastructure-and-data-centers',
        slug: 'it-infrastructure-and-data-centers',
      },
    ],
  },
  {
    titleKey: 'industries.sections.branding-industrial-labeling.title',
    slug: 'branding-industrial-labeling',
    image: '/images/industries/branding-industrial-labeling.jpg',
    reverse: false,
    items: [
      {
        labelKey: 'industries.sections.branding-industrial-labeling.items.food-industry-safety-hygiene-and-efficiency',
        slug: 'food-industry-safety-hygiene-and-efficiency',
      },
      {
        labelKey: 'industries.sections.branding-industrial-labeling.items.furniture-and-kitchen-manufacturing',
        slug: 'furniture-and-kitchen-manufacturing',
      },
      {
        labelKey: 'industries.sections.branding-industrial-labeling.items.warehouse-logistics-and-industrial-facilities',
        slug: 'warehouse-logistics-and-industrial-facilities',
      },
      {
        labelKey: 'industries.sections.branding-industrial-labeling.items.medical-and-healthcare',
        slug: 'medical-and-healthcare',
      },
      {
        labelKey: 'industries.sections.branding-industrial-labeling.items.oils-lubricants-and-industrial-fluids',
        slug: 'oils-lubricants-and-industrial-fluids',
      },
      {
        labelKey: 'industries.sections.branding-industrial-labeling.items.branding-and-event-identity',
        slug: 'branding-and-event-identity',
      },
      {
        labelKey: 'industries.sections.branding-industrial-labeling.items.packaging-industry',
        slug: 'packaging-industry',
      },
      {
        labelKey: 'industries.sections.branding-industrial-labeling.items.our-technologies-and-materials',
        slug: 'our-technologies-and-materials',
      },
      {
        labelKey: 'industries.sections.branding-industrial-labeling.items.packaging-systems-and-food-engineering',
        slug: 'packaging-systems-and-food-engineering',
      },
    ],
  },
];

const getLangPrefix = (pathname = '') => {
  const match = String(pathname).match(/^\/([a-z]{2})(\/|$)/i);
  return match ? `/${match[1]}` : '';
};

const Industries = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const prefix = getLangPrefix(pathname);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.pageTitle}>{t('industries.title')}</h1>

        {INDUSTRY_SECTIONS.map((section, index) => (
          <React.Fragment key={section.slug}>
            <section
              className={`${styles.industryRow} ${section.reverse ? styles.reverse : ''}`.trim()}
            >
              {!section.reverse && (
                <div className={styles.industryMedia}>
                  <img src={section.image} alt={t(section.titleKey)} />
                  <h2>{t(section.titleKey)}</h2>
                </div>
              )}

              <div className={styles.industryContent}>
                <ul>
                  {section.items.map((item) => (
                    <li key={typeof item === 'string' ? item : item.slug}>
                      {typeof item === 'string' ? (
                        item
                      ) : (
                        <Link
                          className={styles.itemLink}
                          to={`${prefix}/industries/${section.slug}/${item.slug}`}
                        >
                          {t(item.labelKey)}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {section.reverse && (
                <div className={styles.industryMedia}>
                  <img src={section.image} alt={t(section.titleKey)} />
                  <h2>{t(section.titleKey)}</h2>
                </div>
              )}
            </section>

            {index < INDUSTRY_SECTIONS.length - 1 && <hr className={styles.separator} />}
          </React.Fragment>
        ))}
      </div>
    </main>
  );
};

export default Industries;
