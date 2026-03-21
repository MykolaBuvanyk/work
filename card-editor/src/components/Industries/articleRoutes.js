const articleModules = import.meta.glob('./articles/**/*.jsx', { eager: true });

export const ARTICLE_ROUTE_MAP = {
  'energy-environment': {
    'biogas': articleModules['./articles/energy-environment/biogas.jsx']?.default,
    'combined-heat-and-power-plants': articleModules['./articles/energy-environment/combined-heat-and-power-plants.jsx']?.default,
    'hydropower': articleModules['./articles/energy-environment/hydropower.jsx']?.default,
    'nuclear-power': articleModules['./articles/energy-environment/nuclear-power.jsx']?.default,
    'power-grids': articleModules['./articles/energy-environment/power-grids.jsx']?.default,
    'solar-energy-and-photovoltaics': articleModules['./articles/energy-environment/solar-energy-and-photovoltaics.jsx']?.default,
    'waste-stations': articleModules['./articles/energy-environment/waste-stations.jsx']?.default,
    'wastewater-treatment-plants': articleModules['./articles/energy-environment/wastewater-treatment-plants.jsx']?.default,
  },
  'infrastructure-mobility': {
    'airports': articleModules['./articles/infrastructure-mobility/airports.jsx']?.default,
    'architecture-and-construction': articleModules['./articles/infrastructure-mobility/architecture-and-construction.jsx']?.default,
    'charging-infrastructure-for-electric-vehicles': articleModules['./articles/infrastructure-mobility/charging-infrastructure-for-electric-vehicles.jsx']?.default,
    'construction-projects': articleModules['./articles/infrastructure-mobility/construction-projects.jsx']?.default,
    'ports': articleModules['./articles/infrastructure-mobility/ports.jsx']?.default,
    'rail-industry': articleModules['./articles/infrastructure-mobility/rail-industry.jsx']?.default,
    'railway-infrastructure': articleModules['./articles/infrastructure-mobility/railway-infrastructure.jsx']?.default,
    'ships-and-offshore-industry': articleModules['./articles/infrastructure-mobility/ships-and-offshore-industry.jsx']?.default,
    'tunnels-and-bridges': articleModules['./articles/infrastructure-mobility/tunnels-and-bridges.jsx']?.default,
  },
  'it-telecom': {
    'it-infrastructure-and-data-centers': articleModules['./articles/it-telecom/it-infrastructure-and-data-centers.jsx']?.default,
    'tele-and-data-installations': articleModules['./articles/it-telecom/tele-and-data-installations.jsx']?.default,
    'telecom': articleModules['./articles/it-telecom/telecom.jsx']?.default,
  },
  'mep-building-services': {
    'electrical-and-control-cabinets': articleModules['./articles/mep-building-services/electrical-and-control-cabinets.jsx']?.default,
    'electrical-in-control-and-building-automation': articleModules['./articles/mep-building-services/electrical-in-control-and-building-automation.jsx']?.default,
    'electrical-installation': articleModules['./articles/mep-building-services/electrical-installation.jsx']?.default,
    'elevators-and-lift-systems': articleModules['./articles/mep-building-services/elevators-and-lift-systems.jsx']?.default,
    'fire-installation': articleModules['./articles/mep-building-services/fire-installation.jsx']?.default,
    'plumbing-installations-across': articleModules['./articles/mep-building-services/plumbing-installations-across.jsx']?.default,
    'refrigeration-installations': articleModules['./articles/mep-building-services/refrigeration-installations.jsx']?.default,
    'sprinkler-installations': articleModules['./articles/mep-building-services/sprinkler-installations.jsx']?.default,
    'ventilation-installations': articleModules['./articles/mep-building-services/ventilation-installations.jsx']?.default,
  },
  'security-automation': {
    'alarm-and-security-installations': articleModules['./articles/security-automation/alarm-and-security-installations.jsx']?.default,
    'hydraulic-systems-and-fluid-technology': articleModules['./articles/security-automation/hydraulic-systems-and-fluid-technology.jsx']?.default,
    'industrial-maintenance': articleModules['./articles/security-automation/industrial-maintenance.jsx']?.default,
    'production-lines': articleModules['./articles/security-automation/production-lines.jsx']?.default,
    'robotics-industry': articleModules['./articles/security-automation/robotics-industry.jsx']?.default,
  },
};
