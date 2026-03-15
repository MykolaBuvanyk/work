import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './Industries.module.css';

const INDUSTRY_SECTIONS = [
  {
    title: 'MEP & Building Services',
    image: '/images/industries/mep-building-services.jpg',
    reverse: false,
    items: [
      'Electrical Installation',
      'Sprinkler Installations',
      'Fire Installation',
      'Refrigeration Installations',
      'Ventilation Installations',
      'Elevators and Lift Systems: Durable Identification and Passenger Safety',
      'Electrical and Control Cabinets: Clear and Durable Labeling',
      'Electrical in Control and Building Automation',
      'Plumbing Installations',
    ],
  },
  {
    title: 'Security & Automation',
    image: '/images/industries/security-automation.jpg',
    reverse: true,
    items: [
      'Alarm and Security Installations',
      'Robotics Industry: Clear Labeling for Safe and Efficient Automation',
      'Production Lines: Optimized Safety and Efficiency',
      'Industrial Maintenance: Safety, Efficiency, and Structured Operations',
      'Hydraulic Systems and Fluid Technology',
    ],
  },
  {
    title: 'Energy & Environment',
    image: '/images/industries/energy-environment.jpg',
    reverse: false,
    items: [
      'Solar Energy and Photovoltaics: Durable UV-Resistant Labeling for Sustainable Power',
      'Nuclear Power: Safe, Reliable, and Carbon-Free Energy',
      'Hydropower: Reliable and Renewable Energy',
      'Combined Heat and Power Plants',
      'Biogas: Sustainable Energy Production',
      'Waste Stations: Safe and Efficient Waste Management',
      'Wastewater Treatment Plants: Safe, Organized, and Durable Signage',
      'Power Grids: Safe, Efficient, and Durable Signage',
    ],
  },
  {
    title: 'Infrastructure & Mobility',
    image: '/images/industries/infrastructure-mobility.jpg',
    reverse: true,
    items: [
      'Rail Industry: Ensuring Safety and Efficiency',
      'Railway Infrastructure: Durable Signage and Safe Operations',
      'Airports: Safety, Navigation, and Durable Signage',
      'Ports: Safe, Organized, and Durable Signage for Maritime Operations',
      'Tunnels & Bridges: Durable Signage and Labeling',
      'Ships & Offshore Industry: Durable Safety and Clear Labeling',
      'Charging Infrastructure for Electric Vehicles',
      'Construction Projects',
      'Architecture and Construction',
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
    image: '/images/industries/it-telecom.jpg',
    reverse: true,
    items: [
      'Tele- and Data Installations',
      'Telecom: Reliable Signage and Labeling',
      'IT Infrastructure and Data Centers: Precision Labeling and High-Tech Identification',
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
                    <li key={item}>{item}</li>
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