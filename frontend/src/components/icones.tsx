import { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement>;

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function IconeEmployes(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M15.5 20c.2-2.4 1.9-4.3 4-4.7" />
    </svg>
  );
}

export function IconePostes(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="8" width="16" height="13" rx="1" />
      <path d="M9 21v-5h6v5M4 8l8-5 8 5" />
    </svg>
  );
}

export function IconeContrats(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M10 12h6M10 16h6" />
    </svg>
  );
}

export function IconeConges(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M4 10h16M8 3v4M16 3v4M9 14h1M14 14h1M9 17h1" />
    </svg>
  );
}

export function IconeSimulateur(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M8 3v4M16 3v4" />
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M8 13l3 3 5-6" />
    </svg>
  );
}

export function IconeAbsences(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 4v3M15 4v3" />
      <rect x="4" y="6" width="16" height="14" rx="2" />
      <path d="M4 11h16" />
      <path d="M9 15l2.5 2.5L16 13" />
    </svg>
  );
}

export function IconeMissions(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 11l18-7-7 18-2.5-7.5L3 11z" />
    </svg>
  );
}

export function IconePointage(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function IconePaie(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6.5 9v0M17.5 15v0" />
    </svg>
  );
}

export function IconeAttestations(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3h9l3 3v15a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" />
      <path d="M15 3v3h3" />
      <path d="M8 13h8M8 17h5" />
      <circle cx="9.5" cy="9" r="1.5" />
    </svg>
  );
}

export function IconeCyclePaie(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
      <path d="M8 13l2.5 2.5L16 10" />
    </svg>
  );
}

export function IconeTableauxDeBord(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

export function IconeAlerte(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 8v5l3 2" />
      <circle cx="12" cy="12" r="8.5" />
    </svg>
  );
}

export function IconeDossierVide(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M4 10h16M8 3v4M16 3v4M9 14h1M14 14h1M9 17h1" />
    </svg>
  );
}

export function IconeAudit(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 3h6l3 3v15H6V3z" />
      <path d="M9 3v3H6" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function IconeParametres(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

export function IconeDeconnexion(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

export function IconeChevronBas(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function IconeMenu(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function IconeFermer(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
