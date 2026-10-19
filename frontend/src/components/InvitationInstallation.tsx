import { useEffect, useState } from 'react';

// Événement Chrome/Android non typé par lib.dom : permet d'afficher notre propre bouton d'installation.
interface EvenementInstallation extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const CLE_MASQUEE = 'rh_amp_invitation_installation_masquee';

function dejaInstallee(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}

function estIphone(): boolean {
  // iPadOS se présente comme un Mac : on le reconnaît à l'écran tactile.
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
}

function lireMasquee(): boolean {
  try {
    return localStorage.getItem(CLE_MASQUEE) === '1';
  } catch {
    return false;
  }
}

// Android : bouton « Installer » (installation native du navigateur). iPhone : Apple n'offre aucun
// bouton d'installation, on affiche donc le geste à faire dans Safari.
export function InvitationInstallation() {
  const [evenement, setEvenement] = useState<EvenementInstallation | null>(null);
  const [masquee, setMasquee] = useState(() => lireMasquee() || dejaInstallee());

  useEffect(() => {
    const surInvitation = (e: Event) => {
      e.preventDefault();
      setEvenement(e as EvenementInstallation);
    };
    const surInstallee = () => setMasquee(true);
    window.addEventListener('beforeinstallprompt', surInvitation);
    window.addEventListener('appinstalled', surInstallee);
    return () => {
      window.removeEventListener('beforeinstallprompt', surInvitation);
      window.removeEventListener('appinstalled', surInstallee);
    };
  }, []);

  function masquer() {
    setMasquee(true);
    try {
      localStorage.setItem(CLE_MASQUEE, '1');
    } catch {
      // stockage indisponible : l'invitation reviendra au prochain chargement, sans gravité
    }
  }

  async function installer() {
    if (!evenement) return;
    await evenement.prompt();
    const { outcome } = await evenement.userChoice;
    if (outcome === 'accepted') masquer();
    setEvenement(null);
  }

  if (masquee) return null;
  if (!evenement && !estIphone()) return null;

  return (
    <div className="flex items-center gap-3 border-b border-primary-100 bg-primary-50 px-4 py-2.5 text-sm text-primary-900">
      <img src="/icone-192.png" alt="" className="h-9 w-9 shrink-0 rounded-lg" />
      <p className="flex-1">
        {evenement ? (
          <>Installez l'application <strong>RH AMP</strong> pour l'ouvrir même sans connexion.</>
        ) : (
          <>
            Pour installer <strong>RH AMP</strong> : touchez le bouton <strong>Partager</strong> ⬆️ de Safari, puis{' '}
            <strong>« Sur l'écran d'accueil »</strong>.
          </>
        )}
      </p>
      {evenement && (
        <button
          onClick={installer}
          className="shrink-0 rounded-md bg-primary-700 px-3 py-1.5 font-medium text-white transition-colors duration-200 hover:bg-primary-800"
        >
          Installer
        </button>
      )}
      <button onClick={masquer} aria-label="Masquer" className="shrink-0 px-1 text-lg leading-none text-primary-700 hover:text-primary-900">
        ×
      </button>
    </div>
  );
}
