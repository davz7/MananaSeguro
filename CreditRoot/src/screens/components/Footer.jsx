import { useTranslation } from 'react-i18next'
import logoCompleto from '../../assets/LOGO_MS.png'

const XIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
)

const FacebookIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
)

const InstagramIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
)

const LinkedinIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
        <rect width="4" height="12" x="2" y="9" />
        <circle cx="4" cy="4" r="2" />
    </svg>
)

const MailIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
)

const SOCIAL_LINKS = [
    { icon: XIcon, href: 'https://x.com/mananaseguro_mx', label: 'X / Twitter' },
    { icon: FacebookIcon, href: 'https://www.facebook.com/61573338863765/', label: 'Facebook' },
    { icon: InstagramIcon, href: 'https://www.instagram.com/mananaseguro_mx', label: 'Instagram' },
    { icon: LinkedinIcon, href: 'https://linkedin.com/company/mananaseguro', label: 'LinkedIn' },
    { icon: MailIcon, href: 'mailto: contactomananaseguro@gmail.com', label: 'Correo' },
]

function Footer() {
    const { t } = useTranslation()
    const year = new Date().getFullYear()

    return (
        <footer className="bg-cream dark:bg-[#0f0e0d] border-t border-ink/8 dark:border-white/8 py-8">
            <div className="container mx-auto px-4 flex flex-col gap-6">

                {/* Fila principal */}
                <div className="flex flex-wrap justify-between items-center gap-4">

                    {/* Logo */}
                    <div className="flex items-center gap-2">
                        <img src={logoCompleto} alt="Logo Mañana Seguro" className="h-8 w-auto rounded-lg" />
                        <span className="font-display font-bold text-lg text-ink dark:text-white tracking-tight">
                            Mañana <span className="text-brand">Seguro</span>
                        </span>
                    </div>

                    {/* Redes sociales */}
                    <div className="flex items-center gap-3">
                        {SOCIAL_LINKS.map(({ icon: Icon, href, label }) => (
                            <a
                                key={label}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={label}
                                className="text-gray dark:text-white/40 hover:text-brand dark:hover:text-brand transition-colors">
                                <Icon size={18} />
                            </a>
                        ))}
                    </div>

                    {/* Créditos */}
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray dark:text-white/40">
                        <span>{t('footer.stellar')}</span>
                        <span className="text-ink/20 dark:text-white/20">·</span>
                        <span>{t('footer.etherfuse')}</span>
                        <span className="text-ink/20 dark:text-white/20">·</span>
                        <span>{t('footer.hackathon')}</span>
                    </div>

                </div>

                {/* Fila legal */}
                <div className="flex flex-wrap justify-between items-center gap-2 border-t border-ink/8 dark:border-white/8 pt-4 text-xs text-gray/60 dark:text-white/30">
                    <span>© {year} Mañana Seguro. Todos los derechos reservados.</span>
                    <div className="flex items-center gap-4">
                        <a href="/privacidad" className="hover:text-brand transition-colors">
                            Aviso de privacidad
                        </a>
                        <a href="/terminos" className="hover:text-brand transition-colors">
                            Términos y condiciones
                        </a>
                    </div>
                </div>

            </div>
        </footer>
    )
}

export default Footer