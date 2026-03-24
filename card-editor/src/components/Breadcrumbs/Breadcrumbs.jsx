import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { prefixedLngs } from '../../i18n';
import styles from './Breadcrumbs.module.css';

const LABELS = {
  home: 'Home',
  'online-sign-editor': 'New Project',
  'new-project': 'New Project',
  faq: 'FAQ',
  login: 'Registration',
  enter: 'Enter',
  'terms-of-purchasing': 'Terms of Purchasing',
  'privacy-policy': 'Privacy Policy',
  contacts: 'Contacts',
  products: 'Products',
  industries: 'Industries',
  'quick-guide': 'Quick Guide',
  share: 'Share Project',
  account: 'My Account',
  pay: 'Payment',
  setting: 'Settings',
  detail: 'My Details',
  checkout: 'Checkout',
  'order-success': 'Order Success',
  'order-secces': 'Order Success',
  admin: 'Admin',
  'cart-orders': 'Cart Orders',
  'update-avaible': 'Update Available',
  icon: 'Icons',
  'update-baner': 'Update Banner',
  'rail-industry': 'Rail Industry',
  'railway-infrastructure': 'Railway Infrastructure',
  airports: 'Airports',
  ports: 'Ports',
  'tunnels-and-bridges': 'Tunnels & Bridges',
  'ships-and-offshore-industry': 'Ships & Offshore Industry',
  'charging-infrastructure-for-electric-vehicles': 'Charging Infrastructure for Electric Vehicles',
  'construction-projects': 'Construction Projects',
  'architecture-and-construction': 'Architecture and Construction',
  'solar-energy-and-photovoltaics': 'Solar Energy and Photovoltaics',
  'nuclear-power': 'Nuclear Power',
  hydropower: 'Hydropower',
  'combined-heat-and-power-plants': 'Combined Heat and Power Plants',
  biogas: 'Biogas',
  'waste-stations': 'Waste Stations',
  'wastewater-treatment-plants': 'Wastewater Treatment Plants',
  'power-grids': 'Power Grids',
  'electrical-installation': 'Electrical Installation',
  'sprinkler-installations': 'Sprinkler Installations',
  'fire-installation': 'Fire Installation',
  'refrigeration-installations': 'Refrigeration Installations',
  'ventilation-installations': 'Ventilation Installations',
  'elevators-and-lift-systems': 'Elevators and Lift Systems',
  'electrical-and-control-cabinets': 'Electrical and Control Cabinets',
  'electrical-in-control-and-building-automation': 'Electrical in Control and Building Automation',
  'plumbing-installations-across': 'Plumbing Installations',
  'alarm-and-security-installations': 'Alarm and Security Installations',
  'robotics-industry': 'Robotics Industry',
  'production-lines': 'Production Lines',
  'industrial-maintenance': 'Industrial Maintenance',
  'hydraulic-systems-and-fluid-technology': 'Hydraulic Systems and Fluid Technology',
  'tele-and-data-installations': 'Tele- and Data Installations',
  telecom: 'Telecom',
  'it-infrastructure-and-data-centers': 'IT Infrastructure and Data Centers',
  'automotive-industry-signage-and-labeling': 'Automotive Industry Signage and Labeling',
  'aviation-industry': 'Aviation Industry',
  'battery-factories': 'Battery Factories',
  'electronics-industry-signage-and-labeling': 'Electronics Industry Signage and Labeling',
  'machinery-industry': 'Machinery Industry',
  'mining-industry': 'Mining Industry',
  'pulp-and-paper-industry': 'Pulp and Paper Industry',
  'steel-and-metal-industry': 'Steel and Metal Industry',
  'tool-manufacturing-and-fitness-equipment': 'Tool Manufacturing and Fitness Equipment',
  'food-industry-safety-hygiene-and-efficiency': 'Food Industry',
  'furniture-and-kitchen-manufacturing': 'Furniture and Kitchen Manufacturing',
  'warehouse-logistics-and-industrial-facilities': 'Warehouse Logistics and Industrial Facilities',
  'medical-and-healthcare': 'Medical and Healthcare',
  'oils-lubricants-and-industrial-fluids': 'Oils, Lubricants, and Industrial Fluids',
  'branding-and-event-identity': 'Branding and Event Identity',
  'packaging-industry': 'Packaging Industry',
  'our-technologies-and-materials': 'Our Technologies and Materials',
  'packaging-systems-and-food-engineering': 'Packaging Systems and Food Engineering',
};

const HIDDEN_ROOT_SEGMENTS = new Set(['', 'share']);
const HIDDEN_MIDDLE_SEGMENTS = new Set([
  'infrastructure-mobility',
  'energy-environment',
  'mep-building-services',
  'branding-industrial-labeling',
  'manufacturing-heavy-industry',
  'security-automation',
  'it-telecom',
]);

const formatSegmentLabel = (segment) => {
  if (!segment) return '';
  return LABELS[segment] || segment
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const Breadcrumbs = () => {
  const { pathname } = useLocation();
  const rawSegments = pathname.split('/').filter(Boolean);

  const hasLanguagePrefix = prefixedLngs.includes(rawSegments[0]);
  const contentSegments = hasLanguagePrefix ? rawSegments.slice(1) : rawSegments;
  const pathPrefix = hasLanguagePrefix ? `/${rawSegments[0]}` : '';

  // Home page (root route) should not show breadcrumbs.
  if (contentSegments.length === 0) {
    return null;
  }

  // New Project page should not show breadcrumbs.
  if (contentSegments.length === 1 && contentSegments[0] === 'online-sign-editor') {
    return null;
  }

  if (contentSegments.length === 0 || HIDDEN_ROOT_SEGMENTS.has(contentSegments[0])) {
    return null;
  }

  const crumbs = [];

  if (contentSegments[0] !== 'home') {
    crumbs.push({ label: 'Home', href: pathPrefix || '/' });
  }

  const pathAccumulator = [];

  contentSegments.forEach((segment) => {
    pathAccumulator.push(segment);

    if (HIDDEN_MIDDLE_SEGMENTS.has(segment)) {
      return;
    }

    const href = `${pathPrefix}/${pathAccumulator.join('/')}`;
    crumbs.push({
      label: formatSegmentLabel(segment),
      href,
    });
  });

  return (
    <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
      <div className={styles.inner}>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <React.Fragment key={`${crumb.href}-${crumb.label}-${index}`}>
              {isLast ? (
                <span className={styles.current}>{crumb.label}</span>
              ) : (
                <Link className={styles.link} to={crumb.href}>
                  {crumb.label}
                </Link>
              )}
              {!isLast ? <span className={styles.separator}> - </span> : null}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
};

export default Breadcrumbs;