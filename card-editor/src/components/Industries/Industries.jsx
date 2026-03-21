import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './Industries.module.css';

const INDUSTRY_SECTIONS = [
  {
    title: 'MEP & Building Services',
    slug: 'mep-building-services',
    image: '/images/industries/mep-building-services.jpg',
    reverse: false,
    items: [
      {
        label: 'Electrical Installation',
        slug: 'electrical-installation',
      },
      {
        label: 'Sprinkler Installations',
        slug: 'sprinkler-installations',
      },
      {
        label: 'Fire Installation',
        slug: 'fire-installation',
      },
      {
        label: 'Refrigeration Installations',
        slug: 'refrigeration-installations',
      },
      {
        label: 'Ventilation Installations',
        slug: 'ventilation-installations',
      },
      {
        label: 'Elevators and Lift Systems: Durable Identification and Passenger Safety',
        slug: 'elevators-and-lift-systems',
      },
      {
        label: 'Electrical and Control Cabinets: Clear and Durable Labeling',
        slug: 'electrical-and-control-cabinets',
      },
      {
        label: 'Electrical in Control and Building Automation',
        slug: 'electrical-in-control-and-building-automation',
      },
      {
        label: 'Plumbing Installations',
        slug: 'plumbing-installations-across',
      },
    ],
  },
  {
    title: 'Security & Automation',
    slug: 'security-automation',
    image: '/images/industries/security-automation.jpg',
    reverse: true,
    items: [
      {
        label: 'Alarm and Security Installations',
        slug: 'alarm-and-security-installations',
      },
      {
        label: 'Robotics Industry: Clear Labeling for Safe and Efficient Automation',
        slug: 'robotics-industry',
      },
      {
        label: 'Production Lines: Optimized Safety and Efficiency',
        slug: 'production-lines',
      },
      {
        label: 'Industrial Maintenance: Safety, Efficiency, and Structured Operations',
        slug: 'industrial-maintenance',
      },
      {
        label: 'Hydraulic Systems and Fluid Technology',
        slug: 'hydraulic-systems-and-fluid-technology',
      },
    ],
  },
  {
    title: 'Energy & Environment',
    slug: 'energy-environment',
    image: '/images/industries/energy-environment.jpg',
    reverse: false,
    items: [
      {
        label: 'Solar Energy and Photovoltaics: Durable UV-Resistant Labeling for Sustainable Power',
        slug: 'solar-energy-and-photovoltaics',
      },
      {
        label: 'Nuclear Power: Safe, Reliable, and Carbon-Free Energy',
        slug: 'nuclear-power',
      },
      {
        label: 'Hydropower: Reliable and Renewable Energy',
        slug: 'hydropower',
      },
      {
        label: 'Combined Heat and Power Plants',
        slug: 'combined-heat-and-power-plants',
      },
      {
        label: 'Biogas: Sustainable Energy Production',
        slug: 'biogas',
      },
      {
        label: 'Waste Stations: Safe and Efficient Waste Management',
        slug: 'waste-stations',
      },
      {
        label: 'Wastewater Treatment Plants: Safe, Organized, and Durable Signage',
        slug: 'wastewater-treatment-plants',
      },
      {
        label: 'Power Grids: Safe, Efficient, and Durable Signage',
        slug: 'power-grids',
      },
    ],
  },
  {
    title: 'Infrastructure & Mobility',
    slug: 'infrastructure-mobility',
    image: '/images/industries/infrastructure-mobility.jpg',
    reverse: true,
    items: [
      {
        label: 'Rail Industry: Ensuring Safety and Efficiency',
        slug: 'rail-industry',
      },
      {
        label: 'Railway Infrastructure: Durable Signage and Safe Operations',
        slug: 'railway-infrastructure',
      },
      {
        label: 'Airports: Safety, Navigation, and Durable Signage',
        slug: 'airports',
      },
      {
        label: 'Ports: Safe, Organized, and Durable Signage for Maritime Operations',
        slug: 'ports',
      },
      {
        label: 'Tunnels & Bridges: Durable Signage and Labeling',
        slug: 'tunnels-and-bridges',
      },
      {
        label: 'Ships & Offshore Industry: Durable Safety and Clear Labeling',
        slug: 'ships-and-offshore-industry',
      },
      {
        label: 'Charging Infrastructure for Electric Vehicles',
        slug: 'charging-infrastructure-for-electric-vehicles',
      },
      {
        label: 'Construction Projects',
        slug: 'construction-projects',
      },
      {
        label: 'Architecture and Construction',
        slug: 'architecture-and-construction',
      },
    ],
  },
  {
    title: 'Manufacturing & Heavy Industry',
    image: '/images/industries/manufacturing-heavy-industry.jpg',
    reverse: false,
    items: [
      'Automotive Industry Signage and Labeling',
      'Aviation Industry: Precision, Safety, and High-Performance Infrastructure',
      'Electronics Industry: High-Tech Manufacturing',
      'Steel & Metal Industry: Organized and Safe Labeling',
      'Mining Industry: Safety, Durability, and Operational Control',
      'Pulp and Paper Industry: Safe and Efficient Labeling',
      'Machinery Industry: Precision Engineering and Industrial Performance',
      'Tool Manufacturing and Fitness Equipment: High-Performance Branding and Serial Identification',
      'Battery Factories: Safety, Efficiency, and Durable Signage',
    ],
  },
  {
    title: 'IT & Telecom',
    slug: 'it-telecom',
    image: '/images/industries/it-telecom.jpg',
    reverse: true,
    items: [
      {
        label: 'Tele- and Data Installations',
        slug: 'tele-and-data-installations',
      },
      {
        label: 'Telecom: Reliable Signage and Labeling',
        slug: 'telecom',
      },
      {
        label: 'IT Infrastructure and Data Centers: Precision Labeling and High-Tech Identification',
        slug: 'it-infrastructure-and-data-centers',
      },
    ],
  },
  {
    title: 'Branding & Industrial Labeling',
    image: '/images/industries/branding-industrial-labeling.jpg',
    reverse: false,
    items: [
      'Food Industry: Safety, Hygiene, and Efficiency',
      'Furniture and Kitchen Manufacturing: Premium Branding and Functional Labeling',
      'Warehouse Logistics and Industrial Facilities: Precision Identification and Asset Tracking',
      'Medical and Healthcare: Hygienic Labeling and Patient Identification',
      'Oils, Lubricants, and Industrial Fluids: Chemically Resistant Identification',
      'Branding and Event Identity: Premium Signage and Decorative Labeling',
      'Packaging Industry: Innovation, Protection, and Efficiency',
      'Our Technologies and Materials',
      'Packaging Systems and Food Engineering',
    ],
  },
];

const getLangPrefix = (pathname = '') => {
  const match = String(pathname).match(/^\/([a-z]{2})(\/|$)/i);
  return match ? `/${match[1]}` : '';
};

const Industries = () => {
  const { pathname } = useLocation();
  const prefix = getLangPrefix(pathname);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.pageTitle}>Industries</h1>

        {INDUSTRY_SECTIONS.map((section, index) => (
          <React.Fragment key={section.title}>
            <section
              className={`${styles.industryRow} ${section.reverse ? styles.reverse : ''}`.trim()}
            >
              {!section.reverse && (
                <div className={styles.industryMedia}>
                  <img src={section.image} alt={section.title} />
                  <h2>{section.title}</h2>
                </div>
              )}

              <div className={styles.industryContent}>
                <ul>
                  {section.items.map((item) => (
                    <li key={typeof item === 'string' ? item : item.label}>
                      {typeof item === 'string' ? (
                        item
                      ) : (
                        <Link
                          className={styles.itemLink}
                          to={`${prefix}/industries/${section.slug}/${item.slug}`}
                        >
                          {item.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {section.reverse && (
                <div className={styles.industryMedia}>
                  <img src={section.image} alt={section.title} />
                  <h2>{section.title}</h2>
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